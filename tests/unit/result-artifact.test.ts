import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../../src/content/catalog';
import { reunionSummary } from '../../src/domain/story';
import { createReunionArtifact } from '../../src/features/result/artifact';
import { prepareFrame } from '../../src/renderers/canvas/frame';
import { interactionHandPoints } from '../../src/story/node-interaction';
import { handDistanceRatio } from '../../src/story/interactions';
import {at} from '../helpers/story';
import {CHOICE_RUNS,choiceAt} from '../helpers/choice-story';

describe('T09 deterministic completed-run artifact', () => {
  it('rejects every unfinished stage, including the last quiet hold', () => {
    for (const id of ['intro', 'craft', 'memory-wave', 'approach-choice', 'reunion-reach', 'reunion-hold'] as const) {
      expect(() => createReunionArtifact(at(id))).toThrow('未到终章');
    }
  });
  for(const ending of ['home','light','road','waiting','sacrifice'] as const)it(`${ending}: curtain and completed share the real scene and frozen identity`,()=>{
    const run=CHOICE_RUNS.find(r=>r.ending===ending)!,curtain=choiceAt('curtain',run),completed=choiceAt('completed',run);
    const still=createReunionArtifact(curtain),final=createReunionArtifact(completed);
    expect(still).toEqual(final);expect(still.summary).toEqual(reunionSummary(curtain));
    expect(still.summary.id).toBe(`choice-run:ending:${ending}`);expect(still.summary.approach).toBe(run.approach);
    expect(prepareFrame(still.frame,assetCatalog)).toEqual(still.frame);
    expect(still.frame.actors.every(actor=>actor.costumeTreatment==='original-texture')).toBe(true);
    expect(still.frame.stage).toEqual(createReunionArtifact(completed).frame.stage);
    if(ending==='home'){
      const points=interactionHandPoints(still.frame)!;expect(handDistanceRatio(points.chenxiang,points.mother)).toBeLessThanOrEqual(.04);
    }
  });
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
