import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../../src/content/catalog';
import type { Bounds, PuppetTemplate } from '../../src/content/asset-types';
import { defaultPose } from '../../src/domain/defaults';
import { JOINT_IDS } from '../../src/domain/limits';
import { actorLocalBounds, attachmentTransform, constrainPose, constrainPoseToStage, jointTransform, partTransform,
  projectedPoseBounds, rodPoint, solveArm, transformPoint } from '../../src/domain/pose';
import { projectLocalPoint, screenToLocalPoint } from '../../src/domain/projection';
import type { Point } from '../../src/domain/projection';
import type { Pose, StageConfig } from '../../src/domain/types';

const chenxiang = assetCatalog.puppets.find((item) => item.id === 'chenxiang-v1')!;
const stage: StageConfig = { backgroundId: 'plain-v1', lampX: 0, puppetDistance: 0.2 };
function copy(template = chenxiang): PuppetTemplate { return JSON.parse(JSON.stringify(template)) as PuppetTemplate; }
function closePoint(actual: Point, expected: Point, precision = 9): void {
  expect(actual.x).toBeCloseTo(expected.x, precision); expect(actual.y).toBeCloseTo(expected.y, precision);
}
function within(bounds: Bounds, margin = 0.04): void {
  expect(bounds.minX).toBeGreaterThanOrEqual(-1 + margin - 1e-8);
  expect(bounds.maxX).toBeLessThanOrEqual(1 - margin + 1e-8);
  expect(bounds.minY).toBeGreaterThanOrEqual(-0.75 + margin - 1e-8);
  expect(bounds.maxY).toBeLessThanOrEqual(0.75 - margin + 1e-8);
}
function finiteAndLegal(pose: Pose, template: PuppetTemplate): void {
  expect(pose.scale).toBeGreaterThanOrEqual(0.6); expect(pose.scale).toBeLessThanOrEqual(1);
  for (const id of JOINT_IDS) {
    const joint = template.joints.find((item) => item.jointId === id)!;
    expect(Number.isFinite(pose.joints[id])).toBe(true);
    if (!joint.enabled) expect(pose.joints[id]).toBe(0);
    else {
      expect(pose.joints[id]).toBeGreaterThanOrEqual(joint.minRad);
      expect(pose.joints[id]).toBeLessThanOrEqual(joint.maxRad);
    }
  }
}

describe('posed template transforms', () => {
  it('clamps all nine joints and root fields without mutating the source', () => {
    const pose = defaultPose(); pose.x = NaN; pose.y = 20; pose.scale = 50;
    pose.joints.leftElbow = -20; pose.joints.rightShoulder = Infinity;
    const bounded = constrainPose(pose, chenxiang);
    expect(bounded.x).toBe(0.5); expect(bounded.y).toBe(1); expect(bounded.scale).toBe(1);
    expect(bounded.joints.leftElbow).toBe(-2.4); expect(bounded.joints.rightShoulder).toBe(0);
    expect(pose.joints.leftElbow).toBe(-20);
    for (const template of assetCatalog.puppets) finiteAndLegal(constrainPose(pose, template), template);
  });

  it('uses hierarchy anchors and parent/rest angles rather than neutral positions', () => {
    const template = copy(); const shoulder = template.joints.find((item) => item.jointId === 'rightShoulder')!;
    shoulder.restAngleRad = 0.2;
    const pose = defaultPose(); pose.joints.rightShoulder = Math.PI / 2 - 0.2; pose.joints.rightElbow = 0.3;
    const elbow = jointTransform(template, pose, 'rightElbow');
    closePoint(elbow, { x: 0.255, y: 0.24 }); expect(elbow.angle).toBeCloseTo(Math.PI / 2 + 0.3);
    expect(jointTransform(template, pose, null)).toEqual({ x: 0, y: 0, angle: 0 });
  });

  it('keeps arbitrary bitmap pivots fixed at their bound joint and rotates around them', () => {
    const template = copy(); const part = template.parts.find((item) => item.partId === 'rightForearm')!;
    part.pivot = [0.1, -0.03]; part.bindAngleRad = 0.4;
    const pose = defaultPose(); pose.joints.rightShoulder = 0.7; pose.joints.rightElbow = 0.5;
    const transform = partTransform(template, pose, part);
    closePoint(transformPoint({ x: part.pivot[0], y: part.pivot[1] }, transform), jointTransform(template, pose, 'rightElbow'));
    expect(transform.angle).toBeCloseTo(1.6);
  });

  it('places attachment pivots on posed host anchors including host and attachment bind angles', () => {
    const template = copy(); const attachment = template.attachments[0]!;
    attachment.anchor = [0.04, -0.12]; attachment.pivot = [0.03, 0.02]; attachment.bindAngleRad = -0.2;
    const host = template.parts.find((item) => item.partId === attachment.partId)!;
    host.bindAngleRad = 0.3; host.pivot = [0.02, 0.01];
    const pose = defaultPose(); pose.joints.rightShoulder = 0.8; pose.joints.rightElbow = 0.6;
    const transform = attachmentTransform(template, pose, attachment);
    const anchor = transformPoint({ x: 0.04, y: -0.12 }, partTransform(template, pose, host));
    closePoint(transformPoint({ x: 0.03, y: 0.02 }, transform), anchor);
    expect(transform.angle).toBeCloseTo(1.5);
  });

  it('does not mirror skeleton or bend signs when facing changes', () => {
    const pose = defaultPose(); pose.joints.leftShoulder = -0.4; pose.joints.leftElbow = -0.8;
    expect(rodPoint(chenxiang, pose, 'leftHand')).toEqual(rodPoint(chenxiang, { ...pose, facing: -1 }, 'leftHand'));
    const point = rodPoint(chenxiang, pose, 'leftHand');
    const projected = projectLocalPoint(point, { ...pose, facing: -1 }, { ...stage, lampX: 0.8 });
    closePoint(screenToLocalPoint(projected, { ...pose, facing: -1 }, { ...stage, lampX: 0.8 }), point);
  });

  it('rejects missing rods and cyclic or missing joint chains clearly', () => {
    expect(() => rodPoint(chenxiang, defaultPose(), 'unknown')).toThrow('Missing puppet rod');
    const template = copy(); template.joints[0]!.parentJoint = 'head';
    expect(() => jointTransform(template, defaultPose(), 'head')).toThrow('Cyclic');
    template.joints = [];
    expect(() => jointTransform(template, defaultPose(), 'head')).toThrow('Missing puppet joint');
  });
});

