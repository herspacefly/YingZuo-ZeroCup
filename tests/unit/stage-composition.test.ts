import {describe,it,expect} from 'vitest';
import {definitionFor} from '../../src/content/reunion';
import {assetCatalog} from '../../src/content/catalog';
import {storyEntry} from '../../src/domain/story';
import {createSceneDirector} from '../../src/story/director';
import {stagePlayFrame} from '../../src/story/play-staging';
import {createInteractionClip} from '../../src/story/interaction-clip';
import {actorSceneOrder,prepareFrame,scenePlaneDepth} from '../../src/renderers/canvas/frame';
import {projectedPoseBounds} from '../../src/domain/pose';
import {expandedAt} from '../helpers/expanded-story';
import {at} from '../helpers/story';
const effects={opening:0,reveal:0,reaction:0,guardianExit:0};
describe('authored stage planes and safe canonical composition',()=>{
 for(const version of [1,2,3,4] as const)it(`v${version}: all stable scenes and action samples fit the curtain`,()=>{
  const definition=definitionFor({definitionVersion:version});
  for(const node of definition.nodes){
   const p=version===1?at(node.id,node.prerequisites.approach??'call-first'):expandedAt(node.id,node.prerequisites.approach??'call-first',node.prerequisites.ending??'home');p.story!.definitionVersion=version;
   const d=createSceneDirector(p,storyEntry(p,definition,1)),clip=node.kind==='interaction'&&node.id!=='craft'?createInteractionClip(node,d):null;
   for(const progress of [0,.25,.5,.75,1]){
    const frame=clip?clip.sample(progress,progress*d.durationMs,false).frame:stagePlayFrame(node,d.sample(progress*d.durationMs).frame,effects);
    expect(()=>prepareFrame(frame,assetCatalog)).not.toThrow();
    for(const actor of frame.actors){const template=assetCatalog.puppets.find(t=>t.id===actor.templateId)!,bounds=projectedPoseBounds(template,actor.pose,frame.stage,frame.attachments?.filter(a=>a.actorId===actor.actorId).map(a=>a.attachmentId));expect(bounds.minX).toBeGreaterThanOrEqual(-1.001);expect(bounds.maxX).toBeLessThanOrEqual(1.001);expect(bounds.minY).toBeGreaterThanOrEqual(-.751);expect(bounds.maxY).toBeLessThanOrEqual(.751);}
    if(frame.stage.backgroundId==='mountain-v1'){expect(actorSceneOrder(frame,assetCatalog,'chenxiang')).toBeGreaterThan(21);expect(frame.sceneLayers?.find(l=>l.id==='mountain-dust')?.opacity??0).toBe(0);}
   }
  }
 });
 it('shares the same front-to-back relation and rejects untrusted actor planes',()=>{
  const p=at('call-light'),d=definitionFor(p.story),n=storyEntry(p,d,1),f=stagePlayFrame(n.node,createSceneDirector(p,n).sample(0).frame,effects);
  expect(scenePlaneDepth(actorSceneOrder(f,assetCatalog,'chenxiang'),.2)).toBeGreaterThan(scenePlaneDepth(21,.2));
  expect(()=>prepareFrame({...f,actorSceneOrder:{guardian:30}},assetCatalog)).toThrow('层次');expect(()=>prepareFrame({...f,actorSceneOrder:{chenxiang:Infinity}},assetCatalog)).toThrow('层次');
 });
 it('keeps blocking and canonical axe choreography away from the other actor',()=>{
  for(const id of ['guardian','ending-sacrifice-axe'] as const){const p=expandedAt(id,'call-first','sacrifice'),definition=definitionFor(p.story),entry=storyEntry(p,definition,1),clip=createInteractionClip(entry.node,createSceneDirector(p,entry));
   for(const progress of [.25,.5,.75,1]){const actors=clip.sample(progress,0,false).frame.actors,chen=actors.find(a=>a.actorId==='chenxiang')!,other=actors.find(a=>a.actorId!=='chenxiang')!;expect(other.pose.x-chen.pose.x).toBeGreaterThan(.2);}
  }
 });
 it('does not close an already opened mountain around the mother during the final axe',()=>{
  const p=expandedAt('ending-sacrifice-axe','call-first','sacrifice'),definition=definitionFor(p.story),entry=storyEntry(p,definition,1),director=createSceneDirector(p,entry);
  for(const opening of [0,.5,1]){const f=stagePlayFrame(entry.node,director.sample(0).frame,{...effects,opening});expect(f.sceneLayers?.find(l=>l.id==='mountain-left')?.x).toBe(-.55);expect(f.sceneLayers?.find(l=>l.id==='mountain-right')?.x).toBe(.55);}
 });
});
