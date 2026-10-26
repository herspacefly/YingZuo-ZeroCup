import {createProject} from '../../src/domain/defaults';
import {beginStory,currentStoryNode,reduceStory,storyGuard} from '../../src/domain/story';
import {choiceDefinition} from '../../src/content/reunion';
import type {ProjectV1,StoryNodeId} from '../../src/domain/types';
import type {StoryPayload} from '../../src/domain/story-types';
export const CHOICE_NOW='2026-10-26T12:00:00.000Z';
export {CHOICE_RUNS} from './choice-cases';
export type {ChoiceRun} from './choice-cases';
import {CHOICE_RUNS} from './choice-cases';
import type {ChoiceRun} from './choice-cases';
export function choicePayload(project:ProjectV1,run:ChoiceRun):StoryPayload {
 const node=currentStoryNode(choiceDefinition,project.story!);
 if(node.id==='journey-choice')return {action:'CHOOSE_JOURNEY',journeyIntent:run.journeyIntent};
 if(node.id==='mountain-pact-choice')return {action:'CHOOSE_PACT',mountainPact:run.mountainPact};
 if(node.id==='approach-choice')return {action:'CHOOSE',approach:run.approach};
 if(node.id==='ending-choice')return {action:'CHOOSE_FINAL_ACTION',finalAction:run.finalAction};
 if(node.id==='craft')return {action:'COMPLETE_INTERACTION',source:'user',evidence:{kind:'craft',presetAppearanceUsed:false}};
 if(node.completion.kind==='scene')return {action:'COMPLETE_SCENE',source:node.completion.activation==='user'?'user':'script'};
 return {action:'COMPLETE_INTERACTION',source:'assistance'};
}
export function choiceStep(project:ProjectV1,run:ChoiceRun):ProjectV1 {
 const node=currentStoryNode(choiceDefinition,project.story!);
 return reduceStory(project,{...storyGuard(project.story!),...choicePayload(project,run)},
  {paused:false,elapsedMs:(project.story!.mode==='full'?node.fullTiming:node.guidedTiming).targetMs,now:CHOICE_NOW},choiceDefinition)!;
}
export function choiceAt(id:StoryNodeId,run:ChoiceRun=CHOICE_RUNS[1]!,mode:'full'|'guided'='guided'):ProjectV1 {
 let project=beginStory(createProject('choice-project','choice-writer',CHOICE_NOW),'choice-run',mode,5)!;
 for(let n=0;project.story!.nodeId!==id&&n<38;n++)project=choiceStep(project,run);
 if(project.story!.nodeId!==id)throw new Error('Unreachable v5 fixture '+id);
 return project;
}
