import { assetCatalog } from '../content/catalog';
import type { Bounds, RenderActor } from '../content/asset-types';
import { JOINT_IDS } from '../domain/limits';
import { attachmentTransform, constrainPoseToStage, partTransform, projectedPoseBounds, rodPoint, solveArm, transformPoint } from '../domain/pose';
import { projectLocalPoint, projectionParameters, screenToLocalPoint, WORLD_HEIGHT, WORLD_WIDTH } from '../domain/projection';
import type { Point } from '../domain/projection';
import type { InteractionEvidence, StoryNode } from '../domain/story-types';
import type { Pose, StageConfig } from '../domain/types';
import { prepareFrame } from '../renderers/canvas/frame';
import type { CanvasFrame } from '../renderers/canvas/types';
import { emptyHoldObservation, handDistanceRatio, normalizedTargetBounds, observeHold, targetCoverageRatio, withinAngleRange } from './interactions';

export interface InteractionReading {
  evidence: InteractionEvidence | null;
  coverage: number;
  heldMs: number;
  distanceRatio: number;
  phase: 'waiting' | 'holding' | 'raised' | 'complete';
}
type RegionKind = 'wave' | 'road' | 'block' | 'light';
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const templateFor = (id: string) => assetCatalog.puppets.find(template => template.id === id);
const finiteRange = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;

/** The observer accepts the final constrained drawing input, never repairs a bad observation. */
function validatedFrame(frame: CanvasFrame): CanvasFrame | null {
  try {
    if (!frame || !Array.isArray(frame.actors) || frame.actors.length === 0) return null;
    for (const actor of frame.actors) {
      const template = templateFor(actor.templateId), pose = actor.pose;
      if (!template || !pose || !finiteRange(pose.x, 0, 1) || !finiteRange(pose.y, 0, 1) ||
        !finiteRange(pose.scale, .6, 1) || (pose.facing !== 1 && pose.facing !== -1)) return null;
      for (const id of JOINT_IDS) {
        const joint = template.joints.find(item => item.jointId === id), angle = pose.joints?.[id];
        if (!joint || !Number.isFinite(angle) || (joint.enabled
          ? angle < joint.minRad || angle > joint.maxRad : angle !== 0)) return null;
      }
    }
    return prepareFrame(frame, assetCatalog);
  } catch { return null; }
}

function matchesNode(frame: CanvasFrame, node: Pick<StoryNode, 'actors' | 'entryStage' | 'entryAttachments'>): boolean {
  if (frame.stage.backgroundId !== node.entryStage.backgroundId || frame.actors.length !== node.actors.length ||
    !node.actors.every(id => frame.actors.some(actor => actor.actorId === id))) return false;
  const attachments = frame.attachments ?? [];
  return attachments.length === node.entryAttachments.length && node.entryAttachments.every(expected =>
    attachments.some(item => item.actorId === expected.actorId && item.attachmentId === expected.attachmentId));
}

function corners(bounds: Bounds): Point[] {
  return [{ x: bounds.minX, y: bounds.minY }, { x: bounds.minX, y: bounds.maxY },
    { x: bounds.maxX, y: bounds.minY }, { x: bounds.maxX, y: bounds.maxY }];
}
function boundsOf(points: Point[]): Bounds | null {
  if (!points.length || !points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) return null;
  return { minX: Math.min(...points.map(point => point.x)), minY: Math.min(...points.map(point => point.y)),
    maxX: Math.max(...points.map(point => point.x)), maxY: Math.max(...points.map(point => point.y)) };
}
function region(frame: CanvasFrame, kind: RegionKind, lightRegion?: 'lantern'): Bounds | null {
  const actor = frame.actors.find(item => item.actorId === 'chenxiang');
  if (!actor) return null;
  const template = templateFor(actor.templateId)!;
  if(kind==='light'&&lightRegion==='lantern'){
    const lantern=template.attachments.find(item=>item.id==='lantern');
    if(!lantern||!frame.attachments?.some(item=>item.actorId===actor.actorId&&item.attachmentId==='lantern'))return null;
    const transform=attachmentTransform(template,actor.pose,lantern);
    return boundsOf(corners(lantern.bounds).map(point=>projectLocalPoint(transformPoint(point,transform),actor.pose,frame.stage)));
  }
  if (kind === 'road') return projectedPoseBounds(template, actor.pose, frame.stage,
    frame.attachments?.filter(item => item.actorId === actor.actorId).map(item => item.attachmentId) ?? []);
  const parts = kind === 'light' ? [template.parts.find(part => part.partId === template.motifPlacement?.partId)]
    : template.parts.filter(part => part.partId === 'rightUpperArm' || part.partId === 'rightForearm');
  if (parts.some(part => !part) || parts.length !== (kind === 'light' ? 1 : 2)) return null;
  const points: Point[] = [];
  for (const part of parts) {
    const bounds = kind === 'light' ? template.motifPlacement?.bounds : part!.bounds;
    if (!bounds) return null;
    const transform = partTransform(template, actor.pose, part!);
    points.push(...corners(bounds).map(point => projectLocalPoint(transformPoint(point, transform), actor.pose, frame.stage)));
  }
  return boundsOf(points);
}

