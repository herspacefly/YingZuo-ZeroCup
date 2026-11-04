import { createProject } from '../../src/domain/defaults';
import { beginStory,currentStoryNode,reduceStory,storyGuard } from '../../src/domain/story';
import type { InteractionEvidence,StoryCommand,StoryPayload } from '../../src/domain/story-types';
import type { Approach,ProjectV1,StoryNodeId } from '../../src/domain/types';
import { reunionDefinition } from '../../src/content/reunion';
import { CHOICE_RUNS } from './choice-cases';
import type { ChoiceRun } from './choice-cases';
export const NOW='2026-10-16T14:00:00.000Z';
export function first(mode:'full'|'guided'='full') {return beginStory(createProject('project-test','writer-test',NOW),'run-test',mode)!;}
export function runFor(nodeId:StoryNodeId,approach:Approach='call-first'):ChoiceRun {
  const prerequisites=reunionDefinition.nodes.find(n=>n.id===nodeId)!.prerequisites,ending=prerequisites.ending;approach=prerequisites.approach??approach;
  return CHOICE_RUNS.find(run=>run.finalAction==='fulfill'&&run.approach===approach&&(!ending||run.ending===ending))
    ?? CHOICE_RUNS.find(run=>(!ending||run.ending===ending)&&run.approach===approach)
    ?? CHOICE_RUNS.find(run=>run.ending===ending)!;
}
export function commandFor(project:ProjectV1,approach:Approach='call-first',assisted=false,run=runFor(project.story!.nodeId,approach)):StoryCommand {
  const story=project.story!,node=currentStoryNode(reunionDefinition,story),c=node.completion;
  let payload:StoryPayload;
  if(node.id==='journey-choice')payload={action:'CHOOSE_JOURNEY',journeyIntent:run.journeyIntent};
  else if(node.id==='mountain-pact-choice')payload={action:'CHOOSE_PACT',mountainPact:run.mountainPact};
  else if(node.id==='ending-choice')payload={action:'CHOOSE_FINAL_ACTION',finalAction:run.finalAction};
  else if(c.kind==='choice')payload={action:'CHOOSE',approach:run.approach};
  else if(c.kind==='scene')payload={action:'COMPLETE_SCENE',source:c.activation==='user'?'user':'script'};
  else {
    let evidence:InteractionEvidence;
    switch(c.kind){
      case 'craft':evidence={kind:'craft',presetAppearanceUsed:false};break;
      case 'wave':case 'road':case 'block':case 'light':evidence={kind:c.kind,overlapRatio:c.overlapRatio,heldMs:c.holdMs};break;
      case 'axe':evidence={kind:'axe',stableBody:true,raisedAngleRad:c.raisedAngleRange[0],raisedHoldMs:c.holdMs,landedAngleRad:c.landedAngleRange[0],lowered:true};break;
      case 'reach':evidence={kind:'reach',handDistanceRatio:c.maxDistanceRatio};break;
      default:throw new Error('Terminal has no forward command');
    }
    payload=assisted&&c.kind!=='craft'?{action:'COMPLETE_INTERACTION',source:'assistance'}:{action:'COMPLETE_INTERACTION',source:'user',evidence};
  }
  return {...storyGuard(story),...payload};
}
export function step(project:ProjectV1,approach:Approach='call-first',assisted=false,run=runFor(project.story!.nodeId,approach)) {
  const node=currentStoryNode(reunionDefinition,project.story!),elapsedMs=(project.story!.mode==='full'?node.fullTiming:node.guidedTiming).targetMs;
  return reduceStory(project,commandFor(project,approach,assisted,run),{paused:false,elapsedMs,now:NOW},reunionDefinition)!;
}
export function at(nodeId:StoryNodeId,approach:Approach='call-first',mode:'full'|'guided'='full') {
  let project=first(mode);const run=runFor(nodeId,approach);
  for(let i=0;i<38&&project.story!.nodeId!==nodeId;i++)project=step(project,run.approach,false,run);
  if(project.story!.nodeId!==nodeId)throw new Error(`Unreachable fixture ${nodeId}`);
  return project;
}
