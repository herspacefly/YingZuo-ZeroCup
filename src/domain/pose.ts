import type { Bounds, PuppetPart, PuppetTemplate } from '../content/asset-types';
import { JOINT_IDS } from './limits';
import { projectLocalPoint, projectionParameters, WORLD_HEIGHT, WORLD_WIDTH } from './projection';
import type { Point } from './projection';
import type { JointId, Pose, StageConfig } from './types';

export interface Transform { x: number; y: number; angle: number }
export interface PoseFit { pose: Pose; bounds: Bounds; fits: boolean }
type Attachment = PuppetTemplate['attachments'][number];

const IDENTITY: Transform = { x: 0, y: 0, angle: 0 };
const EPSILON = 1e-8;

function clamp(value: number, min: number, max: number, fallback = min): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

/** Never mutates the saved pose; disabled/missing template joints are always zero. */
export function constrainPose(pose: Pose, template: PuppetTemplate): Pose {
  const joints = {} as Record<JointId, number>;
  for (const id of JOINT_IDS) {
    const joint = template.joints.find((item) => item.jointId === id);
    joints[id] = joint?.enabled ? clamp(pose.joints[id], joint.minRad, joint.maxRad, joint.defaultRad) : 0;
  }
  return { x: clamp(pose.x, 0, 1, 0.5), y: clamp(pose.y, 0, 1, 0.55),
    scale: clamp(pose.scale, 0.6, 1, 0.8), facing: pose.facing === -1 ? -1 : 1, joints };
}

export function transformPoint(point: Point, transform: Transform): Point {
  const cos = Math.cos(transform.angle); const sin = Math.sin(transform.angle);
  return { x: transform.x + point.x * cos - point.y * sin,
    y: transform.y + point.x * sin + point.y * cos };
}

/** J = parentJ * Translate(anchor) * Rotate(rest + pose). All results are template-local. */
export function jointTransform(template: PuppetTemplate, pose: Pose, jointId: JointId | null): Transform {
  const visited: JointId[] = [];
  function resolve(id: JointId | null): Transform {
    if (id === null) return { ...IDENTITY };
    if (visited.indexOf(id) !== -1) throw new Error(`Cyclic puppet joint: ${id}`);
    const joint = template.joints.find((item) => item.jointId === id);
    if (!joint) throw new Error(`Missing puppet joint: ${id}`);
    visited.push(id);
    const parent = resolve(joint.parentJoint);
    const anchor = transformPoint({ x: joint.anchor[0], y: joint.anchor[1] }, parent);
    const angle = joint.enabled ? clamp(pose.joints[id], joint.minRad, joint.maxRad, joint.defaultRad) : 0;
    return { ...anchor, angle: parent.angle + joint.restAngleRad + angle };
  }
  return resolve(jointId);
}

/** J * Rotate(bind) * Translate(-pivot), without guessing the bitmap centre. */
export function partTransform(template: PuppetTemplate, pose: Pose, part: PuppetPart): Transform {
  const joint = jointTransform(template, pose, part.parentJoint);
  const angle = joint.angle + part.bindAngleRad;
  const pivot = transformPoint({ x: -part.pivot[0], y: -part.pivot[1] }, { ...joint, angle });
  return { ...pivot, angle };
}

export function attachmentTransform(template: PuppetTemplate, pose: Pose, attachment: Attachment): Transform {
  const part = template.parts.find((item) => item.partId === attachment.partId);
  if (!part) throw new Error(`Missing attachment host: ${attachment.partId}`);
  const host = partTransform(template, pose, part);
  const anchor = transformPoint({ x: attachment.anchor[0], y: attachment.anchor[1] }, host);
  // Suspended props keep their image-up direction while the grip follows the hand.
  // Pose.facing is applied at the actor root; it does not reverse gravity.
  // Limited wrist release pivots about the measured fingers, preserving IK and the grip.
  const wrist = attachment.gripMotion === 'axe-wrist-v1' || attachment.gripMotion === 'held-wrist-v1'
    ? clamp(.38 * pose.joints.rightShoulder - .18 * pose.joints.rightElbow, -.6, .6, 0) : 0;
  const angle = (attachment.orientation === 'upright' ? 0 : host.angle) + attachment.bindAngleRad + wrist;
  const pivot = transformPoint({ x: -attachment.pivot[0], y: -attachment.pivot[1] }, { ...anchor, angle });
  return { ...pivot, angle };
}

