import { describe, expect, it } from 'vitest';
import { definitionFor, literaryDefinition, lamplitDefinition } from '../../src/content/reunion';
import { createProject } from '../../src/domain/defaults';
import { beginStory, currentStoryNode, reduceStory, storyEntry, storyGuard } from '../../src/domain/story';
import { ENDING_IDS, storyPath } from '../../src/domain/story-path';
import type { StoryPayload } from '../../src/domain/story-types';
import { validateProject } from '../../src/domain/validation';
import { createSceneDirector } from '../../src/story/director';
import { createInteractionClip } from '../../src/story/interaction-clip';
import { createReunionReplay } from '../../src/story/replay';
import { createReunionArtifact } from '../../src/features/result/artifact';
import { expandedAt, NOW } from '../helpers/expanded-story';
import { at } from '../helpers/story';

describe.each([literaryDefinition,lamplitDefinition])('v$definitionVersion narrative, version compatibility and canonical showcase', definition => {
  for (const approach of ['call-first', 'split-first'] as const) for (const ending of ENDING_IDS) {
    it(`${approach}/${ending}: closes exactly 21 nodes with substantive dialogue and independent guide copy`, () => {
      let project = beginStory(createProject('v3', 'test', NOW), 'v3-run', 'full', definition.definitionVersion)!;
      const visited: string[] = []; let chars = 0, duration = 0;
      for (let i = 0; i < 22; i++) {
        const node = currentStoryNode(definition, project.story!); visited.push(node.id);
        if (node.id === 'completed') break;
        chars += node.subtitles.reduce((n, cue) => n + Array.from(cue.text).length, 0); duration += node.fullTiming.targetMs;
        if (node.subtitles.length) expect(node.guidedSubtitles).not.toEqual(node.subtitles);
        const director = createSceneDirector(project, storyEntry(project, definition, i));
        if (node.kind === 'interaction' && node.id !== 'craft') {
          const clip = createInteractionClip(node, director);
          expect(clip.durationMs).toBeGreaterThanOrEqual(5000); expect(clip.durationMs).toBeLessThanOrEqual(8000);
          for (const reduced of [false, true]) for (const t of [0, 300, 600, 2200, 4000, Infinity]) {
            const sample = clip.showcase(t, reduced); expect(sample.frame.showRods).toBe(false); expect(sample.cues).toEqual([]);
            expect(sample.frame.spatial?.light).toBe(sample.lightLevel);
            expect(sample.frame.actors.length).toBeLessThanOrEqual(2);
          }
          const expected = clip.endFrame(); project.pose.x = .99; project.pose.joints.rightShoulder = -1.3; project.stage.lampX = .8;
          expect(createInteractionClip(node, createSceneDirector(project, storyEntry(project, definition, i))).endFrame()).toEqual(expected);
          expect(clip.showcase(Infinity).frame).toEqual(expected);
        }
        let payload: StoryPayload;
        if (node.kind === 'choice') payload = node.id === 'ending-choice' ? { action: 'CHOOSE_ENDING', ending } : { action: 'CHOOSE', approach };
        else if (node.completion.kind === 'scene') payload = { action: 'COMPLETE_SCENE', source: node.completion.activation === 'user' ? 'user' : 'script' };
        else if (node.id === 'craft') payload = { action: 'COMPLETE_INTERACTION', source: 'user', evidence: { kind: 'craft', presetAppearanceUsed: false } };
        else payload = { action: 'COMPLETE_INTERACTION', source: 'assistance' };
        const command = { ...storyGuard(project.story!), ...payload }, context = { paused: false, elapsedMs: node.fullTiming.targetMs, now: NOW };
        if (node.id !== 'craft' && node.fullTiming.minDurationMs) expect(() => reduceStory(project, command, { ...context, elapsedMs: 0 }, definition)).toThrow();
        const next = reduceStory(project, command, context, definition)!;
        expect(reduceStory(next, command, context, definition)).toBeNull(); project = next;
      }
      expect(visited).toEqual(storyPath(definition.definitionVersion, approach, ending)); expect(chars).toBeGreaterThanOrEqual(3500); expect(chars).toBeLessThanOrEqual(5000);
      expect(duration).toBeGreaterThanOrEqual(900000); expect(duration).toBeLessThanOrEqual(1200000);
      expect(createReunionArtifact(project).summary.ending).toBe(ending); expect(createReunionReplay(project).segments).toHaveLength(20);
      const wrong = structuredClone(project); wrong.story!.nodeId = ending === 'light' ? 'ending-road-hold' : 'ending-light-hold'; wrong.story!.completedAt = null;
      expect(() => validateProject(wrong)).toThrow();
    });
  }
  it('preserves actual v1/v2 consumers and protects a genuinely unknown v5', () => {
    for (const project of [at('completed'), expandedAt('completed')]) {
      expect(definitionFor(validateProject(project).story).definitionVersion).toBe(project.story!.definitionVersion);
      expect(createReunionReplay(project).segments.length).toBe(project.story!.definitionVersion === 1 ? 14 : 20);
    }
    const future = structuredClone(expandedAt('completed')); Reflect.set(future.story!, 'definitionVersion', 5);
    expect(() => validateProject(future)).toThrowError(expect.objectContaining({ code: 'unsupported-version' }));
    expect(definitionFor(null).definitionVersion).toBe(4);
  });
});
