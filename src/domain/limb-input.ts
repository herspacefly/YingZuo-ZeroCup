import type { PuppetTemplate } from '../content/asset-types';
import type { Pose, StageConfig } from './types';
import { constrainPose, constrainPoseToStage, partTransform, rodPoint, solveArm, transformPoint } from './pose';
import { projectLocalPoint, screenToLocalPoint } from './projection';
import type { Point } from './projection';

export type LimbId='leftHand'|'rightHand'|'leftFoot'|'rightFoot';
export const LIMBS:readonly LimbId[]=['leftHand','rightHand','leftFoot','rightFoot'];
export function limbLocalPoint(template:PuppetTemplate,pose:Pose,id:LimbId):Point{
  if(id.endsWith('Hand'))return rodPoint(template,pose,id);
  const part=template.parts.find(p=>p.partId===(id==='leftFoot'?'leftShin':'rightShin'))!;
  return transformPoint({x:(part.bounds.minX+part.bounds.maxX)/2,y:part.bounds.minY+.012},partTransform(template,pose,part));
}
export function limbScreenPoint(template:PuppetTemplate,pose:Pose,stage:StageConfig,id:LimbId){return projectLocalPoint(limbLocalPoint(template,pose,id),pose,stage);}
/** A bounded two-joint search respects asymmetric knee limits and never flips the bend branch. */
export function moveLimbTo(template:PuppetTemplate,pose:Pose,stage:StageConfig,id:LimbId,target:Point,attachments:readonly string[]=[]){
  if(template.control!=='user'||!LIMBS.includes(id)||![target.x,target.y].every(Number.isFinite))throw new Error('四肢目标无效。');
  const local=screenToLocalPoint(target,pose,stage);let next=constrainPose(pose,template);
  if(id.endsWith('Hand'))next=solveArm(template,next,id==='leftHand'?'left':'right',local);
  else{
    const hip=id==='leftFoot'?'leftHip':'rightHip',knee=id==='leftFoot'?'leftKnee':'rightKnee';
    const h=template.joints.find(j=>j.jointId===hip)!,k=template.joints.find(j=>j.jointId===knee)!;
    const score=(p:Pose)=>{const end=limbLocalPoint(template,p,id);return (end.x-local.x)**2+(end.y-local.y)**2;};
    let best=score(next);
    // Coarse coverage followed by local refinement avoids singular straight-leg traps.
    for(let a=0;a<=12;a++)for(let b=0;b<=8;b++){
      const candidate={...next,joints:{...next.joints,[hip]:h.minRad+(h.maxRad-h.minRad)*a/12,[knee]:k.minRad+(k.maxRad-k.minRad)*b/8}};
      const cost=score(candidate);if(cost<best){best=cost;next=candidate;}
    }
    for(let step=.08;step>.001;step/=2)for(const joint of [hip,knee] as const)for(const sign of [-1,1]){
      const candidate=constrainPose({...next,joints:{...next.joints,[joint]:next.joints[joint]+step*sign}},template),cost=score(candidate);
      if(cost<best){best=cost;next=candidate;}
    }
  }
  return constrainPoseToStage(next,template,stage,attachments);
}
