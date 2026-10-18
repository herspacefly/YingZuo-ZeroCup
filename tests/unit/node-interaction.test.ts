import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../../src/content/catalog';
import { reunionDefinition } from '../../src/content/reunion';
import { projectedPoseBounds, rodPoint } from '../../src/domain/pose';
import { projectLocalPoint } from '../../src/domain/projection';
import { storyEntry } from '../../src/domain/story';
import type { StoryNodeId } from '../../src/domain/types';
import type { CanvasFrame } from '../../src/renderers/canvas/types';
import { createSceneDirector } from '../../src/story/director';
import { handDistanceRatio, normalizedTargetBounds, targetCoverageRatio } from '../../src/story/interactions';
import { createNodeInteraction, interactionGoal, interactionHandPoints, projectedInteractionRegion } from '../../src/story/node-interaction';
import { at } from '../helpers/story';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function fixture(id: StoryNodeId = 'call-light') {
  const node = reunionDefinition.nodes.find(item => item.id === id)!;
  const project = at(id, id.startsWith('split-') ? 'split-first' : 'call-first');
  const director = createSceneDirector(project, storyEntry(project, reunionDefinition, 1));
  const frame = director.sample(0).frame;
  return { node, director, frame, observer: createNodeInteraction(node) };
}
function reachable(id: StoryNodeId) {
  const data = fixture(id), goal = interactionGoal(data.node, data.frame);
  expect(goal, id).not.toBeNull();
  return { ...data, goal: goal!, frame: data.director.sample(0, { chenxiangPose: goal!.pose, stage: goal!.stage }).frame };
}
function raisedFixture() {
  const data = reachable('split-axe');
  for (let time = 0; time <= 500; time += 100) data.observer.observe(data.frame, time, false, true);
  return data;
}
const interactionIds = ['memory-wave', 'road', 'guardian', 'call-light', 'call-split', 'split-axe', 'split-search', 'reunion-reach'] as const;