/** v4 light tasks observe the held lantern; older scripts keep their original motif region. */
export function projectedInteractionRegion(frame: CanvasFrame, kind: RegionKind, lightRegion?: 'lantern'): Bounds | null {
  const prepared = validatedFrame(frame);
  return prepared && ['wave', 'road', 'block', 'light'].includes(kind) ? region(prepared, kind, lightRegion) : null;
}

function handPoints(frame: CanvasFrame): { chenxiang: Point; mother: Point } | null {
  const chenxiang = frame.actors.find(actor => actor.actorId === 'chenxiang');
  const mother = frame.actors.find(actor => actor.actorId === 'mother');
  if (!chenxiang || !mother) return null;
  const point = (actor: RenderActor) => projectLocalPoint(
    rodPoint(templateFor(actor.templateId)!, actor.pose, 'rightHand'), actor.pose, frame.stage);
  return { chenxiang: point(chenxiang), mother: point(mother) };
}
export function interactionHandPoints(frame: CanvasFrame): { chenxiang: Point; mother: Point } | null {
  const prepared = validatedFrame(frame);
  return prepared ? handPoints(prepared) : null;
}

const waiting = (coverage = 0, distanceRatio = Infinity): InteractionReading => ({ evidence: null, coverage,
  heldMs: 0, distanceRatio, phase: 'waiting' });
const stableBody = (pose: Pose, anchor: Pose) => Math.abs(pose.x - anchor.x) <= .008 + 1e-10 &&
  Math.abs(pose.y - anchor.y) <= .008 + 1e-10 && pose.scale === anchor.scale && pose.facing === anchor.facing;

