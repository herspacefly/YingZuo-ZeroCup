import {it,expect} from 'vitest';
import {assetCatalog} from '../../src/content/catalog';
import {defaultPose,createProject} from '../../src/domain/defaults';
const defaultStage=()=>createProject('p','w','2026-10-21T08:00:00.000Z').stage;
import {LIMBS,limbScreenPoint,moveLimbTo} from '../../src/domain/limb-input';
const template=assetCatalog.puppets.find(p=>p.id==='chenxiang-v1')!;
for(const facing of [1,-1] as const)for(const limb of LIMBS)it(`${facing}/${limb} moves toward a reachable endpoint without changing unrelated limbs`,()=>{
 const pose={...defaultPose(),facing},stage=defaultStage();const before=limbScreenPoint(template,pose,stage,limb),target={x:before.x+.07*facing,y:before.y+.04};
 const fit=moveLimbTo(template,pose,stage,limb,target),end=limbScreenPoint(template,fit.pose,stage,limb);
 expect(fit.fits).toBe(true);expect(Math.hypot(end.x-target.x,end.y-target.y)).toBeLessThan(Math.hypot(before.x-target.x,before.y-target.y));
 if(limb.endsWith('Foot')){expect(fit.pose.joints.rightShoulder).toBe(pose.joints.rightShoulder);expect(fit.pose.joints.rightElbow).toBe(pose.joints.rightElbow);}
 expect(pose.joints.leftKnee).toBe(0);
});
it('limits unreachable targets and rejects non-finite input',()=>{const p=defaultPose(),s=defaultStage();for(const id of LIMBS){const fit=moveLimbTo(template,p,s,id,{x:100,y:-100});expect(fit.fits).toBe(true);expect(Object.values(fit.pose.joints).every(Number.isFinite)).toBe(true);}expect(()=>moveLimbTo(template,p,s,'leftFoot',{x:NaN,y:0})).toThrow();});