describe('actual projected interaction geometry', () => {
  it('uses the torso motif placement for light, independently of both arms and motif bitmap choice', () => {
    const { frame } = fixture('call-light');
    const region = projectedInteractionRegion(frame, 'light')!;
    const placement=assetCatalog.puppets.find(t=>t.id==='chenxiang-v1')!.motifPlacement!.bounds;
    expect(region.maxX - region.minX).toBeCloseTo((placement.maxX-placement.minX) * .8 * 1.2, 12);
    expect(region.maxY - region.minY).toBeCloseTo((placement.maxY-placement.minY) * .8 * 1.2, 12);
    const changed = clone(frame), chenxiang = changed.actors.find(actor => actor.actorId === 'chenxiang')!;
    chenxiang.pose.joints.rightShoulder = 1.2; chenxiang.pose.joints.rightElbow = 1.8;
    chenxiang.pose.joints.leftShoulder = -1.2;
    for (const patternId of ['cloud-v1', 'wave-v1', 'flower-v1'] as const) {
      if (chenxiang.actorId === 'chenxiang') chenxiang.appearance.patternId = patternId;
      expect(projectedInteractionRegion(changed, 'light')).toEqual(region);
    }
    expect(projectedInteractionRegion(changed, 'road')).not.toEqual(projectedInteractionRegion(frame, 'road'));
  });

  it('wave and block share only the right upper-arm/forearm union; unrelated limbs do not expand it', () => {
    const { frame } = fixture('memory-wave'), original = projectedInteractionRegion(frame, 'wave');
    expect(projectedInteractionRegion(frame, 'block')).toEqual(original);
    const changed = clone(frame), pose = changed.actors[0]!.pose;
    pose.joints.leftShoulder = -1.8; pose.joints.leftElbow = -2.4; pose.joints.head = .4;
    expect(projectedInteractionRegion(changed, 'wave')).toEqual(original);
    pose.joints.rightShoulder = 1.2;
    expect(projectedInteractionRegion(changed, 'wave')).not.toEqual(original);
  });

  it('road includes the actual visible attachment, not the neutral template envelope', () => {
    const { frame } = fixture('split-axe'), template = assetCatalog.puppets.find(item => item.id === 'chenxiang-v1')!;
    frame.actors[0]!.pose.joints.rightShoulder=1.2; // Expose the axe beyond the new trailing costume.
    const pose = frame.actors[0]!.pose;
    expect(projectedInteractionRegion(frame, 'road')).toEqual(projectedPoseBounds(template, pose, frame.stage, ['axe']));
    const bare = clone(frame); bare.attachments = [];
    expect(projectedInteractionRegion(bare, 'road')).toEqual(projectedPoseBounds(template, pose, frame.stage, []));
    expect(projectedInteractionRegion(bare, 'road')).not.toEqual(projectedInteractionRegion(frame, 'road'));
  });

  it('uses each real right-hand rod point through its part transform, root, facing and light projection', () => {
    const { frame } = fixture('reunion-reach'), points = interactionHandPoints(frame)!;
    for (const id of ['chenxiang', 'mother'] as const) {
      const actor = frame.actors.find(item => item.actorId === id)!, template = assetCatalog.puppets.find(item => item.id === actor.templateId)!;
      expect(points[id]).toEqual(projectLocalPoint(rodPoint(template, actor.pose, 'rightHand'), actor.pose, frame.stage));
    }
    const changed = clone(frame); changed.actors[1]!.pose.joints.rightElbow = 1;
    expect(interactionHandPoints(changed)!.mother).not.toEqual(points.mother);
    changed.actors.pop(); expect(interactionHandPoints(changed)).toBeNull();
  });

  it('conservatively rejects malformed and nonfinite drawing observations without repairing them', () => {
    const { frame, observer } = fixture();
    const invalid: CanvasFrame[] = [];
    for (const mutate of [
      (value: CanvasFrame) => { value.stage.lampX = NaN; },
      (value: CanvasFrame) => { value.stage.puppetDistance = .41; },
      (value: CanvasFrame) => { value.actors[0]!.pose.x = Infinity; },
      (value: CanvasFrame) => { value.actors[0]!.pose.scale = 0; },
      (value: CanvasFrame) => { value.actors[0]!.pose.joints.rightShoulder = NaN; },
      (value: CanvasFrame) => { value.actors[0]!.pose.joints.rightElbow = -1; },
      (value: CanvasFrame) => { value.actors.push(value.actors[0]!); },
      (value: CanvasFrame) => { value.actors[1] = value.actors[0]!; },
      (value: CanvasFrame) => { Object.assign(value.actors[1]!, { templateId: 'chenxiang-v1' }); },
      (value: CanvasFrame) => { Object.assign(value.actors[1]!, { appearance: frame.actors[0] }); },
    ]) { const value = clone(frame); mutate(value); invalid.push(value); }
    invalid.push(null as unknown as CanvasFrame, { actors: [] } as unknown as CanvasFrame);
    for (const value of invalid) {
      expect(projectedInteractionRegion(value, 'light')).toBeNull();
      expect(interactionHandPoints(value)).toBeNull();
      expect(observer.observe(value, 100, false, true).evidence).toBeNull();
    }
  });
});