function corners(bounds: Bounds): Point[] {
  return [{ x: bounds.minX, y: bounds.minY }, { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY }];
}

function actorPoints(template: PuppetTemplate, pose: Pose, attachmentIds?: readonly string[]): Point[] {
  const points: Point[] = [];
  for (const part of template.parts) {
    const transform = partTransform(template, pose, part);
    for (const point of corners(part.bounds)) points.push(transformPoint(point, transform));
  }
  for (const attachment of template.attachments) {
    const visible = attachmentIds ? attachmentIds.indexOf(attachment.id) !== -1 : attachment.defaultVisible;
    if (!visible) continue;
    const transform = attachmentTransform(template, pose, attachment);
    for (const point of corners(attachment.bounds)) points.push(transformPoint(point, transform));
  }
  if (!points.length) throw new Error('A puppet must contain at least one visible part.');
  return points;
}

function boundsOf(points: Point[]): Bounds {
  let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
  for (const point of points) {
    minX = Math.min(minX, point.x); minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x); maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

/** Actual posed bitmap rectangles and visible props; never the neutral/template motion envelope. */
export function actorLocalBounds(template: PuppetTemplate, pose: Pose, attachmentIds?: readonly string[]): Bounds {
  return boundsOf(actorPoints(template, pose, attachmentIds));
}

export function projectedPoseBounds(template: PuppetTemplate, pose: Pose, stage: StageConfig, attachmentIds?: readonly string[]): Bounds {
  return boundsOf(actorPoints(template, pose, attachmentIds).map((point) => projectLocalPoint(point, pose, stage)));
}

/** Translate in normalized root space. Shrink only when size cannot fit, never below the legal 0.6. */
export function constrainPoseToStage(pose: Pose, template: PuppetTemplate, stage: StageConfig,
  attachmentIds?: readonly string[], margin = 0.04): PoseFit {
  let result = constrainPose(pose, template);
  const inset = clamp(margin, 0, WORLD_HEIGHT / 2 - EPSILON, 0.04);
  const minX = -WORLD_WIDTH / 2 + inset; const maxX = WORLD_WIDTH / 2 - inset;
  const minY = -WORLD_HEIGHT / 2 + inset; const maxY = WORLD_HEIGHT / 2 - inset;
  let bounds = projectedPoseBounds(template, result, stage, attachmentIds);
  const shrink = Math.min(1, (maxX - minX) / (bounds.maxX - bounds.minX), (maxY - minY) / (bounds.maxY - bounds.minY));
  if (shrink < 1) {
    result = { ...result, scale: Math.max(0.6, result.scale * shrink) };
    bounds = projectedPoseBounds(template, result, stage, attachmentIds);
  }
  const { magnification } = projectionParameters(stage);
  const lowX = (minX - bounds.minX) / magnification / WORLD_WIDTH;
  const highX = (maxX - bounds.maxX) / magnification / WORLD_WIDTH;
  // Increasing normalized y moves the projected silhouette down.
  const lowY = -(maxY - bounds.maxY) / magnification / WORLD_HEIGHT;
  const highY = -(minY - bounds.minY) / magnification / WORLD_HEIGHT;
  // If an axis is too large, centre it rather than silently breaking persisted scale limits.
  const dx = lowX <= highX ? clamp(0, lowX, highX) : (lowX + highX) / 2;
  const dy = lowY <= highY ? clamp(0, lowY, highY) : (lowY + highY) / 2;
  result = { ...result, x: clamp(result.x + dx, 0, 1), y: clamp(result.y + dy, 0, 1) };
  bounds = projectedPoseBounds(template, result, stage, attachmentIds);
  const fits = bounds.minX >= minX - EPSILON && bounds.maxX <= maxX + EPSILON &&
    bounds.minY >= minY - EPSILON && bounds.maxY <= maxY + EPSILON;
  return { pose: result, bounds, fits };
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle));
}

