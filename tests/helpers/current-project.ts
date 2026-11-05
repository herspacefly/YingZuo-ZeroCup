import fixture from '../fixtures/project.json' with {type:'json'};
import definition from '../../src/content/stories/reunion.json' with {type:'json'};
import {arrangeVoiceNode} from '../../src/content/voice-arrangement';
import type {StoryNode} from '../../src/domain/story-types';
import type {Approach,EndingId,ProjectV1,StoryNodeId} from '../../src/domain/types';
import {CHOICE_RUNS} from './choice-cases';
import type {ChoiceRun} from './choice-cases';
export {CHOICE_RUNS};
export function currentNode(id:StoryNodeId){
 return arrangeVoiceNode(definition.nodes.find(node=>node.id===id)! as unknown as StoryNode,5);
}
export function currentRun(id:StoryNodeId,approach:Approach='call-first',ending?:EndingId):ChoiceRun{
  const prerequisites=definition.nodes.find(node=>node.id===id)!.prerequisites;
  const needed=ending??('ending' in prerequisites?prerequisites.ending as EndingId:undefined);
  approach=prerequisites.approach as Approach??approach;
  return CHOICE_RUNS.find(run=>run.finalAction==='fulfill'&&run.approach===approach&&(!needed||run.ending===needed))
    ??CHOICE_RUNS.find(run=>run.approach===approach&&(!needed||run.ending===needed))
    ??CHOICE_RUNS.find(run=>run.ending===needed)!;
}
/** Independent saved JSON fixture for browser tests; no Store or reducer imports. */
export function currentProject(id:StoryNodeId='call-light',mode:'full'|'guided'='guided',run=currentRun(id)):ProjectV1{
 const project=structuredClone(fixture) as ProjectV1,cast=project.story!.castSnapshot;
 Object.assign(project.story!,{definitionVersion:5,nodeId:'intro',revision:0,mode,approach:null,approachSource:null,ending:null,endingSource:null,choices:{journeyIntent:null,mountainPact:null,finalAction:null},castSnapshot:null,assistedNodeIds:[],completedAt:null});
 delete project.story!.skippedNodeIds;
 for(let n=0;project.story!.nodeId!==id&&n<38;n++){
  const s=project.story!,node=definition.nodes.find(node=>node.id===s.nodeId)!;
  if(s.nodeId==='craft')s.castSnapshot=cast;
  if(s.nodeId==='journey-choice')s.choices.journeyIntent=run.journeyIntent;
  if(s.nodeId==='mountain-pact-choice')s.choices.mountainPact=run.mountainPact;
  if(s.nodeId==='approach-choice'){s.approach=run.approach;s.approachSource='user';}
  if(s.nodeId==='ending-choice'){s.choices.finalAction=run.finalAction;s.ending=run.ending;s.endingSource='choices';}
  const edges=node.next as unknown as Record<string,StoryNodeId>;
  s.nodeId=edges.default??edges[s.nodeId==='ending-choice'?run.ending:run.approach]!;s.revision++;
  if(s.nodeId==='curtain')s.completedAt='2026-11-04T00:00:00.000Z';
 }
 if(project.story!.nodeId!==id)throw new Error('Unreachable current fixture '+id);return project;
}
export function currentDuration(id:StoryNodeId,mode:'full'|'guided'='guided'){
 const node=currentNode(id);return (mode==='full'?node.fullTiming:node.guidedTiming).targetMs;
}