describe('legal reachability under the final director constraints', () => {
  it('demonstrates why distance .2 is too small and distance .4 makes both light targets reachable for all three motifs', () => {
    for (const id of ['call-light', 'split-search'] as const) for (const patternId of ['cloud-v1', 'wave-v1', 'flower-v1'] as const) {
      const data = reachable(id), region = projectedInteractionRegion(data.frame, 'light')!;
      const actor = data.frame.actors.find(item => item.actorId === 'chenxiang')!;
      if (actor.actorId === 'chenxiang') actor.appearance.patternId = patternId;
      expect(data.goal.pose.scale).toBe(.8); expect(data.goal.stage.puppetDistance).toBe(.4);
      const target = normalizedTargetBounds(data.node.completion.kind === 'light' ? data.node.completion.target : { x: 0, y: 0, width: 1, height: 1 })!;
      const placement=assetCatalog.puppets.find(t=>t.id==='chenxiang-v1')!.motifPlacement!.bounds;
      const areaAtEntryDistance = (placement.maxX-placement.minX) * (placement.maxY-placement.minY) * (.8 * 1.2) ** 2;
      const targetArea = (target.maxX - target.minX) * (target.maxY - target.minY);
      expect(areaAtEntryDistance / targetArea).toBeLessThan(.35);
      expect(targetCoverageRatio(region, target)).toBeCloseTo(areaAtEntryDistance / targetArea * (1.5/1.2)**2, 10);
      expect(targetCoverageRatio(region, target)).toBeGreaterThanOrEqual(.35);
      expect(projectedInteractionRegion(data.frame, 'light')).toEqual(region);
      for (let time = 0; time <= 600; time += 100) data.observer.observe(data.frame, time, false, true);
      expect(data.observer.observe(data.frame, 600, false, true).evidence).toMatchObject({ kind: 'light', heldMs: 600 });
    }
  });

  for (const id of ['memory-wave', 'road', 'guardian'] as const) it(`${id}: a legal manual pose reaches its real region and earns 300 ms`, () => {
    const { node, frame, observer, goal } = reachable(id);
    expect(goal.pose.scale).toBe(.8);
    const kind = node.completion.kind;
    if (kind !== 'wave' && kind !== 'road' && kind !== 'block') throw new Error('fixture');
    const actual = targetCoverageRatio(projectedInteractionRegion(frame, kind)!, normalizedTargetBounds(node.completion.target)!);
    expect(actual).toBeGreaterThanOrEqual(.35);
    for (let time = 0; time < 300; time += 100) expect(observer.observe(frame, time, false, true).evidence).toBeNull();
    expect(observer.observe(frame, 300, false, true).evidence).toMatchObject({ kind, heldMs: 300, overlapRatio: actual });
  });

  it('the first wave lesson is reachable using only the right hand while keeping its entry root and light fixed', () => {
    const data = reachable('memory-wave'), entry = fixture('memory-wave').frame;
    expect(data.goal.pose).toMatchObject({ x: .32, y: .68, scale: .8, facing: 1 });
    expect(data.goal.stage).toEqual({ lampX: 0, puppetDistance: .2 });
    for (const actor of entry.actors) {
      const actual = data.frame.actors.find(item => item.actorId === actor.actorId)!;
      if (actor.actorId !== 'chenxiang') { expect(actual).toEqual(actor); continue; }
      for (const id of Object.keys(actor.pose.joints) as (keyof typeof actor.pose.joints)[]) {
        if (id !== 'rightShoulder' && id !== 'rightElbow') expect(actual.pose.joints[id]).toBe(actor.pose.joints[id]);
      }
    }
    const pose = clone(entry.actors[0]!.pose); pose.joints.rightShoulder = 1.8; pose.joints.rightElbow = .52;
    const frame = data.director.sample(0, { chenxiangPose: pose }).frame;
    expect(frame.actors[0]!.pose).toEqual(pose);
    const target = normalizedTargetBounds(data.node.completion.kind === 'wave' ? data.node.completion.target : { x: 0, y: 0, width: 1, height: 1 })!;
    expect(targetCoverageRatio(projectedInteractionRegion(frame, 'wave')!, target)).toBeGreaterThanOrEqual(.35);
  });

  it('reaches the actual mother hand without altering her pose or snapping either actor', () => {
    const { frame, goal, observer } = reachable('reunion-reach');
    expect(frame.actors[1]).toEqual(fixture('reunion-reach').frame.actors[1]);
    const points = interactionHandPoints(frame)!;
    expect(handDistanceRatio(points.chenxiang, points.mother)).toBeLessThanOrEqual(.04);
    const before = clone(frame);
    expect(observer.observe(frame, 0, false, false).evidence).toBeNull();
    expect(observer.observe(frame, 16, false, true).evidence).toMatchObject({ kind: 'reach' });
    expect(frame).toEqual(before); expect(goal.pose.scale).toBe(.8);
  });

  it('solves the real animated mother hand after her response, through the final constrained director frame', () => {
    const data = fixture('reunion-reach');
    for (const elapsedMs of [500, 1800, 3000, 45000]) {
      const before = data.director.sample(elapsedMs).frame;
      const goal = interactionGoal(data.node, before);
      expect(goal).not.toBeNull();
      const actual = data.director.sample(elapsedMs, { chenxiangPose: goal!.pose, stage: goal!.stage }).frame;
      const hands = interactionHandPoints(actual)!;
      expect(actual.actors[1]).toEqual(before.actors[1]);
      expect(handDistanceRatio(hands.chenxiang, hands.mother)).toBeLessThanOrEqual(.04);
      expect(createNodeInteraction(data.node).observe(actual, elapsedMs, false, true).evidence).toMatchObject({ kind: 'reach' });
      if (elapsedMs >= 1800) {
        expect(before.actors[1]!.pose.joints).toMatchObject({ rightShoulder: 1.05, rightElbow: .5 });
        expect(hands.mother).toEqual(interactionHandPoints(before)!.mother);
      }
    }
  });

  it('returns independent goals and never changes a node, cast, fixed role or incoming controls', () => {
    for (const id of interactionIds) {
      const { node, frame } = fixture(id), before = clone({ node, frame });
      const goal = interactionGoal(node, frame);
      expect(goal, id).not.toBeNull();
      goal!.pose.x = 0; goal!.stage.lampX = .8;
      expect({ node, frame }).toEqual(before);
      expect(interactionGoal(node, frame)).not.toEqual(goal);
    }
    expect(interactionGoal(fixture('intro').node, fixture('intro').frame)).toBeNull();
  });
});