describe('two-bone arm targets', () => {
  it('reaches actual local hand targets for both down-pointing arm chains', () => {
    for (const side of ['left', 'right'] as const) {
      const reference = defaultPose();
      reference.joints[`${side}Shoulder`] = side === 'left' ? -0.8 : 0.8;
      reference.joints[`${side}Elbow`] = side === 'left' ? -0.6 : 0.6;
      const target = rodPoint(chenxiang, reference, `${side}Hand`);
      const solved = solveArm(chenxiang, defaultPose(), side, target);
      closePoint(rodPoint(chenxiang, solved, `${side}Hand`), target);
      expect(Math.sign(solved.joints[`${side}Elbow`])).toBe(side === 'left' ? -1 : 1);
    }
  });

  it('accounts for shoulder and elbow rest angles in stored joint values', () => {
    const template = copy();
    template.joints.find((item) => item.jointId === 'rightShoulder')!.restAngleRad = 0.2;
    template.joints.find((item) => item.jointId === 'rightElbow')!.restAngleRad = 0.15;
    const reference = defaultPose(); reference.joints.rightShoulder = 0.7; reference.joints.rightElbow = 0.65;
    const target = rodPoint(template, reference, 'rightHand');
    const solved = solveArm(template, defaultPose(), 'right', target);
    closePoint(rodPoint(template, solved, 'rightHand'), target);
    expect(solved.joints.rightShoulder).toBeCloseTo(0.7); expect(solved.joints.rightElbow).toBeCloseTo(0.65);
  });

  it('solves the actual rod when the forearm bitmap has a nonzero pivot and bind angle', () => {
    const template = copy(); const forearm = template.parts.find((item) => item.partId === 'rightForearm')!;
    forearm.pivot = [0.01, 0.02]; forearm.bindAngleRad = 0.2;
    const reference = defaultPose(); reference.joints.rightShoulder = 0.7; reference.joints.rightElbow = 0.65;
    const target = rodPoint(template, reference, 'rightHand');
    closePoint(rodPoint(template, solveArm(template, defaultPose(), 'right', target), 'rightHand'), target);
  });

  it('handles coincident, full-extension, unreachable and invalid targets without NaN', () => {
    for (const template of assetCatalog.puppets) for (const arm of template.arms) {
      const origin = jointTransform(template, defaultPose(), arm.shoulder);
      for (const target of [{ x: origin.x, y: origin.y }, { x: origin.x, y: origin.y - arm.upperLength - arm.lowerLength },
        { x: origin.x + 20, y: origin.y - 30 }, { x: NaN, y: Infinity }]) {
        const solved = solveArm(template, defaultPose(), arm.side, target);
        finiteAndLegal(solved, template);
        const hand = rodPoint(template, solved, `${arm.side}Hand`);
        expect(Number.isFinite(hand.x) && Number.isFinite(hand.y)).toBe(true);
      }
    }
  });

  it('preserves the local IK branch after mirrored screen-space target conversion', () => {
    const reference = defaultPose(); reference.joints.leftShoulder = -0.6; reference.joints.leftElbow = -0.9;
    const target = rodPoint(chenxiang, reference, 'leftHand');
    for (const facing of [-1, 1] as const) for (const scale of [0.6, 1]) {
      const pose = { ...defaultPose(), facing, scale, x: 0.3, y: 0.6 };
      const config = { ...stage, lampX: -0.8, puppetDistance: 0.4 };
      const recovered = screenToLocalPoint(projectLocalPoint(target, pose, config), pose, config);
      const solved = solveArm(chenxiang, pose, 'left', recovered);
      closePoint(rodPoint(chenxiang, solved, 'leftHand'), target);
      expect(solved.facing).toBe(facing); expect(solved.scale).toBe(scale);
    }
  });

  it('clamps limited joints and leaves absent scripted arms at zero', () => {
    const pose = defaultPose(); pose.joints.rightShoulder = 20;
    const solved = solveArm(chenxiang, pose, 'right', { x: -50, y: 100 });
    finiteAndLegal(solved, chenxiang);
    const guardian = assetCatalog.puppets.find((item) => item.id === 'guardian-v1')!;
    const fixed = solveArm(guardian, pose, 'left', { x: 1, y: 1 });
    expect(fixed.joints.leftShoulder).toBe(0); expect(fixed.joints.leftElbow).toBe(0);
    expect(pose.joints.rightShoulder).toBe(20);
  });
});

