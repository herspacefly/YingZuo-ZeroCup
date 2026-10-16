import { createProject } from '../../src/domain/defaults';
import { beginStory,currentStoryNode,reduceStory,storyGuard } from '../../src/domain/story';
import type { InteractionEvidence,StoryCommand,StoryPayload } from '../../src/domain/story-types';
import type { Approach,ProjectV1,StoryNodeId } from '../../src/domain/types';
import { reunionDefinition } from '../../src/content/reunion';
export const NOW='2026-10-16T14:00:00.000Z';
export function first(mode:'full'|'guided'='full') {return beginStory(createProject('project-test','writer-test',NOW),'run-test',mode)!;}
export function commandFor(project:ProjectV1,approach:Approach='call-first',assisted=false):StoryCommand {
  const story=project.story!,node=currentStoryNode(reunionDefinition,story),c=node.completion;
  let payload:StoryPayload;
  if(c.kind==='choice')payload={action:'CHOOSE',approach};
  else if(c.kind==='scene')payload={action:'COMPLETE_SCENE',source:c.activation==='user'?'user':node.id==='curtain'&&assisted?'assistance':'script'};
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
export function step(project:ProjectV1,approach:Approach='call-first',assisted=false) {
  return reduceStory(project,commandFor(project,approach,assisted),{paused:false,elapsedMs:20000,now:NOW},reunionDefinition)!;
}
export function at(nodeId:StoryNodeId,approach:Approach='call-first',mode:'full'|'guided'='full') {
  let project=first(mode);
  for(let i=0;i<20&&project.story!.nodeId!==nodeId;i++)project=step(project,approach);
  if(project.story!.nodeId!==nodeId)throw new Error(`Unreachable fixture ${nodeId}`);
  return project;
}
