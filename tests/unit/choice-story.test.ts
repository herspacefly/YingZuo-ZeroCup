import sources from '../../src/content/sources.json';
import {describe,it,expect} from 'vitest';
import {CHOICE_NOW,CHOICE_RUNS,choiceAt,choicePayload,choiceStep} from '../helpers/choice-story';
import {choiceDefinition,definitionFor} from '../../src/content/reunion';
import {currentStoryNode,reduceStory,reunionSummary,storyEntry,storyGuard} from '../../src/domain/story';
import {resolveEnding,choiceSummary} from '../../src/domain/story-choices';
import {storyPath} from '../../src/domain/story-path';
import {parseProjectJSON,serializeProject} from '../../src/domain/migrations';
import {validateProject} from '../../src/domain/validation';
import {createSceneDirector} from '../../src/story/director';
import {createReunionReplay} from '../../src/story/replay';
import {createReunionArtifact} from '../../src/features/result/artifact';
import {subtitlesForMode,validateStoryDefinition} from '../../src/content/story-contract';
import {assetCatalog} from '../../src/content/catalog';
import {CHOICE_STORY_NODE_IDS,JOINT_IDS} from '../../src/domain/limits';
import {projectedPoseBounds} from '../../src/domain/pose';

describe('v5 cumulative choices and stable consumers',()=>{
 for(const run of CHOICE_RUNS)for(const mode of ['full','guided'] as const)it(`${run.journeyIntent}/${run.mountainPact}/${run.approach}/${run.finalAction}/${mode}`,()=>{
  let project=choiceAt('intro',run,mode);const visited:string[]=[];
  for(let n=0;n<24;n++){
   const node=currentStoryNode(choiceDefinition,project.story!);visited.push(node.id);
   expect(parseProjectJSON(serializeProject(project))).toEqual(project);
   const director=createSceneDirector(project,storyEntry(project,choiceDefinition,n));
   for(const t of [0,.25,.5,.75,1]){
    const frame=director.sample(t*director.durationMs).frame;
    expect(frame.actors.length).toBeLessThanOrEqual(2);expect(frame.actors.every(a=>a.costumeTreatment==='original-texture')).toBe(true);
    for(const actor of frame.actors){const template=assetCatalog.puppets.find(p=>p.id===actor.templateId)!;const bounds=projectedPoseBounds(template,actor.pose,frame.stage,frame.attachments?.filter(a=>a.actorId===actor.actorId).map(a=>a.attachmentId));expect(bounds.minX).toBeGreaterThanOrEqual(-1.001);expect(bounds.maxX).toBeLessThanOrEqual(1.001);expect(bounds.minY).toBeGreaterThanOrEqual(-.751);expect(bounds.maxY).toBeLessThanOrEqual(.751);}
   }
   for(const cue of subtitlesForMode(node,mode))expect(Array.from(cue.text).length/((cue.endMs-cue.startMs)/1000)).toBeLessThanOrEqual(6);
   if(node.id==='completed')break;
   const command={...storyGuard(project.story!),...choicePayload(project,run)},next=choiceStep(project,run);
   expect(reduceStory(next,command,{paused:false,elapsedMs:100000,now:CHOICE_NOW},choiceDefinition)).toBeNull();
   project=next;
  }
  expect(visited).toEqual(storyPath(5,run.approach,run.ending));expect(visited).toHaveLength(23);
  expect(resolveEnding(run.journeyIntent,run.mountainPact,run.approach,run.finalAction)).toBe(run.ending);
  expect(reunionSummary(project)?.ending).toBe(run.ending);expect(choiceSummary(project.story!)).toHaveLength(4);
  const artifact=createReunionArtifact(project);expect(artifact.summary.choices).toEqual(project.story!.choices);expect(artifact.frame.actors.every(a=>a.costumeTreatment==='original-texture')).toBe(true);
  const replay=createReunionReplay(project);expect(replay.segments.map(s=>s.id)).toEqual(visited.slice(0,-1));
  const last=replay.segments.findIndex(n=>n.id==='ending-choice');expect(replay.sample(last,0).shotLabel).toContain(run.finalAction==='wait'?'暂缓':'兑现');
  expect(replay.sample(last,0).allCues).toEqual(currentStoryNode(choiceDefinition,choiceAt('ending-choice',run,mode).story!).subtitles);
 });
 it('validates all v5 content and references without relaxing the previous contracts',()=>{
  expect(validateStoryDefinition(choiceDefinition,{nodeIds:CHOICE_STORY_NODE_IDS,jointIds:JOINT_IDS,sourceIds:sources.sources.map(s=>s.id),assetIds:assetCatalog.manifest.assets.map(a=>a.id),puppets:assetCatalog.puppets,scenes:assetCatalog.scenes.scenes})).toEqual([]);
  expect(definitionFor(null)).toBe(choiceDefinition);
 });
 for(const id of ['journey-choice','mountain-pact-choice','approach-choice','ending-choice'] as const)it(`${id}: explicit, gated and never skippable`,()=>{
  const project=choiceAt(id),guard=storyGuard(project.story!),payload=choicePayload(project,CHOICE_RUNS[1]!);
  expect(()=>reduceStory(project,{...guard,...payload},{paused:true,elapsedMs:0,now:CHOICE_NOW},choiceDefinition)).toThrow('对白');
  expect(()=>reduceStory(project,{...guard,action:'SKIP_NODE',source:'user'},{paused:false,elapsedMs:100000,now:CHOICE_NOW},choiceDefinition)).toThrow();
  expect(()=>reduceStory(project,{...guard,action:'COMPLETE_INTERACTION',source:'assistance'},{paused:false,elapsedMs:100000,now:CHOICE_NOW},choiceDefinition)).toThrow();
 });
 it('rejects prefilled/missing decisions, forged derived endings and a direct ending menu',()=>{
  const before=choiceAt('journey-choice');before.story!.choices!.journeyIntent='home';expect(()=>validateProject(before)).toThrow();
  const after=choiceAt('training');after.story!.choices!.journeyIntent=null;expect(()=>validateProject(after)).toThrow();
  const finished=choiceAt('completed');finished.story!.ending='light';expect(()=>validateProject(finished)).toThrow('四次决定');
  const final=choiceAt('ending-choice');expect(()=>reduceStory(final,{...storyGuard(final.story!),action:'CHOOSE_ENDING',ending:'home'},{paused:true,elapsedMs:100000,now:CHOICE_NOW},choiceDefinition)).toThrow();
  const unknown=choiceAt('intro');Reflect.set(unknown.story!,'definitionVersion',6);expect(()=>validateProject(unknown)).toThrowError(expect.objectContaining({code:'unsupported-version'}));
 });
});
