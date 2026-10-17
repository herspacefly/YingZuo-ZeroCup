import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../../src/content/catalog';
import type { PuppetTemplate } from '../../src/content/asset-types';
import actionContent from '../../src/content/actions.json';
import { actionDefinitions, sampleAction } from '../../src/domain/actions';
import type { ActionId, ActionSample } from '../../src/domain/actions';
import { defaultPose } from '../../src/domain/defaults';
import { PRESET_IDS } from '../../src/domain/limits';
import { projectedPoseBounds, rodPoint } from '../../src/domain/pose';
import type { Pose, StageConfig } from '../../src/domain/types';

const template = assetCatalog.puppets.find((puppet) => puppet.id === 'chenxiang-v1')!;
const stage: StageConfig = { backgroundId: 'plain-v1', lampX: 0, puppetDistance: 0.2 };
function copyTemplate(): PuppetTemplate { return JSON.parse(JSON.stringify(template)) as PuppetTemplate; }
function legal(sample: ActionSample, puppet = template): void {
  for (const joint of puppet.joints) {
    const angle = sample.pose.joints[joint.jointId];
    expect(Number.isFinite(angle)).toBe(true);
    expect(angle).toBeGreaterThanOrEqual(joint.enabled ? joint.minRad : 0);
    expect(angle).toBeLessThanOrEqual(joint.enabled ? joint.maxRad : 0);
  }
  expect(sample.pose.scale).toBeGreaterThanOrEqual(0.6); expect(sample.pose.scale).toBeLessThanOrEqual(1);
  expect(sample.pose.x).toBeGreaterThanOrEqual(0); expect(sample.pose.x).toBeLessThanOrEqual(1);
  expect(sample.pose.y).toBeGreaterThanOrEqual(0); expect(sample.pose.y).toBeLessThanOrEqual(1);
  if (sample.fits) {
    expect(sample.bounds.minX).toBeGreaterThanOrEqual(-0.96 - 1e-8);
    expect(sample.bounds.maxX).toBeLessThanOrEqual(0.96 + 1e-8);
    expect(sample.bounds.minY).toBeGreaterThanOrEqual(-0.71 - 1e-8);
    expect(sample.bounds.maxY).toBeLessThanOrEqual(0.71 + 1e-8);
  }
}

