import type { AssetCatalog, RenderActor } from '../../content/asset-types';
import { constrainPose } from '../../domain/pose';
import { PATTERN_IDS, PALETTE_IDS } from '../../domain/limits';
import type { CanvasFrame } from './types';

const number = (value: number, min: number, max: number) => Number.isFinite(value) && value >= min && value <= max;
/** Validate before any image request or drawing. The renderer accepts data, never URLs/callbacks. */
export function prepareFrame(input: CanvasFrame, catalog: AssetCatalog): CanvasFrame {
  if (!Array.isArray(input.actors) || input.actors.length > 2) throw new Error('同一幕最多显示两个角色。');
  const scene = catalog.scenes.scenes.find(item => item.id === input.stage.backgroundId);
  if (!scene || !number(input.stage.lampX,-.8,.8) || !number(input.stage.puppetDistance,.05,.4)) throw new Error('灯位或舞台配置超出范围。');
  const ids = new Set<string>();
  const actors = input.actors.map(actor => {
    if (ids.has(actor.actorId)) throw new Error('同一角色不能在一幕中重复出现。'); ids.add(actor.actorId);
    const template = catalog.puppets.find(item => item.id === actor.templateId);
    if (!template || actor.templateId !== `${actor.actorId}-v1`) throw new Error('角色与分件模板不匹配。');
    if (actor.actorId === 'chenxiang') {
      const a=actor.appearance;
      if (!a || a.templateId !== 'chenxiang-v1' || !PATTERN_IDS.includes(a.patternId) || !PALETTE_IDS.includes(a.paletteId) ||
        !['body','sleeve','hem'].every(key => Number.isInteger(a.colorSlots[key as 'body']) && number(a.colorSlots[key as 'body'],0,4)) ||
        a.carvedSegments.length !== 3 || !a.carvedSegments.every(value => typeof value === 'boolean')) throw new Error('沉香的编辑外观无效。');
    } else if ((actor.actorId !== 'mother' && actor.actorId !== 'guardian') || actor.paletteId !== `${actor.actorId}-v1` ||
      'appearance' in actor || (actor.actorId === 'mother' && !PATTERN_IDS.includes(actor.sharedMotif))) throw new Error('固定角色须使用自己的配色与纹样配置。');
    return { ...actor, pose:constrainPose(actor.pose,template) } as RenderActor;
  });
  const layerIds = new Set<string>();
  for (const override of input.sceneLayers ?? []) {
    const layer = scene.layers.find(item => item.id === override.id);
    if (!layer || layerIds.has(override.id) || !number(override.x,...layer.xRange) || !number(override.y,...layer.yRange) || !number(override.opacity,...layer.opacityRange)) throw new Error('场景层参数无效或超出范围。');
    layerIds.add(override.id);
  }
  const props = new Set<string>();
  for (const attachment of input.attachments ?? []) {
    const actor = actors.find(item => item.actorId === attachment.actorId), key=`${attachment.actorId}/${attachment.attachmentId}`;
    if (!actor || props.has(key) || !catalog.puppets.find(item => item.id === actor.templateId)!.attachments.some(item => item.id === attachment.attachmentId)) throw new Error('附件不属于当前角色。');
    props.add(key);
  }
  if (input.showRods !== undefined && typeof input.showRods !== 'boolean') throw new Error('杆显示设置无效。');
  const actorOpacity:CanvasFrame['actorOpacity']={};
  if(input.actorOpacity!==undefined){
    if(!input.actorOpacity||typeof input.actorOpacity!=='object'||Array.isArray(input.actorOpacity))throw new Error('角色显影设置无效。');
    for(const [id,opacity]of Object.entries(input.actorOpacity)){
      if(!ids.has(id)||!number(opacity,0,1))throw new Error('角色显影设置无效。');
      actorOpacity[id as RenderActor['actorId']]=opacity;
    }
  }
  if(input.spatial && (![input.spatial.progress,input.spatial.light].every(v=>number(v,0,1))||typeof input.spatial.reducedMotion!=='boolean'||typeof input.spatial.backstage!=='boolean'||typeof input.spatial.nodeId!=='string'))throw new Error('空间分镜数据无效。');
  const sceneLayers=(input.sceneLayers??[]).map(layer=>({id:layer.id,x:layer.x,y:layer.y,opacity:layer.opacity}));
  return JSON.parse(JSON.stringify({ actors, stage:input.stage, sceneLayers, attachments:input.attachments ?? [], showRods:!!input.showRods,
    ...(input.spatial?{spatial:input.spatial}:{}),
    ...(input.actorOpacity===undefined?{}:{actorOpacity}) })) as CanvasFrame;
}
export function requiredAssets(frame: CanvasFrame, catalog: AssetCatalog): string[] {
  const ids = new Set<string>();
  for (const actor of frame.actors) {
    const template=catalog.puppets.find(item=>item.id===actor.templateId)!;
    // Canonical verification proves color/mask/regions alpha identical. Do not transfer that same alpha a third time.
    for (const part of template.parts) for (const id of [part.colorAssetId,part.colorMapAssetId]) ids.add(id);
    const patternId=actor.actorId==='chenxiang'?actor.appearance.patternId:actor.actorId==='mother'?actor.sharedMotif:null;
    if (patternId) for (const id of catalog.patterns.patterns.find(item=>item.id===patternId)!.segments) ids.add(id);
    for (const prop of template.attachments) if (frame.attachments?.some(item=>item.actorId===actor.actorId&&item.attachmentId===prop.id)) ids.add(prop.assetId);
  }
  for (const layer of catalog.scenes.scenes.find(item=>item.id===frame.stage.backgroundId)!.layers) ids.add(layer.assetId);
  return Array.from(ids);
}
