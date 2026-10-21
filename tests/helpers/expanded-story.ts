import { createProject } from '../../src/domain/defaults';
import { beginStory,currentStoryNode,reduceStory,storyGuard } from '../../src/domain/story';
import { expandedDefinition } from '../../src/content/reunion';
import type { Approach,EndingId,ProjectV1,StoryNodeId } from '../../src/domain/types';
import type { StoryPayload,InteractionEvidence } from '../../src/domain/story-types';
export const NOW='2026-10-21T08:00:00.000Z';
export function expandedAt(id:StoryNodeId,approach:Approach='call-first',ending:EndingId='home',mode:'full'|'guided'='full'){
  let project=beginStory(createProject('expanded-project','expanded-writer',NOW),'expanded-run',mode,2)!;
  for(let i=0;project.story!.nodeId!==id&&i<40;i++)project=expandedStep(project,approach,ending);
  if(project.story!.nodeId!==id)throw new Error('Unreachable expanded fixture '+id);return project;
}
export function expandedStep(project:ProjectV1,approach:Approach,ending:EndingId){
  const node=currentStoryNode(expandedDefinition,project.story!),c=node.completion;let payload:StoryPayload;
  if(c.kind==='choice')payload=node.id==='ending-choice'?{action:'CHOOSE_ENDING',ending}:{action:'CHOOSE',approach};
  else if(c.kind==='scene')payload={action:'COMPLETE_SCENE',source:c.activation==='user'?'user':'script'};
  else{let evidence:InteractionEvidence;
    if(c.kind==='craft')evidence={kind:'craft',presetAppearanceUsed:false};
    else if(c.kind==='axe')evidence={kind:'axe',stableBody:true,raisedAngleRad:c.raisedAngleRange[0],raisedHoldMs:c.holdMs,landedAngleRad:c.landedAngleRange[0],lowered:true};
    else if(c.kind==='reach')evidence={kind:'reach',handDistanceRatio:0};
    else if('holdMs' in c)evidence={kind:c.kind,overlapRatio:1,heldMs:c.holdMs};
    else throw new Error('Completed fixture');
    payload={action:'COMPLETE_INTERACTION',source:'user',evidence};
  }
  return reduceStory(project,{...storyGuard(project.story!),...payload},{paused:false,elapsedMs:100000,now:NOW},expandedDefinition)!;
}
