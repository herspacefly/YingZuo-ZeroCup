import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../../src/content/catalog';
import { reunionDefinition } from '../../src/content/reunion';
import { subtitlesForMode } from '../../src/content/story-contract';
import { createProject } from '../../src/domain/defaults';
import { projectedPoseBounds } from '../../src/domain/pose';
import { reunionSummary } from '../../src/domain/story';
import type { Approach, ProjectV1, StoryNodeId } from '../../src/domain/types';
import { prepareFrame } from '../../src/renderers/canvas/frame';
import { handDistanceRatio } from '../../src/story/interactions';
import { interactionHandPoints } from '../../src/story/node-interaction';
import { createReunionReplay } from '../../src/story/replay';
import { at, NOW } from '../helpers/story';

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function reunited(approach: Approach = 'call-first', mode: 'full' | 'guided' = 'full') {
  return at('completed', approach, mode);
}
function sampleNode(replay: ReturnType<typeof createReunionReplay>, id: StoryNodeId, fraction: number, reducedMotion = false) {
  const index = replay.segments.findIndex(item => item.id === id);
  if (index < 0) throw new Error(`Missing replay node ${id}`);
  return replay.sample(index, replay.segments[index]!.durationMs * fraction, reducedMotion);
}

describe('T09 read-only reunion arrangement', () => {
  for (const mode of ['full', 'guided'] as const) for (const approach of ['call-first', 'split-first'] as const) {
    it(`${mode}/${approach}: follows only the actual 14-node route, with legal frozen frames at every beat`, () => {
      const project = reunited(approach, mode), saved = copy(project), replay = createReunionReplay(project);
      const branch = approach === 'call-first' ? ['call-light', 'call-response', 'call-split'] : ['split-axe', 'split-search', 'split-response'];
      expect(replay.segments.map(item => item.id)).toEqual(['intro', 'craft', 'memory-wave', 'memory-separate',
        'road', 'training', 'guardian', 'approach-choice', ...branch, 'reunion-reach', 'reunion-hold', 'curtain']);
      expect(replay.segments).toHaveLength(14);
      expect(replay.durationMs).toBe(replay.segments.reduce((total, item) => total + item.durationMs, 0));
      for (const [index, segment] of replay.segments.entries()) {
        const node = reunionDefinition.nodes.find(item => item.id === segment.id)!;
        expect(segment.durationMs).toBe((mode === 'full' ? node.fullTiming : node.guidedTiming).targetMs);
        expect(segment.durationMs).toBeGreaterThan(0);
        for (const reducedMotion of [false, true]) for (const fraction of [0, .1, .25, .5, .7, .9, 1]) {
          const sample = replay.sample(index, segment.durationMs * fraction, reducedMotion);
          expect(sample.ended).toBe(fraction === 1);
          expect(sample).not.toHaveProperty('evidence');
          expect(sample).not.toHaveProperty('automatic');
          expect(prepareFrame(sample.frame, assetCatalog)).toEqual(sample.frame);
          expect(sample.frame.actors.length).toBeGreaterThan(0);
          expect(sample.frame.actors.length).toBeLessThanOrEqual(2);
          expect(sample.frame.attachments).toEqual(node.entryAttachments);
          for (const actor of sample.frame.actors) {
            const template = assetCatalog.puppets.find(item => item.id === actor.templateId)!;
            const props = node.entryAttachments.filter(item => item.actorId === actor.actorId).map(item => item.attachmentId);
            const bounds = projectedPoseBounds(template, actor.pose, sample.frame.stage, props);
            expect(bounds.minX).toBeGreaterThanOrEqual(-.96000001);
            expect(bounds.maxX).toBeLessThanOrEqual(.96000001);
            expect(bounds.minY).toBeGreaterThanOrEqual(-.71000001);
            expect(bounds.maxY).toBeLessThanOrEqual(.71000001);
            if (actor.actorId === 'chenxiang') expect(actor.appearance).toEqual(project.story!.castSnapshot!.appearance);
            if (actor.actorId === 'mother') expect(actor).toMatchObject({ paletteId: 'mother-v1', sharedMotif: project.story!.castSnapshot!.sharedMotif });
            if (actor.actorId === 'guardian') expect(actor).toMatchObject({ paletteId: 'guardian-v1' });
          }
          expect(sample.allCues).toEqual(subtitlesForMode(node, mode));
        }
      }
      expect(project).toEqual(saved);
      expect(reunionSummary(project)).toEqual(reunionSummary(saved));
    });
  }

  it('accepts an actual curtain result and rejects missing, incomplete or invalid reunion data', () => {
    expect(createReunionReplay(at('curtain')).segments.at(-1)!.id).toBe('curtain');
    for (const project of [createProject('no-story', 'writer', NOW), at('intro'), at('craft'), at('reunion-hold')]) {
      expect(() => createReunionReplay(project)).toThrow();
    }
    for (const corrupt of [
      (project: ProjectV1) => { project.story!.completedAt = null; },
      (project: ProjectV1) => { project.story!.castSnapshot = null; },
      (project: ProjectV1) => { project.story!.approach = null; },
    ]) {
      const project = reunited(); corrupt(project);
      expect(() => createReunionReplay(project)).toThrow();
    }
  });

  it('programs wave, walk, block, light, axe and reaching as actual drawings, never completion observations', () => {
    for (const approach of ['call-first', 'split-first'] as const) {
      const replay = createReunionReplay(reunited(approach));
      for (const id of ['memory-wave', 'road', 'guardian', 'reunion-reach'] as const) {
        expect(sampleNode(replay, id, .7).frame).not.toEqual(sampleNode(replay, id, 0).frame);
      }
      const lightId = approach === 'call-first' ? 'call-light' : 'split-search';
      expect(sampleNode(replay, lightId, 0).frame.actorOpacity!.mother).toBe(.05);
      expect(sampleNode(replay, lightId, 1).frame.actorOpacity!.mother).toBe(1);
      expect(sampleNode(replay, lightId, 1).frame.stage.puppetDistance).toBe(.4);
      expect(sampleNode(replay, lightId, .5).frame.stage.lampX).not.toBe(sampleNode(replay, lightId, 0).frame.stage.lampX);
      if (approach === 'split-first') expect(sampleNode(replay, lightId, 1).frame.sceneLayers!.find(layer => layer.id === 'mountain-dust')!.opacity).toBe(0);
      const axeId = approach === 'call-first' ? 'call-split' : 'split-axe';
      const raised = sampleNode(replay, axeId, .3).frame, landed = sampleNode(replay, axeId, 1).frame;
      expect(raised.actors[0]!.pose.joints.rightShoulder).toBeGreaterThan(1);
      expect(landed.actors[0]!.pose.joints.rightShoulder).toBeLessThan(0);
      expect(landed.attachments).toContainEqual({ actorId: 'chenxiang', attachmentId: 'axe' });
      expect(landed.sceneLayers!.find(layer => layer.id === 'mountain-left')!.x).toBe(-.55);
      expect(landed.sceneLayers!.find(layer => layer.id === 'mountain-right')!.x).toBe(.55);
      const reach = sampleNode(replay, 'reunion-reach', 1).frame, hold = sampleNode(replay, 'reunion-hold', 0).frame;
      expect(reach.actors.map(actor => actor.pose)).toEqual(hold.actors.map(actor => actor.pose));
      const hands = interactionHandPoints(hold)!;
      expect(handDistanceRatio(hands.chenxiang, hands.mother)).toBeLessThanOrEqual(.04);
      expect(sampleNode(replay, 'guardian', 1).frame.actorOpacity!.guardian).toBe(0);
    }
  });

  it('captures the complete frozen run once, even before craft, ignoring later editor and story mutations', () => {
    const project = reunited();
    project.story!.castSnapshot!.appearance.patternId = 'flower-v1';
    project.story!.castSnapshot!.appearance.paletteId = 'indigo-v1';
    project.story!.castSnapshot!.sharedMotif = 'flower-v1';
    project.appearance.patternId = 'wave-v1';
    const replay = createReunionReplay(project), before = replay.segments.map((_, i) => replay.sample(i, 500));
    project.appearance.patternId = 'cloud-v1'; project.pose.x = .99; project.stage.lampX = .8;
    project.story!.mode = 'guided'; project.story!.approach = 'split-first'; project.story!.runId = 'changed';
    project.story!.completedAt = '2099-01-01T00:00:00.000Z';
    project.story!.castSnapshot!.appearance.patternId = 'cloud-v1'; project.story!.castSnapshot!.sharedMotif = 'cloud-v1';
    for (const [index] of replay.segments.entries()) expect(replay.sample(index, 500)).toEqual(before[index]);
    for (const id of ['intro', 'craft'] as const) expect(sampleNode(replay, id, 0).frame.actors[0]).toMatchObject({ appearance: { patternId: 'flower-v1', paletteId: 'indigo-v1' } });
    expect(before[0]!.frame.actors[1]).toMatchObject({ sharedMotif: 'flower-v1' });
  });

  it('isolates every returned frame/cue/segment and samples absolute time without call history', () => {
    const project = reunited(), replay = createReunionReplay(project), other = createReunionReplay(project);
    const duration = replay.segments[0]!.durationMs, before = replay.sample(0, 6000);
    const changed = replay.sample(0, 6000);
    changed.frame.actors[0]!.pose.x = .99;
    const chenxiang = changed.frame.actors.find(actor => actor.actorId === 'chenxiang')!;
    if (chenxiang.actorId === 'chenxiang') chenxiang.appearance.colorSlots.body = 2;
    changed.frame.sceneLayers![0]!.opacity = 0; changed.frame.stage.lampX = -.8;
    changed.cues[0]!.text = 'changed'; changed.allCues[0]!.text = 'changed';
    replay.segments[0]!.durationMs = 1; replay.segments[0]!.id = 'completed'; replay.segments[0]!.title = 'changed';
    for (let index = 0; index < 240; index++) replay.sample(0, index * 1000 / 60);
    for (let index = 0; index < 480; index++) other.sample(0, index * 1000 / 120);
    expect(replay.sample(0, 6000)).toEqual(before);
    expect(replay.sample(0, duration)).toEqual(other.sample(0, duration));
    for (const time of [NaN, -Infinity, -100]) expect(replay.sample(0, time)).toEqual(other.sample(0, 0));
    for (const time of [Infinity, duration + 1, 1e20]) expect(replay.sample(0, time)).toEqual(other.sample(0, duration));
    for (const index of [NaN, -Infinity, Infinity, -.1, -1, 1.5, 14]) expect(() => replay.sample(index, 0)).toThrow('有效');
  });

  it('keeps half-open real-time captions and provides reduced-motion stills without skipping time', () => {
    for (const mode of ['full', 'guided'] as const) {
      const replay = createReunionReplay(reunited('call-first', mode));
      const intro = reunionDefinition.nodes.find(node => node.id === 'intro')!;
      const cues = subtitlesForMode(intro, mode);
      for (const cue of cues) {
        expect(replay.sample(0, cue.startMs).cues).toEqual([cue]);
        expect(replay.sample(0, cue.startMs, true).cues).toEqual([cue]);
      }
      expect(replay.sample(0, Infinity).cues).toEqual([cues.at(-1)]);
      for (const id of ['memory-wave', 'road', 'guardian', 'call-split', 'call-light', 'reunion-reach'] as const) {
        const a = sampleNode(replay, id, .51, true), b = sampleNode(replay, id, .6, true);
        expect(a.frame).toEqual(b.frame);
        expect(a.ended).toBe(false); expect(b.ended).toBe(false);
        expect(sampleNode(replay, id, 1, true).ended).toBe(true);
      }
    }
  });

  it('normalizes a zero-length content segment to an immediately ended still without padding target time', () => {
    const craft = reunionDefinition.nodes.find(node => node.id === 'craft')!;
    const original = craft.fullTiming.targetMs;
    try {
      craft.fullTiming.targetMs = 0;
      const replay = createReunionReplay(reunited()), index = replay.segments.findIndex(item => item.id === 'craft');
      expect(replay.segments[index]!.durationMs).toBe(0);
      for (const time of [0, 1, -1, NaN, Infinity]) {
        const sample = replay.sample(index, time);
        expect(sample.ended).toBe(true);
        expect(prepareFrame(sample.frame, assetCatalog)).toEqual(sample.frame);
      }
    } finally { craft.fullTiming.targetMs = original; }
  });
});