describe('continuous interaction observations', () => {
  it('never completes any default node by merely waiting without an operation', () => {
    for (const id of interactionIds) {
      const { frame, observer } = fixture(id);
      for (let time = 0; time <= 2000; time += 100) expect(observer.observe(frame, time, false, false).evidence, id).toBeNull();
    }
  });

  it('starts holds at zero, clears on leaving the target, and rejects pause even after completion', () => {
    const data = reachable('call-light');
    for (let time = 0; time <= 600; time += 100) data.observer.observe(data.frame, time, false, true);
    expect(data.observer.observe(data.frame, 600, false, true).phase).toBe('complete');
    expect(data.observer.observe(data.frame, 600, true, true).evidence).toBeNull();
    expect(data.observer.observe(data.frame, 700, false, true).heldMs).toBe(0);
    expect(data.observer.observe(fixture().frame, 800, false, true).phase).toBe('waiting');
    expect(data.observer.observe(data.frame, 900, false, true).heldMs).toBe(0);
    data.observer.reset(); expect(data.observer.observe(data.frame, 900, false, true).heldMs).toBe(0);
  });

  it('clears evidence on reversed, sparse and invalid clocks, invalid frames or absent operation', () => {
    for (const failure of ['reverse', 'gap', 'nan', 'infinity', 'negative', 'frame', 'operation'] as const) {
      const data = reachable('call-light');
      for (let time = 0; time <= 600; time += 100) data.observer.observe(data.frame, time, false, true);
      const time = failure === 'reverse' ? 500 : failure === 'gap' ? 851 : failure === 'nan' ? NaN :
        failure === 'infinity' ? Infinity : failure === 'negative' ? -1 : 700;
      const result = data.observer.observe(failure === 'frame' ? null as unknown as CanvasFrame : data.frame, time, false, failure !== 'operation');
      expect(result.evidence).toBeNull(); expect(result.heldMs).toBe(0);
      expect(data.observer.observe(data.frame, Number.isFinite(time) && time >= 0 ? time + 100 : 800, false, true).heldMs).toBe(0);
    }
  });

  it('observes the same held duration at 60 Hz and 120 Hz without wall-clock timers', () => {
    for (const rate of [60, 120]) {
      const data = reachable('call-light');
      for (let step = 0; step <= rate; step++) data.observer.observe(data.frame, step * 1000 / rate, false, true);
      expect(data.observer.observe(data.frame, 1000, false, true).heldMs).toBeCloseTo(1000, 10);
    }
  });

  it('requires 500 ms raised followed by a separate lowered sample; waiting never lowers an axe', () => {
    for (const id of ['call-split', 'split-axe'] as const) {
      const data = reachable(id);
      for (let time = 0; time < 500; time += 100) expect(data.observer.observe(data.frame, time, false, true).evidence).toBeNull();
      expect(data.observer.observe(data.frame, 500, false, true)).toMatchObject({ evidence: null, phase: 'raised', heldMs: 500 });
      for (let time = 600; time <= 1000; time += 100) expect(data.observer.observe(data.frame, time, false, true).evidence).toBeNull();
      const lower = clone(data.goal.pose); lower.joints.rightShoulder = 0;
      const landed = data.director.sample(0, { chenxiangPose: lower, stage: data.goal.stage }).frame;
      expect(data.observer.observe(landed, 1100, false, true).evidence).toMatchObject({ kind: 'axe', stableBody: true,
        raisedAngleRad: 1.2, raisedHoldMs: 500, landedAngleRad: 0, lowered: true });
      expect(data.observer.observe(landed, 1100, true, true).evidence).toBeNull();
    }
  });

  it('clears raised progress on pause, clock discontinuity or a body move beyond .008', () => {
    for (const failure of ['pause', 'gap', 'reverse', 'root', 'scale', 'facing'] as const) {
      const data = raisedFixture(), changed = clone(data.frame), pose = changed.actors[0]!.pose;
      if (failure === 'root') pose.x += .00801;
      if (failure === 'scale') pose.scale = .81;
      if (failure === 'facing') pose.facing = -1;
      const result = data.observer.observe(changed, failure === 'gap' ? 751 : failure === 'reverse' ? 400 : 600, failure === 'pause', true);
      expect(result.evidence).toBeNull(); expect(result.phase).toBe('waiting');
      pose.joints.rightShoulder = 0;
      expect(data.observer.observe(changed, failure === 'gap' ? 850 : failure === 'reverse' ? 500 : 700, false, true).evidence).toBeNull();
    }
  });

  it('compares body stability with the first raised root rather than allowing gradual drift', () => {
    const data = reachable('split-axe'), changed = clone(data.frame), pose = changed.actors[0]!.pose;
    expect(data.observer.observe(changed, 0, false, true).heldMs).toBe(0);
    pose.x += .004; expect(data.observer.observe(changed, 100, false, true).heldMs).toBe(100);
    pose.x += .004; expect(data.observer.observe(changed, 200, false, true).heldMs).toBe(200);
    pose.x += .004; expect(data.observer.observe(changed, 300, false, true).heldMs).toBe(0);
  });

  it('a lowered or briefly raised axe alone never earns evidence', () => {
    const data = reachable('split-axe'), landed = fixture('split-axe').frame;
    expect(data.observer.observe(landed, 0, false, true).evidence).toBeNull();
    data.observer.observe(data.frame, 100, false, true); data.observer.observe(data.frame, 300, false, true);
    expect(data.observer.observe(landed, 400, false, true).evidence).toBeNull();
    expect(data.observer.observe(data.frame, 500, false, true).heldMs).toBe(0);
  });

  it('requires this node\'s actors, backdrop and visible props; a raised arm without its axe is not axe evidence', () => {
    for (const failure of ['actor', 'backdrop', 'attachment'] as const) {
      const data = reachable(failure === 'actor' ? 'call-light' : 'split-axe'), wrong = clone(data.frame);
      if (failure === 'actor') wrong.actors.pop();
      if (failure === 'backdrop') wrong.stage.backgroundId = 'home-v1';
      if (failure === 'attachment') wrong.attachments = [];
      for (let time = 0; time <= 600; time += 100) expect(data.observer.observe(wrong, time, false, true).evidence).toBeNull();
      wrong.actors[0]!.pose.joints.rightShoulder = 0;
      expect(data.observer.observe(wrong, 700, false, true).evidence).toBeNull();
      expect(interactionGoal(data.node, wrong)).toBeNull();
    }
  });

  it('captures its node requirements independently from later caller edits', () => {
    const data = reachable('call-light'), node = clone(data.node), observer = createNodeInteraction(node);
    node.actors = ['chenxiang']; node.entryStage.backgroundId = 'plain-v1';
    if (node.completion.kind !== 'light') throw new Error('fixture');
    node.completion.overlapRatio = 1; node.completion.holdMs = 10000;
    for (let time = 0; time <= 600; time += 100) observer.observe(data.frame, time, false, true);
    expect(observer.observe(data.frame, 600, false, true).evidence).toMatchObject({ kind: 'light', heldMs: 600 });
  });

  it('does not manufacture interaction evidence for cinematic, craft, choice, terminal or malformed targets', () => {
    for (const id of ['intro', 'craft', 'approach-choice', 'completed'] as const) {
      const { node, frame } = fixture(id);
      expect(createNodeInteraction(node).observe(frame, 0, false, true).evidence).toBeNull();
    }
    const data = reachable('call-light');
    if (data.node.completion.kind !== 'light') throw new Error('fixture');
    for (const patch of [{ overlapRatio: NaN }, { holdMs: -1 }, { target: { x: 2, y: 0, width: 1, height: 1 } }]) {
      const node = clone(data.node); Object.assign(node.completion, patch);
      const observer = createNodeInteraction(node);
      for (let time = 0; time <= 1000; time += 100) expect(observer.observe(data.frame, time, false, true).evidence).toBeNull();
    }
  });
});