/** Two-bone IK in template space. The template's down-pointing bind vectors define its zero. */
export function solveArm(template: PuppetTemplate, pose: Pose, side: 'left' | 'right', targetLocal: Point): Pose {
  const result = constrainPose(pose, template);
  const arm = template.arms.find((item) => item.side === side);
  if (!arm) return result;
  const shoulder = template.joints.find((item) => item.jointId === arm.shoulder);
  const elbow = template.joints.find((item) => item.jointId === arm.elbow);
  if (!shoulder?.enabled || !elbow?.enabled || arm.upperLength <= 0 || arm.lowerLength <= 0) return result;
  const forearm = template.parts.find((item) => item.parentJoint === arm.elbow);
  // handLocal is also the hand rod's point in the forearm bitmap. Honour its bind/pivot.
  const handOffset = forearm ? transformPoint({ x: arm.handLocal[0] - forearm.pivot[0], y: arm.handLocal[1] - forearm.pivot[1] },
    { ...IDENTITY, angle: forearm.bindAngleRad }) : { x: arm.handLocal[0], y: arm.handLocal[1] };
  const upperLength = Math.sqrt(elbow.anchor[0] ** 2 + elbow.anchor[1] ** 2);
  const lowerLength = Math.sqrt(handOffset.x ** 2 + handOffset.y ** 2);
  if (upperLength <= EPSILON || lowerLength <= EPSILON) return result;
  const parent = jointTransform(template, result, shoulder.parentJoint);
  const origin = transformPoint({ x: shoulder.anchor[0], y: shoulder.anchor[1] }, parent);
  let dx = targetLocal.x - origin.x; let dy = targetLocal.y - origin.y;
  let distance = Math.sqrt(dx * dx + dy * dy);
  if (!Number.isFinite(distance)) return result;
  if (distance < EPSILON) {
    // At coincidence retain the current upper-arm direction, so no arbitrary flip occurs.
    const current = jointTransform(template, result, arm.shoulder);
    const direction = transformPoint({ x: elbow.anchor[0], y: elbow.anchor[1] }, { ...IDENTITY, angle: current.angle });
    const length = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    dx = length > EPSILON ? direction.x / length : 0;
    dy = length > EPSILON ? direction.y / length : -1;
    distance = 1;
  }
  const minReach = Math.abs(upperLength - lowerLength) + EPSILON;
  const maxReach = upperLength + lowerLength - EPSILON;
  const reach = clamp(Math.sqrt((targetLocal.x - origin.x) ** 2 + (targetLocal.y - origin.y) ** 2), minReach, maxReach);
  const cosine = clamp((reach * reach - upperLength * upperLength - lowerLength * lowerLength) /
    (2 * upperLength * lowerLength), -1, 1);
  const bend = arm.bendSign * Math.acos(cosine);
  const upperDirection = Math.atan2(dy / distance, dx / distance) -
    Math.atan2(lowerLength * Math.sin(bend), upperLength + lowerLength * Math.cos(bend));
  const upperBind = Math.atan2(elbow.anchor[1], elbow.anchor[0]);
  const lowerBind = Math.atan2(handOffset.y, handOffset.x);
  result.joints[arm.shoulder] = normalizeAngle(upperDirection - parent.angle - shoulder.restAngleRad - upperBind);
  result.joints[arm.elbow] = normalizeAngle(bend - elbow.restAngleRad - lowerBind + upperBind);
  return constrainPose(result, template);
}

/** The rod connection is template-local; use projectLocalPoint for the visible handle. */
export function rodPoint(template: PuppetTemplate, pose: Pose, rodId: string): Point {
  const rod = template.rods.find((item) => item.id === rodId);
  if (!rod) throw new Error(`Missing puppet rod: ${rodId}`);
  const part = template.parts.find((item) => item.partId === rod.partId);
  if (!part) throw new Error(`Missing rod host: ${rod.partId}`);
  return transformPoint({ x: rod.point[0], y: rod.point[1] }, partTransform(template, pose, part));
}
