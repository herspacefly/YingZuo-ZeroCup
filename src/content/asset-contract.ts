// Self contained erasable TypeScript: shared by Vite, tests and Node 24 verify:assets.
import type { AssetCatalog, AssetEntry, Bounds, PuppetPart, PuppetTemplate } from './asset-types';

const JOINTS = ['head', 'leftShoulder', 'leftElbow', 'rightShoulder', 'rightElbow', 'leftHip', 'leftKnee', 'rightHip', 'rightKnee'];
const ids = (items: { id: string }[]) => items.map(item => item.id).sort().join(',');
const finite = (v: number) => typeof v === 'number' && Number.isFinite(v);
const point = (v: number[]) => Array.isArray(v) && v.length === 2 && v.every(finite);
const box = (v: Bounds) => v && [v.minX, v.minY, v.maxX, v.maxY].every(finite) && v.minX < v.maxX && v.minY < v.maxY;
export function safeAssetPath(value: string): boolean {
  return typeof value === 'string' && /^assets\/(puppets|masks|scenes)\/[a-zA-Z0-9/_-]+\.png$/.test(value) && !value.split('/').includes('..');
}
export function validateAssetCatalog(catalog: AssetCatalog): string[] {
  const errors: string[] = [];
  const check = (ok: unknown, message: string) => { if (!ok) errors.push(message); };
  // Repository-owned JSON, not an import format. Catch malformed shapes as a failed check.
  try {
    const { manifest, puppets, palettes, patterns, scenes } = catalog;
    for (const config of [manifest, ...puppets, palettes, patterns, scenes]) check(config.assetVersion === 1, 'assetVersion must be 1');
    check(['original-procedural-placeholder','original-vector-design','original-ai-reference-cutout'].includes(manifest.provenance.kind) && !!manifest.provenance.generator && !!manifest.provenance.tool && !!manifest.provenance.intent, 'provenance missing');
    check(manifest.colorMapEncoding.sampling === 'nearest' && manifest.colorMapEncoding.fixedMeaning === 'preserve-source-color' && manifest.colorMapEncoding.outside === 'alpha=0', 'color map semantics');
    check(manifest.colorMapEncoding.recolor === undefined || ['replace','source-relative-rgb'].includes(manifest.colorMapEncoding.recolor), 'color map recolor mode');
    for (const [slot, value] of Object.entries({ body: [255,0,0], sleeve: [0,255,0], hem: [0,0,255], fixed: [255,255,0] })) check(JSON.stringify(manifest.colorMapEncoding[slot as 'body']) === JSON.stringify(value), `color code ${slot}`);
    const assets = new Map<string, AssetEntry>(); const paths = new Set<string>(); const referenced = new Set<string>();
    for (const asset of manifest.assets) {
      check(!assets.has(asset.id) && /^[a-z][a-z0-9-]+$/.test(asset.id), `duplicate/invalid asset id ${asset.id}`);
      check(!paths.has(asset.path) && safeAssetPath(asset.path), `unsafe/duplicate path ${asset.path}`);
      check(['part-color','alpha-mask','color-map','prop','carving-mask','scene-layer'].includes(asset.type), `asset type ${asset.id}`);
      check([asset.width,asset.height].every(v => Number.isInteger(v) && v > 0 && v <= 2048), `dimensions ${asset.id}`);
      check(/^[a-f0-9]{64}$/.test(asset.sha256), `hash ${asset.id}`);
      check(!!asset.creator && !!asset.license && !!asset.credit && !!asset.usage, `metadata ${asset.id}`);
      check(['draft','reviewed','rejected'].includes(asset.reviewStatus), `review status ${asset.id}`);
      check(asset.sourceUrl === '' || /^https:\/\//.test(asset.sourceUrl), `source URL ${asset.id}`);
      assets.set(asset.id, asset); paths.add(asset.path);
    }
    const ref = (id: string, type: AssetEntry['type']) => { const asset = assets.get(id); check(asset?.type === type, `asset reference/type ${id} expected ${type}`); referenced.add(id); return asset; };
    check(ids(puppets) === 'chenxiang-v1,guardian-v1,mother-v1', 'three templates required');
    for (const puppet of puppets) {
      const context = puppet.id;
      check(puppet.units === 'world' && puppet.coordinateSystem === 'x-right-y-up' && puppet.root === 'torso-pivot' && puppet.nominalHeight === .9, `${context}: units/root`);
      check(box(puppet.bounds) && Math.abs(puppet.bounds.maxY-puppet.bounds.minY-.9) < 1e-8 && box(puppet.motionEnvelope), `${context}: bounds`);
      check(puppet.joints.map(j => j.jointId).sort().join(',') === [...JOINTS].sort().join(','), `${context}: full nine joints`);
      const jointMap = new Map(puppet.joints.map(j => [j.jointId,j]));
      for (const joint of puppet.joints) {
        check(point(joint.anchor) && [joint.restAngleRad,joint.minRad,joint.maxRad,joint.defaultRad].every(finite), `${context}: finite joint ${joint.jointId}`);
        check(joint.minRad <= joint.defaultRad && joint.defaultRad <= joint.maxRad && joint.minRad >= -3.141593 && joint.maxRad <= 3.141593, `${context}: joint limits ${joint.jointId}`);
        check(typeof joint.enabled === 'boolean' && (joint.enabled || (joint.minRad === 0 && joint.maxRad === 0 && joint.defaultRad === 0 && joint.restAngleRad === 0)), `${context}: unused joint zero ${joint.jointId}`);
        const visited = new Set<string>([joint.jointId]); let parent = joint.parentJoint;
        while (parent !== null) {
          if (visited.has(parent) || !jointMap.has(parent)) { check(false, `${context}: joint cycle/missing parent ${parent}`); break; }
          visited.add(parent); parent = jointMap.get(parent)!.parentJoint;
        }
      }
      const parts = new Map(puppet.parts.map(p => [p.partId,p]));
      check(parts.size === puppet.parts.length && parts.get('torso')?.parentJoint === null && puppet.parts.filter(p => p.parentJoint === null).length === 1, `${context}: torso/unique parts`);
      for (const part of puppet.parts) {
        check((part.parentJoint === null || jointMap.get(part.parentJoint)?.enabled) && box(part.bounds) && point(part.pivot) && finite(part.bindAngleRad) && finite(part.drawOrder), `${context}: part transform ${part.partId}`);
        const masks = [ref(part.maskAssetId, 'alpha-mask'), ref(part.colorAssetId, 'part-color'), ref(part.colorMapAssetId, 'color-map')];
        check(masks.every(asset => asset?.width === masks[0]?.width && asset?.height === masks[0]?.height), `${context}: part image dimensions ${part.partId}`);
        const transform = neutralPartTransform(puppet,part);
        for (const x of [part.bounds.minX,part.bounds.maxX]) for (const y of [part.bounds.minY,part.bounds.maxY]) {
          const wx=transform.x+Math.cos(transform.angle)*x-Math.sin(transform.angle)*y;
          const wy=transform.y+Math.sin(transform.angle)*x+Math.cos(transform.angle)*y;
          check(wx>=puppet.bounds.minX-1e-8 && wx<=puppet.bounds.maxX+1e-8 && wy>=puppet.bounds.minY-1e-8 && wy<=puppet.bounds.maxY+1e-8, `${context}: neutral bounds ${part.partId}`);
        }
      }
      for(const joint of puppet.joints.filter(j=>j.enabled)) check(puppet.parts.some(part=>part.parentJoint === joint.jointId), `${context}: active joint has no part ${joint.jointId}`);
      check(puppet.parts.length === ({ 'chenxiang-v1': 10, 'mother-v1': 6, 'guardian-v1': 4 }[puppet.id]), `${context}: simplified parts`);
      check(puppet.control === (puppet.id === 'chenxiang-v1' ? 'user' : 'scripted'), `${context}: control`);
      check(palettes.palettes.some(p => p.id === puppet.defaultPaletteId), `${context}: default palette`);
      const rodIds = new Set<string>();
      for (const rod of puppet.rods) { check(!rodIds.has(rod.id) && parts.has(rod.partId) && point(rod.point), `${context}: rod ${rod.id}`); rodIds.add(rod.id); }
      check(rodIds.has('body') && rodIds.has('rightHand') && (puppet.id !== 'chenxiang-v1' || rodIds.has('leftHand')), `${context}: rod targets`);
      const expectedSides=puppet.id === 'guardian-v1' ? ['right'] : ['left','right'];
      check(puppet.arms.map(a=>a.side).sort().join(',') === expectedSides.join(','), `${context}: required arm chains`);
      const near=(a: number,b: number)=>Math.abs(a-b)<1e-8;
      for (const arm of puppet.arms) {
        const elbow=jointMap.get(arm.elbow),forearm=parts.get(`${arm.side}Forearm`),upper=parts.get(`${arm.side}UpperArm`);
        const rod=puppet.rods.find(r=>r.id === `${arm.side}Hand`);
        check(arm.shoulder === `${arm.side}Shoulder` && arm.elbow === `${arm.side}Elbow` && jointMap.get(arm.shoulder)?.enabled && elbow?.parentJoint === arm.shoulder && [arm.upperLength,arm.lowerLength].every(v => finite(v) && v > 0) && point(arm.handLocal) && arm.bendSign === (arm.side === 'left' ? -1 : 1), `${context}: arm ${arm.side}`);
        check(elbow && near(arm.upperLength,Math.hypot(...elbow.anchor)) && near(arm.lowerLength,Math.hypot(...arm.handLocal)), `${context}: arm lengths ${arm.side}`);
        check(upper?.parentJoint === arm.shoulder && forearm?.parentJoint === arm.elbow && rod?.partId === forearm?.partId && rod && near(rod.point[0],arm.handLocal[0]) && near(rod.point[1],arm.handLocal[1]), `${context}: hand rod chain ${arm.side}`);
      }
      check(puppet.rods.length === expectedSides.length+1 && puppet.rods.find(r=>r.id === 'body')?.partId === 'torso', `${context}: rod count/body`);
      for (const attachment of puppet.attachments) { ref(attachment.assetId,'prop'); check(parts.has(attachment.partId) && point(attachment.anchor) && point(attachment.pivot) && box(attachment.bounds) && finite(attachment.bindAngleRad) && finite(attachment.drawOrder) && typeof attachment.defaultVisible === 'boolean', `${context}: attachment transform`); }
      const motif = puppet.motifPlacement;
      check(puppet.id === 'guardian-v1' ? motif === null : !!motif, `${context}: motif required`);
      if (motif) {
        const host = parts.get(motif.partId);
        check(host && box(motif.bounds) && motif.bounds.minX >= host.bounds.minX && motif.bounds.maxX <= host.bounds.maxX && motif.bounds.minY >= host.bounds.minY && motif.bounds.maxY <= host.bounds.maxY, `${context}: motif host bounds`);
        check(motif.source === (puppet.id === 'mother-v1' ? 'castSnapshot.sharedMotif' : 'appearance.patternId') && motif.segments === (puppet.id === 'mother-v1' ? 'all' : 'appearance.carvedSegments'), `${context}: motif source`);
      }
    }
    check(ids(palettes.palettes) === 'guardian-v1,indigo-v1,mother-v1,vermilion-v1,woodland-v1', 'five palettes required');
    for (const palette of palettes.palettes) check(palette.colors.length === 5 && palette.colors.every(v => /^#[A-F0-9]{6}$/.test(v)) && palette.editable === !['mother-v1','guardian-v1'].includes(palette.id), `palette ${palette.id}`);
    check(ids(patterns.patterns) === 'cloud-v1,flower-v1,wave-v1', 'three patterns required');
    const segmentIds = new Set<string>();
    for (const pattern of patterns.patterns) {
      check(pattern.operation === 'destination-out' && pattern.alphaMeaning === 'cut-away' && pattern.mapping === 'stretch-to-placement-bounds' && pattern.segments.length === 3, `pattern semantics ${pattern.id}`);
      for (const id of pattern.segments) { ref(id,'carving-mask'); check(!segmentIds.has(id), `duplicate carving segment ${id}`); segmentIds.add(id); }
    }
    check(new Set([...segmentIds].map(id=>assets.get(id)?.sha256)).size === 9, 'carving masks must be nine distinct images');
    check(scenes.coordinates === 'normalized-screen-x-right-y-down' && scenes.layerOrder === 'ascending' && scenes.actorOrder === 10, 'scene coordinates/order');
    check(ids(scenes.scenes) === 'home-v1,mountain-v1,plain-v1,road-v1', 'all stage backgrounds required');
    const range = (r: number[], initial: number) => point(r) && r[0]! <= initial && initial <= r[1]!;
    for (const scene of scenes.scenes) {
      check(/^#[A-F0-9]{6}$/.test(scene.background), `scene color ${scene.id}`);
      const layerIds = new Set<string>(); const orders = new Set<number>();
      for (const layer of scene.layers) {
        ref(layer.assetId,'scene-layer');
        check(!layerIds.has(layer.id) && !orders.has(layer.order) && [layer.order,layer.x,layer.y,layer.opacity].every(finite) && range(layer.xRange,layer.x) && range(layer.yRange,layer.y) && range(layer.opacityRange,layer.opacity) && layer.opacityRange[0] >= 0 && layer.opacityRange[1] <= 1, `scene layer ${scene.id}/${layer.id}`);
        layerIds.add(layer.id); orders.add(layer.order);
      }
      const expectedLayers={
        'plain-v1': [], 'home-v1': ['home-window','home-floor','mountain-left','mountain-right'],
        'road-v1': ['mountain-far','road-near','road-path','road-ledge'],
        'mountain-v1': ['mountain-far','mountain-left','mountain-right','mountain-dust'],
      }[scene.id];
      check([...layerIds].sort().join(',') === [...expectedLayers].sort().join(','), `required scene layers ${scene.id}`);
      for(const layer of scene.layers) {
        check(layer.assetId === `scene-${layer.id}`, `scene layer binding ${layer.id}`);
        const foreground=layer.id === 'mountain-left' || layer.id === 'mountain-right' || layer.id === 'mountain-dust';
        check(foreground ? layer.order>scenes.actorOrder : layer.order<scenes.actorOrder, `scene occlusion order ${layer.id}`);
        if(layer.id === 'mountain-left' || layer.id === 'mountain-right') check(JSON.stringify(layer.xRange) === (layer.id === 'mountain-left' ? '[-0.55,0]' : '[0,0.55]') && layer.x === 0, `mountain split range ${layer.id}`);
      }
    }
    check(referenced.size === assets.size && [...assets.keys()].every(id => referenced.has(id)), 'unreferenced allowlist assets');
  } catch (error) { errors.push(`malformed asset contract: ${error instanceof Error ? error.message : String(error)}`); }
  return errors;
}

// Local neutral transforms for contract inspection. T04 owns runtime pose/IK/projection.
export interface LocalTransform { x: number; y: number; angle: number }
export function neutralJointTransform(template: PuppetTemplate, id: string | null, visited = new Set<string>()): LocalTransform {
  if (id === null) return { x: 0, y: 0, angle: 0 };
  if(visited.has(id)) throw new Error(`Joint cycle ${id}`);
  visited.add(id);
  const joint = template.joints.find(item => item.jointId === id);
  if (!joint) throw new Error(`Missing joint ${id}`);
  const parent = neutralJointTransform(template, joint.parentJoint, visited);
  const c = Math.cos(parent.angle), s = Math.sin(parent.angle);
  return { x: parent.x+c*joint.anchor[0]-s*joint.anchor[1], y: parent.y+s*joint.anchor[0]+c*joint.anchor[1], angle: parent.angle+joint.restAngleRad+joint.defaultRad };
}
export function neutralPartTransform(template: PuppetTemplate, part: PuppetPart): LocalTransform {
  const joint=neutralJointTransform(template,part.parentJoint),angle=joint.angle+part.bindAngleRad;
  return {x:joint.x-Math.cos(angle)*part.pivot[0]+Math.sin(angle)*part.pivot[1],y:joint.y-Math.sin(angle)*part.pivot[0]-Math.cos(angle)*part.pivot[1],angle};
}
