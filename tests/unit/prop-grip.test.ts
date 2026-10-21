import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../../src/content/catalog';
import { validateAssetCatalog } from '../../src/content/asset-contract';
import { defaultPose } from '../../src/domain/defaults';
import { sampleAction } from '../../src/domain/actions';
import { attachmentTransform, constrainPoseToStage, partTransform, rodPoint, transformPoint } from '../../src/domain/pose';

const chenxiang=assetCatalog.puppets.find(p=>p.id==='chenxiang-v1')!;
const stage={backgroundId:'plain-v1' as const,lampX:0,puppetDistance:.2};
describe('held props',()=>{
  it('keeps the hanging ring at its moving palm while gravity stays down, including nonzero image pivots',()=>{
    const lantern=structuredClone(chenxiang.attachments.find(a=>a.id==='lantern')!);
    lantern.pivot=[.01,-.03];
    const host=chenxiang.parts.find(p=>p.partId===lantern.partId)!;
    for(const facing of [1,-1] as const)for(const [shoulder,elbow]of [[0,0],[1.45,1.35],[-.8,.2],[.8,2.4]]){
      const pose={...defaultPose(),facing};pose.joints.rightShoulder=shoulder!;pose.joints.rightElbow=elbow!;
      const held=attachmentTransform(chenxiang,pose,lantern);
      const grip=transformPoint({x:lantern.pivot[0],y:lantern.pivot[1]},held);
      const palm=transformPoint({x:lantern.anchor[0],y:lantern.anchor[1]},partTransform(chenxiang,pose,host));
      expect(grip.x).toBeCloseTo(palm.x,12);expect(grip.y).toBeCloseTo(palm.y,12);
      expect(held.angle).toBe(0);
      expect(transformPoint({x:0,y:-.2},held).y).toBeLessThan(held.y);
    }
  });
  it('keeps omitted orientation compatible with the original rigid host transform',()=>{
    const axe=structuredClone(chenxiang.attachments.find(a=>a.id==='axe')!);
    const pose=defaultPose();pose.joints.rightShoulder=.8;pose.joints.rightElbow=1.1;
    delete axe.orientation;
    const old=attachmentTransform(chenxiang,pose,axe);axe.orientation='follow-host';
    expect(attachmentTransform(chenxiang,pose,axe)).toEqual(old);
    const host=chenxiang.parts.find(p=>p.partId===axe.partId)!;
    expect(old.angle-partTransform(chenxiang,pose,host).angle).toBeCloseTo(axe.bindAngleRad,12);
  });
  it('places the grip beyond the wrist and below the hand layer without moving the rod or IK endpoint',()=>{
    for(const template of assetCatalog.puppets)for(const prop of template.attachments){
      const pose=defaultPose(),arm=template.arms.find(a=>a.side==='right')!;
      const forearm=template.parts.find(p=>p.partId===prop.partId)!;
      const wrist=transformPoint({x:arm.handLocal[0],y:arm.handLocal[1]},partTransform(template,pose,forearm));
      expect(rodPoint(template,pose,'rightHand')).toEqual(wrist);
      expect(prop.anchor[1]).toBeLessThan(arm.handLocal[1]);
      expect(prop.anchor[0]).toBeGreaterThan(arm.handLocal[0]);
      expect(prop.drawOrder).toBeLessThan(forearm.drawOrder);
      expect(prop.drawOrder).toBeGreaterThan(template.parts.find(p=>p.partId==='rightUpperArm')!.drawOrder);
      if(prop.id!=='lantern')expect(Math.abs(prop.bindAngleRad)).toBeGreaterThan(1);
    }
  });
  it('fits the complete axe through large-elbow training and the actual raised/lowered interaction in both facings',()=>{
    for(const facing of [1,-1] as const){
      const base={...defaultPose(),facing};
      for(const time of [0,700,1300,1800,2400,2800])expect(sampleAction('raise-axe-v1',base,time,chenxiang,stage).fits).toBe(true);
      for(const angle of [0,1,1.2,1.4,-.5,.2]){
        const pose=structuredClone(base);pose.joints.rightShoulder=angle;
        expect(constrainPoseToStage(pose,chenxiang,stage,['axe']).fits).toBe(true);
      }
    }
  });
  it('rejects unknown attachment orientation instead of silently changing the transform contract',()=>{
    const catalog=structuredClone(assetCatalog);
    Object.assign(catalog.puppets[0]!.attachments[0]!,{orientation:'screen'});
    expect(validateAssetCatalog(catalog).join(';')).toContain('attachment transform');
  });
});
