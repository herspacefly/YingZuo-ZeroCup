import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../../src/content/catalog';
import { defaultPose } from '../../src/domain/defaults';
import { moveRodBy, moveRodTo, rodScreenPoint } from '../../src/domain/rod-input';
import type { Pose,StageConfig } from '../../src/domain/types';
const chen=assetCatalog.puppets.find(item=>item.id==='chenxiang-v1')!;
const stage:StageConfig={backgroundId:'plain-v1',lampX:0,puppetDistance:.2};
describe('three rod inverse projection input',()=>{
  it('moves the actual body connection without losing its local offset or mirror/scale',()=>{
    for(const facing of [1,-1] as const)for(const scale of [.6,.8])for(const lampX of [-.8,0,.8]){
      const pose:Pose={...defaultPose(),facing,scale},light={...stage,lampX},point=rodScreenPoint(chen,pose,light,'body');
      const target={x:point.x+.025,y:point.y+.02},result=moveRodTo(chen,pose,light,'body',target);
      expect(result.fits).toBe(true);const actual=rodScreenPoint(chen,result.pose,light,'body');
      expect(actual.x).toBeCloseTo(target.x,8);expect(actual.y).toBeCloseTo(target.y,8);expect(result.pose.joints).toEqual(pose.joints);
    }
  });
  it('reaches both hands through the same screen transform, including facing left',()=>{
    for(const side of ['left','right'] as const)for(const facing of [1,-1] as const){
      const pose:Pose={...defaultPose(),facing,scale:.6},desired:Pose={...pose,joints:{...pose.joints,[`${side}Shoulder`]:side==='left'?-.7:.7,[`${side}Elbow`]:side==='left'?-.6:.6}};
      const light={...stage,lampX:.65},rod=`${side}Hand` as const,target=rodScreenPoint(chen,desired,light,rod),result=moveRodTo(chen,pose,light,rod,target);
      const actual=rodScreenPoint(chen,result.pose,light,rod);expect(actual.x).toBeCloseTo(target.x,8);expect(actual.y).toBeCloseTo(target.y,8);
      expect(result.pose.x).toBe(pose.x);expect(result.pose.y).toBe(pose.y);expect(pose.joints[`${side}Shoulder`]).toBe(0);
    }
  });
  it('clamps extreme drag to the actual posed silhouette including the axe',()=>{
    const result=moveRodBy(chen,defaultPose(),stage,'body',{x:100,y:-100},['axe']);expect(result.fits).toBe(true);
    expect(result.bounds.minX).toBeGreaterThanOrEqual(-.960000001);expect(result.bounds.maxX).toBeLessThanOrEqual(.960000001);
    expect(result.bounds.minY).toBeGreaterThanOrEqual(-.710000001);expect(result.bounds.maxY).toBeLessThanOrEqual(.710000001);
  });
  it('rejects fixed roles, invalid rods and non-finite targets',()=>{
    const mother=assetCatalog.puppets.find(item=>item.id==='mother-v1')!;
    expect(()=>moveRodTo(mother,defaultPose(),stage,'body',{x:0,y:0})).toThrow('只有沉香');
    expect(()=>moveRodTo(chen,defaultPose(),stage,'bad' as 'body',{x:0,y:0})).toThrow('目标无效');
    expect(()=>moveRodTo(chen,defaultPose(),stage,'body',{x:NaN,y:0})).toThrow('目标无效');
  });
});
