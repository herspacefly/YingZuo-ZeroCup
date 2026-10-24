import {describe,it,expect} from 'vitest';
import {expandedAt,expandedStep,NOW} from '../helpers/expanded-story';
import {expandedDefinition,definitionFor} from '../../src/content/reunion';
import {ENDING_IDS,storyPath} from '../../src/domain/story-path';
import {currentStoryNode,reduceStory,storyEntry,storyGuard} from '../../src/domain/story';
import {validateProject} from '../../src/domain/validation';
import {createSceneDirector} from '../../src/story/director';
import {interactionGoal} from '../../src/story/node-interaction';
import {createReunionReplay} from '../../src/story/replay';
import {createReunionArtifact} from '../../src/features/result/artifact';
import {stagePlayFrame} from '../../src/story/play-staging';
import {serializeProject,parseProjectJSON} from '../../src/domain/migrations';
import {at} from '../helpers/story';
import type {StoryNodeId} from '../../src/domain/types';
describe('expanded story, real scene consumers and version boundaries',()=>{
 for(const approach of ['call-first','split-first'] as const)for(const ending of ENDING_IDS)for(const mode of ['full','guided'] as const){
  it(`${approach}/${ending}/${mode} closes all 21 nodes with drawable scenes and reachable assistance`,()=>{
    let p=expandedAt('intro',approach,ending,mode);const visited:StoryNodeId[]=[];
    for(let i=0;i<25;i++){
      const node=currentStoryNode(expandedDefinition,p.story!);visited.push(node.id);
      const director=createSceneDirector(p,storyEntry(p,expandedDefinition,1));
      for(const time of [0,director.durationMs*.5,director.durationMs])expect(director.sample(time).frame.actors.length).toBeLessThanOrEqual(2);
      if(node.id==='curtain')expect(stagePlayFrame(node,director.sample(director.durationMs).frame,{opening:0,reveal:1,reaction:0,guardianExit:0}).showRods).toBe(true);
      if(node.kind==='interaction'&&node.id!=='craft')expect(interactionGoal(node,director.sample(2000).frame),node.id).not.toBeNull();
      if(node.id==='completed')break;p=expandedStep(p,approach,ending);
    }
    expect(visited).toEqual(storyPath(2,approach,ending));expect(visited).toHaveLength(21);
    expect(parseProjectJSON(serializeProject(p)).story).toEqual(p.story);
    const art=createReunionArtifact(p);expect(art.summary.ending).toBe(ending);expect(art.summary.id).toContain(':ending:'+ending);
    const replay=createReunionReplay(p);expect(replay.segments).toHaveLength(20);
    for(let i=0;i<replay.segments.length;i++){expect(replay.sample(i,Infinity).ended).toBe(true);}
    if(ending==='sacrifice')expect(art.frame.actorOpacity?.chenxiang).toBe(.16);
    if(ending==='waiting'){expect(art.frame.actorOpacity?.mother).toBe(.6);expect(art.frame.attachments).toContainEqual({actorId:'chenxiang',attachmentId:'lantern'});}
    if(ending==='light'){expect(art.frame.attachments).toContainEqual({actorId:'mother',attachmentId:'lantern'});expect(replay.sample(19,Infinity).frame.attachments).toEqual(art.frame.attachments);}
  });
 }
 it('samples the ending walk and answering mother before projecting actors, while manual light retains control',()=>{
   const road=expandedAt('ending-road-hold','call-first','road');
   const walk=createSceneDirector(road,storyEntry(road,expandedDefinition,1));
   const first=walk.sample(0).frame,last=walk.sample(walk.durationMs).frame;
   for(const id of ['chenxiang','mother'])expect(last.actors.find(a=>a.actorId===id)!.pose.x).toBeGreaterThan(first.actors.find(a=>a.actorId===id)!.pose.x);
   const waiting=expandedAt('ending-waiting-light','call-first','waiting');
   const response=createSceneDirector(waiting,storyEntry(waiting,expandedDefinition,1));
   expect(response.sample(response.durationMs).frame.actors.find(a=>a.actorId==='mother')!.pose.joints.rightShoulder).not.toBe(response.sample(0).frame.actors.find(a=>a.actorId==='mother')!.pose.joints.rightShoulder);
   expect(response.sample(1000,{stage:{lampX:-.3,puppetDistance:.2}}).frame.stage.lampX).toBe(-.3);
 });
 it('rejects injected cross-ending paths, stale guards, absent choices and unknown future definitions',()=>{
   const p=expandedAt('ending-choice'),guard=storyGuard(p.story!);
   const q=reduceStory(p,{...guard,action:'CHOOSE_ENDING',ending:'waiting'},{paused:true,elapsedMs:0,now:NOW},expandedDefinition)!;
   expect(reduceStory(q,{...guard,action:'CHOOSE_ENDING',ending:'home'},{paused:true,elapsedMs:0,now:NOW},expandedDefinition)).toBeNull();
   expect(()=>validateProject({...q,story:{...q.story,nodeId:'ending-road-hold'}})).toThrow();
   expect(()=>validateProject({...q,story:{...q.story,ending:null}})).toThrow();
   expect(()=>validateProject({...q,story:{...q.story,definitionVersion:5}})).toThrowError(expect.objectContaining({code:'unsupported-version'}));
 });
 it('keeps v1 unchanged and accepts the existing three-ending v2 records',()=>{
   const old=at('completed');expect(definitionFor(old.story).definitionVersion).toBe(1);expect(createReunionArtifact(old).summary.id).toMatch(/:reunion$/);expect(parseProjectJSON(serializeProject(old))).toEqual(old);
   for(const end of ['home','light','road'] as const)expect(validateProject(expandedAt('completed','call-first',end)).story!.ending).toBe(end);
 });
});
