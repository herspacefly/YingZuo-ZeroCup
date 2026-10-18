import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../../src/content/catalog';
import { reunionSummary } from '../../src/domain/story';
import { createReunionArtifact } from '../../src/features/result/artifact';
import { prepareFrame } from '../../src/renderers/canvas/frame';
import { interactionHandPoints } from '../../src/story/node-interaction';
import { handDistanceRatio } from '../../src/story/interactions';
import { at } from '../helpers/story';

describe('T09 deterministic completed-run artifact', () => {
  it('rejects every unfinished stage, including the last quiet hold', () => {
    for (const id of ['intro', 'craft', 'memory-wave', 'approach-choice', 'reunion-reach', 'reunion-hold'] as const) {
      expect(() => createReunionArtifact(at(id))).toThrow('尚未团圆');
    }
  });
  for (const approach of ['call-first', 'split-first'] as const) {
    it(`${approach}: curtain and completed produce the same legal frozen pair and stable identity`, () => {
      const curtain = at('curtain', approach), completed = at('completed', approach);
      const still = createReunionArtifact(curtain), final = createReunionArtifact(completed);
      expect(still).toEqual(final); expect(still.summary).toEqual(reunionSummary(curtain));
      expect(still.summary.id).toBe('run-test:reunion'); expect(still.summary.approach).toBe(approach);
      expect(still.frame.actors.map(actor => actor.actorId)).toEqual(['chenxiang', 'mother']);
      expect(still.frame.sceneLayers!.find(layer=>layer.id==='mountain-far')!.opacity).toBe(.55);
      expect(prepareFrame(still.frame, assetCatalog)).toEqual(still.frame);
      const points = interactionHandPoints(still.frame)!;
      expect(handDistanceRatio(points.chenxiang, points.mother)).toBeLessThanOrEqual(.04);
    });
  }
  it('ignores editor changes and route, and copies input, summary and frame separately', () => {
    const project = at('completed'), before = JSON.stringify(project), still = createReunionArtifact(project);
    expect(JSON.stringify(project)).toBe(before);
    project.appearance.patternId = 'flower-v1'; project.appearance.paletteId = 'woodland-v1';
    project.appearance.carvedSegments[0] = true; project.stage.lampX = .7; project.pose.x = .9; project.lastRoute = '/museum';
    expect(createReunionArtifact(project)).toEqual(still);
    const actor = still.frame.actors[0]!;
    if (actor.actorId !== 'chenxiang') throw new Error('Missing Chenxiang');
    actor.appearance.carvedSegments[0] = !actor.appearance.carvedSegments[0];
    actor.pose.joints.rightElbow = 1;
    expect(still.summary.castSnapshot.appearance).toEqual(project.story!.castSnapshot!.appearance);
    still.summary.castSnapshot.appearance.patternId = 'wave-v1'; still.summary.assistedNodeIds.push('road');
    expect(project.story!.castSnapshot!.appearance.patternId).toBe('cloud-v1');
    expect(project.story!.assistedNodeIds).toEqual([]);
    expect(createReunionArtifact(project).frame).not.toEqual(still.frame);
  });
});
