import { describe,expect,it } from 'vitest';
import { assetCatalog } from '../../src/content/catalog';
import { lamplitDefinition } from '../../src/content/reunion';
import { storyEntry } from '../../src/domain/story';
import { editorFrame } from '../../src/features/shared/canvas-stage';
import { createReunionArtifact } from '../../src/features/result/artifact';
import { requiredAssets } from '../../src/renderers/canvas/frame';
import { createSceneDirector } from '../../src/story/director';
import { createNodeInteraction,interactionGoal,projectedInteractionRegion } from '../../src/story/node-interaction';
import { createReunionReplay } from '../../src/story/replay';
import { expandedAt } from '../helpers/expanded-story';

describe('lamp-led v4 and fine original costume compatibility',()=>{
  it('new editor/v4 preserve serialized legacy fields without loading or carving added motifs',()=>{
    const old=expandedAt('completed'),latest=structuredClone(old);latest.story!.definitionVersion=4;
    const before=JSON.stringify(latest),draft=editorFrame(latest,true);
    expect(draft.actors.every(a=>a.costumeTreatment==='original-texture')).toBe(true);
    const artifact=createReunionArtifact(latest),replay=createReunionReplay(latest);
    expect(artifact.frame.actors.every(a=>a.costumeTreatment==='original-texture')).toBe(true);
    expect(replay.sample(0,0).frame.actors.every(a=>a.costumeTreatment==='original-texture')).toBe(true);
    for(const frame of [draft,artifact.frame])expect(requiredAssets(frame,assetCatalog).some(id=>id.includes('-cut-'))).toBe(false);
    const historical=createReunionArtifact(old).frame;expect(historical.actors.every(a=>a.costumeTreatment==='legacy-motif')).toBe(true);
    expect(requiredAssets(historical,assetCatalog).some(id=>id.includes('-cut-'))).toBe(true);
    expect(JSON.stringify(latest)).toBe(before);
  });
  it('light tasks observe the actual held lantern, follow the hand, and reset sustained evidence after seeking',()=>{
    const project=expandedAt('call-light');project.story!.definitionVersion=4;
    const node=lamplitDefinition.nodes.find(n=>n.id==='call-light')!,director=createSceneDirector(project,storyEntry(project,lamplitDefinition,1)),first=director.sample(0).frame;
    const light=projectedInteractionRegion(first,'light','lantern')!;
    expect(light).not.toEqual(projectedInteractionRegion(first,'light'));
    const moved=structuredClone(first);moved.actors[0]!.pose.joints.rightShoulder=.6;
    expect(projectedInteractionRegion(moved,'light','lantern')).not.toEqual(light);
    const absent=structuredClone(first);absent.attachments=[];expect(projectedInteractionRegion(absent,'light','lantern')).toBeNull();
    const goal=interactionGoal(node,first)!;expect(goal).not.toBeNull();
    const ready=director.sample(0,{chenxiangPose:goal.pose,stage:goal.stage}).frame,observer=createNodeInteraction(node);
    for(let ms=0;ms<=500;ms+=100)expect(observer.observe(ready,ms,false,true).evidence).toBeNull();
    observer.reset();expect(observer.observe(ready,100000,false,false).evidence).toBeNull();
    expect(observer.observe(ready,100100,false,true).heldMs).toBe(0);
    for(let ms=100200;ms<=100700;ms+=100)observer.observe(ready,ms,false,true);
    expect(observer.observe(ready,100800,false,true).evidence).toMatchObject({kind:'light'});
  });
});
