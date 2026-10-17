import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../../src/content/catalog';
import { reunionDefinition } from '../../src/content/reunion';
import { subtitlesForMode } from '../../src/content/story-contract';
import { projectedPoseBounds } from '../../src/domain/pose';
import { storyEntry } from '../../src/domain/story';
import type { StoryNodeId } from '../../src/domain/types';
import { prepareFrame } from '../../src/renderers/canvas/frame';
import { createSceneDirector } from '../../src/story/director';
import { at } from '../helpers/story';

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
function fixture(id: StoryNodeId = 'intro', mode: 'full' | 'guided' = 'full') {
  const project = at(id, id.startsWith('split-') ? 'split-first' : 'call-first', mode);
  const entry = storyEntry(project, reunionDefinition, 1);
  return { project, entry, director: createSceneDirector(project, entry) };
}

describe('T16 absolute-time scene director', () => {
  for (const mode of ['full', 'guided'] as const) {
    it(`${mode}: all 18 nodes have legal entry, midpoint and end frames with at most two actors`, () => {
      for (const node of reunionDefinition.nodes) {
        const { entry, director } = fixture(node.id, mode);
        expect(director.durationMs).toBe((mode === 'full' ? node.fullTiming : node.guidedTiming).targetMs);
        for (const fraction of [0, .25, .5, .75, 1]) {
          const sample = director.sample(director.durationMs * fraction);
          expect(sample.frame.actors.length).toBeLessThanOrEqual(2);
          expect(prepareFrame(sample.frame, assetCatalog)).toEqual(sample.frame);
          expect(sample.automatic).toBe(['intro', 'memory-separate', 'training', 'call-response', 'split-response', 'curtain'].includes(node.id));
          expect(sample.ended).toBe(director.durationMs === 0 || fraction === 1);
          for (const actor of sample.frame.actors) {
            const template = assetCatalog.puppets.find(item => item.id === actor.templateId)!;
            const props = sample.frame.attachments!.filter(item => item.actorId === actor.actorId).map(item => item.attachmentId);
            const bounds = projectedPoseBounds(template, actor.pose, sample.frame.stage, props);
            expect(bounds.minX).toBeGreaterThanOrEqual(-.96000001);
            expect(bounds.maxX).toBeLessThanOrEqual(.96000001);
            expect(bounds.minY).toBeGreaterThanOrEqual(-.71000001);
            expect(bounds.maxY).toBeLessThanOrEqual(.71000001);
            for (const joint of template.joints) {
              expect(actor.pose.joints[joint.jointId]).toBeGreaterThanOrEqual(joint.minRad);
              expect(actor.pose.joints[joint.jointId]).toBeLessThanOrEqual(joint.maxRad);
              if (!joint.enabled) expect(actor.pose.joints[joint.jointId]).toBe(0);
            }
          }
        }
        const start = director.sample(0);
        expect(start.frame.stage).toEqual(entry.node.entryStage);
        expect(start.frame.sceneLayers).toEqual(entry.node.entrySceneLayers);
        expect(start.frame.attachments).toEqual(entry.node.entryAttachments);
        for (const actor of start.frame.actors) expect(actor.pose).toEqual(entry.node.entryPoses[actor.actorId]);
      }
    });
  }

  it('samples identical absolute instants regardless of 60/120 Hz calls or a fresh director', () => {
    const one = fixture('intro').director, two = fixture('intro').director;
    for (let frame = 0; frame < 720; frame++) one.sample(frame * 1000 / 60);
    for (let frame = 0; frame < 1440; frame++) two.sample(frame * 1000 / 120);
    expect(one.sample(12000)).toEqual(two.sample(12000));
    expect(one.sample(12000)).toEqual(fixture('intro').director.sample(12000));
  });

  it('captures frozen cast, mode and node without reading or following editor pose/stage', () => {
    const { project, entry } = fixture('memory-separate');
    project.story!.castSnapshot!.appearance.patternId = 'flower-v1';
    project.story!.castSnapshot!.appearance.paletteId = 'indigo-v1';
    project.story!.castSnapshot!.sharedMotif = 'wave-v1';
    const director = createSceneDirector(project, entry), before = director.sample(3000);
    project.appearance.patternId = 'cloud-v1'; project.pose.x = .99; project.stage.lampX = .8;
    project.stage.backgroundId = 'plain-v1'; project.story!.mode = 'guided';
    project.story!.castSnapshot!.appearance.patternId = 'cloud-v1';
    project.story!.castSnapshot!.sharedMotif = 'cloud-v1';
    entry.node.entryStage.lampX = -.8; entry.node.entryPoses.chenxiang!.x = .9;
    expect(director.sample(3000)).toEqual(before);
    expect(before.frame.actors[0]).toMatchObject({ appearance: { patternId: 'flower-v1', paletteId: 'indigo-v1' } });
    expect(before.frame.actors[1]).toMatchObject({ paletteId: 'mother-v1', sharedMotif: 'wave-v1' });
    expect(before.frame.actors[1]).not.toHaveProperty('appearance');
  });

  it('captures pre-craft appearance while still using node pose/stage', () => {
    const { project, entry } = fixture(); project.appearance.patternId = 'flower-v1';
    const director = createSceneDirector(project, entry);
    project.appearance.patternId = 'wave-v1'; project.pose.x = .9; project.stage.lampX = .8;
    expect(director.sample(0).frame.actors[0]).toMatchObject({ appearance: { patternId: 'flower-v1' }, pose: entry.node.entryPoses.chenxiang });
    expect(director.sample(0).frame.stage).toEqual(entry.node.entryStage);
  });

  it('a call receives a response without opening the mountain before the axe interaction', () => {
    const {director,entry}=fixture('call-response');
    for(const time of [0,2500,5000])expect(director.sample(time).frame.sceneLayers).toEqual(entry.node.entrySceneLayers);
    expect(director.sample(5000).frame.actors[1]!.pose.joints).not.toEqual(entry.node.entryPoses.mother!.joints);
  });

  it('reduced motion reveals action beats even in scenes with just one subtitle',()=>{
    for(const id of ['memory-separate','training','call-response','split-response','curtain'] as const){
      const {director}=fixture(id);
      expect(director.sample(director.durationMs*.7,undefined,true).frame).not.toEqual(director.sample(0,undefined,true).frame);
    }
    const {director}=fixture('curtain');
    expect(director.sample(7500,undefined,true).frame.showRods).toBe(true);
    expect(director.sample(7500,undefined,true).frame).toEqual(director.sample(8000,undefined,true).frame);
  });

  it('composes constrained Chenxiang input and lights without changing fixed roles or saved input', () => {
    const { director, entry, project } = fixture('guardian');
    const input = { chenxiangPose: clone(entry.node.entryPoses.chenxiang!), stage: { lampX: .3, puppetDistance: .25 } };
    input.chenxiangPose.x = .46; input.chenxiangPose.joints.rightElbow = 100;
    const saved = clone(project), source = clone(input), baseline = director.sample(2500);
    const sample = director.sample(2500, input);
    expect(sample.frame.stage).toEqual({ ...entry.node.entryStage, ...input.stage });
    const actor = sample.frame.actors[0]!;
    expect(actor.pose.joints.rightElbow).toBe(2.4);
    expect(actor.pose.x).not.toBe(baseline.frame.actors[0]!.pose.x);
    expect(sample.frame.actors[1]!.pose.joints).toEqual(baseline.frame.actors[1]!.pose.joints);
    expect(sample.frame.actors[1]).toMatchObject({ paletteId: 'guardian-v1', templateId: 'guardian-v1' });
    expect(input).toEqual(source); expect(project).toEqual(saved);
    expect(sample.automatic).toBe(false);
  });

  it('retains Chenxiang manual ownership on every interaction and never fabricates completion evidence', () => {
    for (const node of reunionDefinition.nodes.filter(item => item.kind === 'interaction')) {
      const { director, entry } = fixture(node.id), input = clone(entry.node.entryPoses.chenxiang!);
      input.joints.rightShoulder = .7;
      const sample = director.sample(director.durationMs, { chenxiangPose: input });
      expect(sample.frame.actors[0]!.pose.joints.rightShoulder).toBe(.7);
      expect(sample.automatic).toBe(false); expect(sample).not.toHaveProperty('evidence');
    }
    for (const id of ['approach-choice', 'reunion-hold', 'completed'] as const) expect(fixture(id).director.sample(Infinity).automatic).toBe(false);
  });

  it('normalizes nonfinite/negative times, holds the final frame and returns isolated snapshots', () => {
    const { director } = fixture();
    for (const time of [-100, -Infinity, NaN]) expect(director.sample(time)).toEqual(director.sample(0));
    expect(director.sample(Infinity)).toEqual(director.sample(18000));
    expect(director.sample(999999)).toEqual(director.sample(18000));
    const before = director.sample(6000), mutated = director.sample(6000);
    mutated.frame.actors[0]!.pose.x = 1; mutated.frame.stage.lampX = .8;
    mutated.frame.sceneLayers![0]!.opacity = 0; mutated.cues[0]!.text = 'changed';
    expect(director.sample(6000)).toEqual(before);
  });

  it('uses mode-mapped half-open subtitles, retaining only the final cue at the end', () => {
    for (const mode of ['full', 'guided'] as const) {
      const { director, entry } = fixture('intro', mode), cues = subtitlesForMode(entry.node, mode);
      expect(director.sample(0).cues).toEqual([cues[0]]);
      for (let index = 1; index < cues.length; index++) {
        const cue = cues[index]!;
        expect(director.sample(cue.startMs).cues).toEqual([cue]);
        expect(director.sample(cue.startMs - .01).cues).toEqual([cues[index - 1]]);
      }
      expect(director.sample(Infinity).cues).toEqual([cues.at(-1)]);
    }
    expect(fixture('intro', 'guided').director.sample(10000).cues[0]!.text).toBe('先为他备好行装。');
  });

  it('directs the four proportional intro shots with light, mountain separation and visible rods', () => {
    for (const mode of ['full', 'guided'] as const) {
      const { director } = fixture('intro', mode), ratio = director.durationMs / 18000;
      expect(director.sample(0).lightLevel).toBe(.05);
      expect(director.sample(4000 * ratio).lightLevel).toBe(1);
      expect(director.sample(6000 * ratio).frame.sceneLayers!.find(item => item.id === 'mountain-left')!.opacity).toBeGreaterThan(0);
      expect(director.sample(9000 * ratio).frame.showRods).toBe(true);
      expect(director.sample(9000 * ratio).frame.sceneLayers!.find(item=>item.id==='mountain-left')!.opacity).toBe(.12);
      expect(director.sample(14000 * ratio).frame.showRods).toBe(false);
      expect(director.sample(14000 * ratio).shotLabel).toContain('制偶引入');
    }
  });

  it('gives every automatic scene a visible finite script while keeping fixed role palettes', () => {
    for (const id of ['intro', 'memory-separate', 'training', 'call-response', 'split-response', 'curtain'] as const) {
      const { director } = fixture(id), sample = director.sample(director.durationMs / 2);
      expect(sample.frame).not.toEqual(director.sample(0).frame);
      expect(sample.automatic).toBe(true);
      for (const actor of sample.frame.actors.filter(item => item.actorId !== 'chenxiang')) expect(actor).toMatchObject({ paletteId: `${actor.actorId}-v1` });
    }
  });

  it('reduces motion to storyboard stills without skipping duration or changing subtitle time', () => {
    const { director } = fixture();
    const a = director.sample(9000, {}, true), b = director.sample(12000, {}, true);
    expect(a.frame).toEqual(b.frame); expect(a.lightLevel).toBe(1); expect(b.lightLevel).toBe(1);
    expect(a.elapsedMs).toBe(9000); expect(b.elapsedMs).toBe(12000); expect(b.ended).toBe(false);
    expect(director.sample(13999, {}, true).cues).toEqual(director.sample(13999).cues);
    expect(director.sample(18000, {}, true).ended).toBe(true);
    const separate = fixture('memory-separate').director;
    expect(separate.sample(1000, {}, true).frame).toEqual(separate.sample(1500, {}, true).frame);
  });

  it('rejects stale entries, nonfinite lights and missing/illegal actor configuration explicitly', () => {
    const { project, entry } = fixture(); entry.guard.expectedRevision++;
    expect(() => createSceneDirector(project, entry)).toThrow('检查点');
    const good = fixture();
    expect(() => good.director.sample(100, { stage: { lampX: NaN, puppetDistance: .2 } })).toThrow('有限数值');
    delete good.entry.node.entryPoses.mother;
    expect(() => createSceneDirector(good.project, good.entry).sample(100)).toThrow('入口姿态');
    const tooMany = fixture(); tooMany.entry.node.actors.push('guardian');
    tooMany.entry.node.entryPoses.guardian = clone(tooMany.entry.node.entryPoses.mother!);
    expect(() => createSceneDirector(tooMany.project, tooMany.entry).sample(0)).toThrow('最多');
  });
});