describe('versioned absolute-time actions', () => {
  it('keeps exactly the five persisted IDs, finite ordered timing and only the explicit axe prop', () => {
    expect(actionDefinitions.map((action) => action.id)).toEqual([...PRESET_IDS]);
    expect(actionContent.version).toBe(1); expect(actionContent.timeUnit).toBe('ms'); expect(actionContent.angleUnit).toBe('rad');
    for (const action of actionContent.actions) {
      expect(action.keyframes[0]!.atMs).toBe(0);
      expect(action.keyframes[action.keyframes.length - 1]!.atMs).toBe(action.durationMs);
      expect(Number.isFinite(action.durationMs) && action.durationMs > 0).toBe(true);
      expect(action.attachmentIds).toEqual(action.id === 'raise-axe-v1' ? ['axe'] : []);
      for (let i = 1; i < action.keyframes.length; i++) {
        expect(action.keyframes[i]!.atMs).toBeGreaterThan(action.keyframes[i - 1]!.atMs);
      }
    }
    expect(Object.isFrozen(actionDefinitions)).toBe(true);
    expect(Object.isFrozen(actionDefinitions[0]!.attachmentIds)).toBe(true);
  });

  it('is independent of render cadence, call order and pause/resume sampling', () => {
    const base = defaultPose();
    for (const action of actionDefinitions) {
      const reference = sampleAction(action.id, base, 1000, template, stage);
      for (const rate of [60, 120]) {
        for (let index = 0; index < rate; index++) sampleAction(action.id, base, index * 1000 / rate, template, stage);
        expect(sampleAction(action.id, base, 1000, template, stage)).toEqual(reference);
      }
      sampleAction(action.id, base, action.durationMs, template, stage);
      expect(sampleAction(action.id, base, 1000, template, stage)).toEqual(reference);
      expect(sampleAction(action.id, base, 1000, template, stage)).toEqual(reference);
    }
  });

  it('starts from the captured base and never mutates caller pose, stage, template or content', () => {
    const base = defaultPose(); base.joints.rightShoulder = 0.25;
    const before = JSON.stringify({ base, stage, template, actionContent });
    for (const action of actionDefinitions) {
      const initial = sampleAction(action.id, base, 0, template, stage);
      expect(initial.pose).toEqual(base); expect(initial.finished).toBe(false);
      sampleAction(action.id, base, 1100, template, stage);
    }
    expect(JSON.stringify({ base, stage, template, actionContent })).toBe(before);
  });

  it('returns independent pose, joints, bbox and attachment copies on every sample', () => {
    const first = sampleAction('raise-axe-v1', defaultPose(), 1000, template, stage);
    const original = sampleAction('raise-axe-v1', defaultPose(), 1000, template, stage);
    first.pose.x = 0; first.pose.joints.head = 20; first.bounds.minX = -20; first.attachmentIds.push('fake');
    expect(sampleAction('raise-axe-v1', defaultPose(), 1000, template, stage)).toEqual(original);
  });

  it('clamps negative and invalid time, holds the last frame and rejects unknown IDs', () => {
    for (const action of actionDefinitions) {
      const initial = sampleAction(action.id, defaultPose(), 0, template, stage);
      for (const time of [-1, -Infinity, NaN]) expect(sampleAction(action.id, defaultPose(), time, template, stage)).toEqual(initial);
      const final = sampleAction(action.id, defaultPose(), action.durationMs, template, stage);
      expect(final.finished).toBe(true); expect(final.elapsedMs).toBe(action.durationMs);
      for (const time of [action.durationMs + 1, Number.MAX_VALUE, Infinity]) {
        expect(sampleAction(action.id, defaultPose(), time, template, stage)).toEqual(final);
      }
    }
    expect(() => sampleAction('unknown' as ActionId, defaultPose(), 0, template, stage)).toThrow('Unknown action');
  });

  it('has visible distinct wave, walk, bow, axe preparation/landing and reach poses', () => {
    const base = defaultPose();
    const waveA = sampleAction('wave-v1', base, 800, template, stage);
    const waveB = sampleAction('wave-v1', base, 1100, template, stage);
    const firstHand = rodPoint(template, waveA.pose, 'rightHand'); const secondHand = rodPoint(template, waveB.pose, 'rightHand');
    expect(Math.sqrt((firstHand.x - secondHand.x) ** 2 + (firstHand.y - secondHand.y) ** 2)).toBeGreaterThan(0.05);
    expect(firstHand.y).toBeGreaterThan(rodPoint(template, base, 'rightHand').y + 0.3);
    const walk = sampleAction('walk-v1', base, 400, template, stage);
    expect(walk.pose.joints.leftHip * walk.pose.joints.rightHip).toBeLessThan(0);
    expect(sampleAction('walk-v1', base, 3200, template, stage).pose.x).toBeGreaterThan(base.x + 0.1);
    const bow = sampleAction('bow-v1', base, 1000, template, stage);
    expect(bow.pose.joints.head).toBeLessThan(-0.3); expect(bow.pose.y).toBeGreaterThan(base.y);
    expect(sampleAction('bow-v1', base, 2200, template, stage).pose).toEqual(base);
    const axe = sampleAction('raise-axe-v1', base, 700, template, stage);
    expect(sampleAction('raise-axe-v1', base, 1300, template, stage).pose).toEqual(axe.pose);
    expect(axe.pose.joints.rightShoulder).toBeGreaterThan(1.2);
    expect(sampleAction('raise-axe-v1', base, 1800, template, stage).pose.joints.rightShoulder).toBeLessThan(-0.5);
    const reach = sampleAction('reach-v1', base, 1800, template, stage);
    expect(reach.pose.joints.rightElbow).toBeLessThan(0.2);
    expect(rodPoint(template, reach.pose, 'rightHand').x).toBeGreaterThan(0.35);
    expect(new Set([waveA, walk, bow, axe, reach].map((sample) => JSON.stringify(sample.pose.joints))).size).toBe(5);
  });

  it('moves root x in captured facing and mirrors the same local skeletal gesture exactly once', () => {
    const base = { ...defaultPose(), x: 0.5, y: 0.5, scale: 0.6 };
    const right = sampleAction('walk-v1', base, 1600, template, stage);
    const left = sampleAction('walk-v1', { ...base, facing: -1 }, 1600, template, stage);
    expect(right.pose.x - base.x).toBeCloseTo(base.x - left.pose.x, 12);
    expect(left.pose.joints).toEqual(right.pose.joints);
    expect(left.bounds.minX).toBeCloseTo(-right.bounds.maxX, 12);
    expect(left.bounds.maxX).toBeCloseTo(-right.bounds.minX, 12);
  });

  it('recomputes actual bbox with attachment, mirror, scale and extreme lamp/depth after all offsets', () => {
    for (const action of actionDefinitions) for (const facing of [-1, 1] as const) for (const scale of [0.6, 1]) {
      for (const lampX of [-0.8, 0.8]) {
        const config = { ...stage, lampX, puppetDistance: 0.4 };
        const base: Pose = { ...defaultPose(), x: facing === 1 ? 1 : 0, y: 0, facing, scale };
        for (const elapsedMs of [0, action.durationMs / 2, action.durationMs]) {
          const sampled = sampleAction(action.id, base, elapsedMs, template, config);
          legal(sampled); expect(sampled.fits).toBe(true);
          expect(sampled.bounds).toEqual(projectedPoseBounds(template, sampled.pose, config, sampled.attachmentIds));
        }
      }
    }
  });

  it('obeys customized disabled/limited joints and reports an impossible silhouette instead of claiming fit', () => {
    const puppet = copyTemplate(); puppet.joints.find((joint) => joint.jointId === 'head')!.enabled = false;
    puppet.joints.find((joint) => joint.jointId === 'rightShoulder')!.maxRad = 0.2;
    const sample = sampleAction('wave-v1', defaultPose(), 1000, puppet, stage);
    legal(sample, puppet); expect(sample.pose.joints.head).toBe(0); expect(sample.pose.joints.rightShoulder).toBe(0.2);
    puppet.parts[0]!.bounds = { minX: -4, minY: -3, maxX: 4, maxY: 3 };
    const tooLarge = sampleAction('reach-v1', defaultPose(), 900, puppet, stage);
    expect(tooLarge.fits).toBe(false); expect(tooLarge.pose.scale).toBe(0.6); legal(tooLarge, puppet);
  });

  it('does not silently play an axe action on a template without its attachment', () => {
    const puppet = copyTemplate(); puppet.attachments = [];
    expect(() => sampleAction('raise-axe-v1', defaultPose(), 1000, puppet, stage)).toThrow('missing attachment: axe');
    expect(sampleAction('reach-v1', defaultPose(), 1000, puppet, stage).attachmentIds).toEqual([]);
  });
});
