import { describe, expect, it } from 'vitest';
import { assetCatalog } from '../../src/content/catalog';
import { defaultAppearance, defaultPose } from '../../src/domain/defaults';
import { prepareFrame, requiredAssets } from '../../src/renderers/canvas/frame';
import type { CanvasFrame } from '../../src/renderers/canvas/types';

const frame=():CanvasFrame=>({actors:[{actorId:'chenxiang',templateId:'chenxiang-v1',appearance:defaultAppearance(),pose:defaultPose()},
  {actorId:'mother',templateId:'mother-v1',paletteId:'mother-v1',sharedMotif:'wave-v1',pose:defaultPose()}],stage:{backgroundId:'home-v1',lampX:0,puppetDistance:.2}});
describe('production drawing boundary',()=>{
  it('fades only current actors with finite alpha while keeping their geometry and resources loaded',()=>{
    const input=frame();input.actorOpacity={mother:.2};const ready=prepareFrame(input,assetCatalog);
    expect(ready.actorOpacity).toEqual({mother:.2});expect(requiredAssets(ready,assetCatalog)).toContain('mother-v1-head-color');expect(requiredAssets(ready,assetCatalog)).not.toContain('mother-v1-head-mask');
    input.actorOpacity.mother=1;expect(ready.actorOpacity!.mother).toBe(.2);
    for(const invalid of [{mother:NaN},{mother:1.1},{guardian:.5}])expect(()=>prepareFrame({...frame(),actorOpacity:invalid},assetCatalog)).toThrow('显影');
  });
  it('takes an independent frame and keeps fixed palette and motif separate from editor changes',()=>{
    const input=frame(),ready=prepareFrame(input,assetCatalog); input.actors[0]!.pose.x=.8;
    if(input.actors[0]!.actorId==='chenxiang')input.actors[0]!.appearance.patternId='flower-v1';
    expect(ready.actors[0]!.pose.x).toBe(.5); expect(ready.actors[1]).toMatchObject({actorId:'mother',paletteId:'mother-v1',sharedMotif:'wave-v1'});
    expect(ready.actors[1]).not.toHaveProperty('appearance');
  });
  it('rejects a third actor, repeated actor, mismatched template and editable fixed role',()=>{
    const bad=frame();bad.actors.push({...bad.actors[0]!});expect(()=>prepareFrame(bad,assetCatalog)).toThrow('最多');
    bad.actors.pop();bad.actors[1]=bad.actors[0]!;expect(()=>prepareFrame(bad,assetCatalog)).toThrow('重复');
    const wrong=frame();Object.assign(wrong.actors[1]!,{templateId:'chenxiang-v1'});expect(()=>prepareFrame(wrong,assetCatalog)).toThrow('不匹配');
    const editable=frame();Object.assign(editable.actors[1]!,{appearance:defaultAppearance()});expect(()=>prepareFrame(editable,assetCatalog)).toThrow('固定角色');
  });
  it('rejects invalid stage, unknown layers, out-of-range mountain offset and attachment host',()=>{
    const bad=frame();bad.stage.puppetDistance=1.2;expect(()=>prepareFrame(bad,assetCatalog)).toThrow('灯位');
    const layer=frame();layer.sceneLayers=[{id:'unlisted',x:0,y:0,opacity:1}];expect(()=>prepareFrame(layer,assetCatalog)).toThrow('场景');
    layer.sceneLayers=[{id:'mountain-left',x:.2,y:0,opacity:1}];expect(()=>prepareFrame(layer,assetCatalog)).toThrow('场景');
    const prop=frame();prop.attachments=[{actorId:'mother',attachmentId:'axe'}];expect(()=>prepareFrame(prop,assetCatalog)).toThrow('附件');
  });
  it('loads only the current actors, motifs, visible props and scene; no arbitrary URL',()=>{
    const input=frame(),ids=requiredAssets(prepareFrame(input,assetCatalog),assetCatalog);
    expect(ids).toContain('chenxiang-v1-head-color');expect(ids).toContain('chenxiang-v1-head-regions');expect(ids.some(id=>id.endsWith('-mask'))).toBe(false);expect(ids).toContain('wave-v1-cut-1');
    expect(ids).not.toContain('guardian-v1-head-mask');expect(ids).not.toContain('chenxiang-axe');
    input.attachments=[{actorId:'chenxiang',attachmentId:'axe'}];
    expect(requiredAssets(prepareFrame(input,assetCatalog),assetCatalog)).toContain('chenxiang-axe');
    for(const id of ids)expect(assetCatalog.manifest.assets.some(asset=>asset.id===id)).toBe(true);
  });
  it('does not let extra override fields change scene order or bitmap identity',()=>{
    const input=frame();input.sceneLayers=[{id:'mountain-left',x:0,y:0,opacity:1}];
    Object.assign(input.sceneLayers[0]!,{order:-1,assetId:'chenxiang-axe'});
    expect(prepareFrame(input,assetCatalog).sceneLayers).toEqual([{id:'mountain-left',x:0,y:0,opacity:1}]);
  });
});