/** Pure observations of one node clock. A completed reading is not latched across pause or invalid input. */
export function createNodeInteraction(node: StoryNode) {
  const completion = clone(node.completion);
  const boundary = clone({ actors: node.actors, entryStage: node.entryStage, entryAttachments: node.entryAttachments });
  let lastElapsedMs: number | null = null, hold = emptyHoldObservation();
  let anchor: Pose | null = null, raisedAngleRad: number | null = null, raisedHoldMs = 0;
  const clear = () => { hold = emptyHoldObservation(); anchor = null; raisedAngleRad = null; raisedHoldMs = 0; };
  return {
    reset() { clear(); lastElapsedMs = null; },
    observe(frame: CanvasFrame, elapsedMs: number, paused: boolean, operated: boolean): InteractionReading {
      const candidate = validatedFrame(frame);
      const prepared = candidate && matchesNode(candidate, boundary) ? candidate : null;
      const target = 'target' in completion ? normalizedTargetBounds(completion.target) : null;
      const kind = completion.kind;
      const observed = prepared && (kind === 'wave' || kind === 'road' || kind === 'block' || kind === 'light')
        ? region(prepared, kind, completion.kind==='light'?completion.region:undefined) : null;
      const coverage = observed && target ? targetCoverageRatio(observed, target) : 0;
      const hands = prepared && kind === 'reach' ? handPoints(prepared) : null;
      const distanceRatio = hands ? handDistanceRatio(hands.chenxiang, hands.mother) : Infinity;
      const validTime = Number.isFinite(elapsedMs) && elapsedMs >= 0;
      const discontinuity = lastElapsedMs !== null && (!validTime || elapsedMs < lastElapsedMs || elapsedMs - lastElapsedMs > 250);
      lastElapsedMs = validTime ? elapsedMs : null;
      if (!prepared || !validTime || paused || !operated || discontinuity) {
        clear(); return waiting(coverage, distanceRatio);
      }
      if (kind === 'wave' || kind === 'road' || kind === 'block' || kind === 'light') {
        if (!target || !finiteRange(completion.overlapRatio, 0, 1) || completion.overlapRatio <= 0 ||
          !Number.isFinite(completion.holdMs) || completion.holdMs <= 0) { clear(); return waiting(coverage); }
        hold = observeHold(hold, coverage >= completion.overlapRatio, elapsedMs);
        const complete = hold.matching && hold.heldMs >= completion.holdMs;
        return { coverage, heldMs: hold.heldMs, distanceRatio, phase: complete ? 'complete' : hold.matching ? 'holding' : 'waiting',
          evidence: complete ? { kind, overlapRatio: coverage, heldMs: hold.heldMs } : null };
      }
      if (kind === 'axe') {
        const pose = prepared.actors.find(actor => actor.actorId === 'chenxiang')?.pose;
        if (!pose || !target || !Number.isFinite(completion.holdMs) || completion.holdMs <= 0) { clear(); return waiting(); }
        const angle = pose.joints.rightShoulder;
        if (anchor && !stableBody(pose, anchor)) { clear(); return waiting(); }
        if (raisedAngleRad !== null) {
          const landed = withinAngleRange(angle, completion.landedAngleRange) && angle < raisedAngleRad;
          return { coverage: 0, heldMs: raisedHoldMs, distanceRatio, phase: landed ? 'complete' : 'raised',
            evidence: landed ? { kind: 'axe', stableBody: true, raisedAngleRad, raisedHoldMs,
              landedAngleRad: angle, lowered: true } : null };
        }
        const raised = withinAngleRange(angle, completion.raisedAngleRange);
        if (!raised) { clear(); return waiting(); }
        if (!anchor) anchor = clone(pose);
        hold = observeHold(hold, true, elapsedMs);
        if (hold.heldMs >= completion.holdMs) { raisedAngleRad = angle; raisedHoldMs = hold.heldMs; }
        return { evidence: null, coverage: 0, heldMs: hold.heldMs, distanceRatio,
          phase: raisedAngleRad !== null ? 'raised' : 'holding' };
      }
      clear();
      if (kind === 'reach' && target && finiteRange(completion.maxDistanceRatio, 0, 1) &&
        completion.maxDistanceRatio > 0 && distanceRatio <= completion.maxDistanceRatio) {
        return { evidence: { kind: 'reach', handDistanceRatio: distanceRatio }, coverage: 0,
          heldMs: 0, distanceRatio, phase: 'complete' };
      }
      return waiting(coverage, distanceRatio);
    },
  };
}

export interface InteractionGoal { pose: Pose; stage: Pick<StageConfig, 'lampX' | 'puppetDistance'> }

