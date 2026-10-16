import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../../src/content/catalog';
import { neutralJointTransform, neutralPartTransform, safeAssetPath, validateAssetCatalog } from '../../src/content/asset-contract';
import type { AssetCatalog } from '../../src/content/asset-types';

const copy=(): AssetCatalog=>JSON.parse(JSON.stringify(assetCatalog));
describe('T01 asset consumers',()=>{
  it('accepts the connected three-template catalog and all referenced resources',()=>{
    expect(validateAssetCatalog(copy())).toEqual([]);
  });
  it('rejects missing resources, conflicting paths, wrong map dimensions and dangling backgrounds',()=>{
    const c=copy();c.manifest.assets.pop();c.manifest.assets[1]!.path=c.manifest.assets[0]!.path;
    c.manifest.assets[0]!.width++;
    c.scenes.scenes=c.scenes.scenes.filter(s=>s.id !== 'plain-v1');
    const errors=validateAssetCatalog(c).join(';');
    expect(errors).toContain('duplicate path');expect(errors).toContain('part image dimensions');expect(errors).toContain('reference/type');expect(errors).toContain('backgrounds required');
  });
  it.each(['../a.png','assets/puppets/../x.png','https://example.com/a.png','/assets/masks/x.png','assets/masks/x.svg','assets/masks/%2e%2e/x.png','assets\\masks\\x.png','assets/masks/x.png?remote=1'])('refuses external, encoded or executable paths %s',value=>{
    expect(safeAssetPath(value)).toBe(false);
  });
  it('rejects skeleton cycles before inspecting a transform',()=>{
    const c=copy();c.puppets[0]!.joints[0]!.parentJoint='head';
    expect(validateAssetCatalog(c).join(';')).toContain('cycle');
    expect(()=>neutralJointTransform(c.puppets[0]!,'head')).toThrow('cycle');
  });
  it('rejects unused joint motion and incorrect full Pose mapping',()=>{
    const c=copy();const mother=c.puppets[1]!;mother.joints.find(j=>j.jointId === 'leftHip')!.maxRad=.1;mother.joints.pop();
    const errors=validateAssetCatalog(c).join(';');expect(errors).toContain('unused joint zero');expect(errors).toContain('full nine joints');
  });
  it('rejects broken arm bend conventions, palette and motif bindings',()=>{
    const c=copy();c.puppets[0]!.arms[0]!.bendSign=1;c.puppets[1]!.motifPlacement!.source='appearance.patternId';c.palettes.palettes[0]!.colors[0]='red';
    const errors=validateAssetCatalog(c).join(';');expect(errors).toContain('arm left');expect(errors).toContain('motif source');expect(errors).toContain('palette vermilion-v1');
  });
  it('rejects unsafe scene parameters and reused carving segments',()=>{
    const c=copy();c.scenes.scenes[1]!.layers[0]!.x=Infinity;c.patterns.patterns[1]!.segments[0]=c.patterns.patterns[0]!.segments[0];
    const errors=validateAssetCatalog(c).join(';');expect(errors).toContain('scene layer');expect(errors).toContain('duplicate carving segment');
  });
  it.each(['missing','length','rod'])('rejects a broken IK consumer contract: %s',kind=>{
    const c=copy(),puppet=c.puppets[0]!;
    if(kind==='missing')puppet.arms=[];
    if(kind==='length')puppet.arms[1]!.upperLength=17;
    if(kind==='rod')puppet.rods.find(r=>r.id==='rightHand')!.partId='torso';
    expect(validateAssetCatalog(c).length).toBeGreaterThan(0);
  });
  it('rejects mountain layers moving behind the mother or using unreachable split ranges',()=>{
    const c=copy(),mountain=c.scenes.scenes.find(s=>s.id==='mountain-v1')!;
    mountain.layers.find(l=>l.id==='mountain-left')!.order=5;
    mountain.layers.find(l=>l.id==='mountain-right')!.xRange=[0,.2];
    const errors=validateAssetCatalog(c).join(';');expect(errors).toContain('occlusion order');expect(errors).toContain('split range');
  });
  it('keeps neutral hands at the declared two-bone length and feet inside 0.9-high bounds',()=>{
    const puppet=copy().puppets[0]!;
    const elbow=neutralJointTransform(puppet,'rightElbow');expect(elbow.x).toBeCloseTo(.085);expect(elbow.y).toBeCloseTo(.07);
    const shin=puppet.parts.find(p=>p.partId==='rightShin')!,t=neutralPartTransform(puppet,shin);
    expect(t.y+shin.bounds.minY).toBeCloseTo(-.30);
    puppet.bounds.minY=-.29;expect(validateAssetCatalog({...copy(),puppets:[puppet,...copy().puppets.slice(1)]}).join(';')).toContain('neutral bounds');
  });
  it('maps an image pivot to the joint after bind rotation instead of translating it twice',()=>{
    const puppet=copy().puppets[0]!,part=puppet.parts.find(p=>p.partId==='rightForearm')!;
    part.pivot=[.02,-.03];part.bindAngleRad=.7;
    const t=neutralPartTransform(puppet,part),j=neutralJointTransform(puppet,part.parentJoint);
    expect(t.x+Math.cos(t.angle)*part.pivot[0]-Math.sin(t.angle)*part.pivot[1]).toBeCloseTo(j.x);
    expect(t.y+Math.sin(t.angle)*part.pivot[0]+Math.cos(t.angle)*part.pivot[1]).toBeCloseTo(j.y);
  });
});
