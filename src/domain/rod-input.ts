import type { PuppetTemplate } from '../content/asset-types';
import { constrainPoseToStage, rodPoint, solveArm } from './pose';
import { projectLocalPoint, screenToLocalPoint, unprojectPoint, WORLD_HEIGHT, WORLD_WIDTH } from './projection';
import type { Point } from './projection';
import type { Pose, StageConfig } from './types';

export type RodId = 'body' | 'leftHand' | 'rightHand';
export const ROD_IDS: readonly RodId[] = ['body','leftHand','rightHand'];
export function rodScreenPoint(template:PuppetTemplate,pose:Pose,stage:StageConfig,rod:RodId):Point {
  return projectLocalPoint(rodPoint(template,pose,rod),pose,stage);
}
/** Target is curtain-world y-up; the DOM adapter owns pointer/grip offsets and letterbox rejection. */
export function moveRodTo(template:PuppetTemplate,pose:Pose,stage:StageConfig,rod:RodId,target:Point,attachments:readonly string[]=[]) {
  if(template.control!=='user')throw new Error('只有沉香可以使用手动操纵杆。');
  if(!ROD_IDS.includes(rod)||!Number.isFinite(target.x)||!Number.isFinite(target.y))throw new Error('操纵杆目标无效。');
  let candidate:Pose;
  if(rod==='body') {
    const local=rodPoint(template,pose,rod),world=unprojectPoint(target,stage);
    candidate={...pose,x:(world.x-local.x*pose.scale*pose.facing)/WORLD_WIDTH+.5,
      y:.5-(world.y-local.y*pose.scale)/WORLD_HEIGHT};
  } else candidate=solveArm(template,pose,rod==='leftHand'?'left':'right',screenToLocalPoint(target,pose,stage));
  return constrainPoseToStage(candidate,template,stage,attachments);
}
export function moveRodBy(template:PuppetTemplate,pose:Pose,stage:StageConfig,rod:RodId,delta:Point,attachments:readonly string[]=[]) {
  const current=rodScreenPoint(template,pose,stage,rod);
  return moveRodTo(template,pose,stage,rod,{x:current.x+delta.x,y:current.y+delta.y},attachments);
}