describe('actual posed bounds and curtain constraints', () => {
  it('grows beyond the neutral box for a raised arm and explicitly visible axe', () => {
    const pose = defaultPose(); pose.joints.rightShoulder = 1.7; pose.joints.rightElbow = 0.8;
    const neutral = actorLocalBounds(chenxiang, defaultPose());
    const raised = actorLocalBounds(chenxiang, pose);
    const axe = actorLocalBounds(chenxiang, pose, ['axe']);
    expect(raised.maxX).toBeGreaterThan(neutral.maxX + 0.1);
    expect(axe.maxX).toBeGreaterThan(raised.maxX);
    expect(actorLocalBounds(chenxiang, pose, [])).toEqual(raised);
  });

  it('recalculates projected bounds after root mirror, scale, lamp and distance changes', () => {
    const pose = defaultPose(); pose.joints.rightShoulder = 1.7; pose.joints.rightElbow = 0.8;
    const right = projectedPoseBounds(chenxiang, { ...pose, x: 0.5, y: 0.5 }, stage, ['axe']);
    const left = projectedPoseBounds(chenxiang, { ...pose, x: 0.5, y: 0.5, facing: -1 }, stage, ['axe']);
    expect(left.minX).toBeCloseTo(-right.maxX); expect(left.maxX).toBeCloseTo(-right.minX);
    const scaled = projectedPoseBounds(chenxiang, { ...pose, x: 0.5, y: 0.5, scale: 1 }, stage, ['axe']);
    expect(scaled.maxX - scaled.minX).toBeCloseTo((right.maxX - right.minX) / 0.8);
    const far = projectedPoseBounds(chenxiang, { ...pose, x: 0.5, y: 0.5 }, { ...stage, lampX: 0.8, puppetDistance: 0.4 }, ['axe']);
    expect(far.maxY - far.minY).toBeGreaterThan(right.maxY - right.minY);
    expect(far.minX).toBeLessThan(right.minX);
  });

  it('keeps all three actors, extreme lamps, raised limbs and props inside the curtain', () => {
    for (const template of assetCatalog.puppets) for (const facing of [-1, 1] as const) for (const lampX of [-0.8, 0.8]) {
      const pose = defaultPose(); pose.x = lampX < 0 ? 1 : 0; pose.y = 0; pose.scale = 1; pose.facing = facing;
      for (const joint of template.joints) pose.joints[joint.jointId] = joint.maxRad;
      const result = constrainPoseToStage(pose, template, { ...stage, lampX, puppetDistance: 0.4 }, template.attachments.map((item) => item.id));
      expect(result.fits).toBe(true); within(result.bounds); finiteAndLegal(result.pose, template);
    }
  });

  it('only translates a fitting silhouette and is stable on repeated constraints', () => {
    const pose = { ...defaultPose(), x: 1, y: 1 };
    const result = constrainPoseToStage(pose, chenxiang, stage);
    expect(result.fits).toBe(true); within(result.bounds); expect(result.pose.scale).toBe(pose.scale);
    const again = constrainPoseToStage(result.pose, chenxiang, stage);
    expect(again.pose.x).toBeCloseTo(result.pose.x, 12); expect(again.pose.y).toBeCloseTo(result.pose.y, 12);
    expect(pose.x).toBe(1); expect(pose.y).toBe(1);
  });

  it('reports an oversized silhouette explicitly and preserves the legal minimum scale', () => {
    const template = copy(); template.parts[0]!.bounds = { minX: -4, maxX: 4, minY: -3, maxY: 3 };
    const result = constrainPoseToStage(defaultPose(), template, { ...stage, lampX: 0.8, puppetDistance: 0.4 });
    expect(result.fits).toBe(false); expect(result.pose.scale).toBe(0.6);
    expect((result.bounds.minX + result.bounds.maxX) / 2).toBeCloseTo(0);
    expect((result.bounds.minY + result.bounds.maxY) / 2).toBeCloseTo(0);
    finiteAndLegal(result.pose, template);
  });
});