/** A legal target for an explicitly requested demonstration. This never observes time or creates evidence. */
export function interactionGoal(node: StoryNode, input: CanvasFrame): InteractionGoal | null {
  const frame = validatedFrame(input), completion = node.completion;
  if (!frame || !matchesNode(frame, node) || !('target' in completion)) return null;
  const actor = frame.actors.find(item => item.actorId === 'chenxiang'), target = normalizedTargetBounds(completion.target);
  if (!actor || !target) return null;
  const template = templateFor(actor.templateId)!;
  const attachments = frame.attachments?.filter(item => item.actorId === 'chenxiang').map(item => item.attachmentId) ?? [];
  const stage = { ...frame.stage, puppetDistance: completion.kind === 'light' ? .4 : frame.stage.puppetDistance };
  const fit = (pose: Pose) => constrainPoseToStage(pose, template, stage, attachments);
  const candidateFrame = (pose: Pose): CanvasFrame => ({ ...frame, stage,
    actors: frame.actors.map(item => item.actorId === 'chenxiang' ? { ...item, pose } : item) });
  const result = (pose: Pose): InteractionGoal => ({ pose: clone(pose), stage: { lampX: stage.lampX, puppetDistance: stage.puppetDistance } });
  if (completion.kind === 'axe') {
    const pose = clone(actor.pose);
    pose.joints.rightShoulder = (completion.raisedAngleRange[0] + completion.raisedAngleRange[1]) / 2;
    const fitted = fit(pose);
    return fitted.fits && withinAngleRange(fitted.pose.joints.rightShoulder, completion.raisedAngleRange) ? result(fitted.pose) : null;
  }
  if (completion.kind === 'reach') {
    const hands = handPoints(frame);
    if (!hands) return null;
    let pose = clone(actor.pose);
    // Align the root first, then solve the actual right-hand rod connection in local coordinates.
    const magnification = projectionParameters(stage).magnification;
    pose.x += (hands.mother.x - hands.chenxiang.x) / magnification / WORLD_WIDTH;
    pose.y -= (hands.mother.y - hands.chenxiang.y) / magnification / WORLD_HEIGHT;
    pose = fit(pose).pose;
    pose = solveArm(template, pose, 'right', screenToLocalPoint(hands.mother, pose, stage));
    const fitted = fit(pose), finalHands = handPoints(candidateFrame(fitted.pose));
    return fitted.fits && finalHands && handDistanceRatio(finalHands.chenxiang, finalHands.mother) <= completion.maxDistanceRatio
      ? result(fitted.pose) : null;
  }
  const kind = completion.kind;
  if (kind !== 'wave' && kind !== 'road' && kind !== 'block' && kind !== 'light') return null;
  const shoulderAngles = kind === 'wave' || kind === 'block' || (kind==='light'&&completion.region==='lantern') ? [actor.pose.joints.rightShoulder, .6, 1, 1.4, 1.8, -.6, -1.2] : [actor.pose.joints.rightShoulder];
  const elbowAngles = kind === 'wave' || kind === 'block' || (kind==='light'&&completion.region==='lantern') ? [actor.pose.joints.rightElbow, .6, 1.2, 1.8, 2.4] : [actor.pose.joints.rightElbow];
  let blockGoal:InteractionGoal|null=null,blockCost=Infinity;
  for (const shoulder of shoulderAngles) for (const elbow of elbowAngles) {
    const pose = clone(actor.pose); pose.joints.rightShoulder = shoulder; pose.joints.rightElbow = elbow;
    const observed = region(candidateFrame(pose), kind, completion.kind==='light'?completion.region:undefined);
    if (!observed) continue;
    if (kind !== 'wave') {
      const magnification = projectionParameters(stage).magnification;
      pose.x += ((target.minX + target.maxX) - (observed.minX + observed.maxX)) / 2 / magnification / WORLD_WIDTH;
      pose.y -= ((target.minY + target.maxY) - (observed.minY + observed.maxY)) / 2 / magnification / WORLD_HEIGHT;
    }
    const fitted = fit(pose), finalRegion = region(candidateFrame(fitted.pose), kind, completion.kind==='light'?completion.region:undefined);
    // The first lesson exposes only the hand rod. A demonstration must obey that same input boundary.
    if (kind === 'wave' && (fitted.pose.x !== actor.pose.x || fitted.pose.y !== actor.pose.y || fitted.pose.scale !== actor.pose.scale)) continue;
    if (fitted.fits && finalRegion && targetCoverageRatio(finalRegion, target) >= completion.overlapRatio){
      if(kind!=='block')return result(fitted.pose);
      const cost=Math.hypot(fitted.pose.x-actor.pose.x,fitted.pose.y-actor.pose.y)*10+Math.abs(fitted.pose.joints.rightShoulder-1.2)*.03;
      if(cost<blockCost){blockCost=cost;blockGoal=result(fitted.pose);}
    }
  }
  return blockGoal;
}
