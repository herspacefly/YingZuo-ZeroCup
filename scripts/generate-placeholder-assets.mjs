// Original geometric drafts. No external media, fonts, random seed, or image editing.
// The committed JSON and PNGs are consumed at runtime; this tool is development only.
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from '@playwright/test';

const root = fileURLToPath(new URL('../', import.meta.url));
const existingManifest=path.join(root,'src/content/manifest.json');
if(existsSync(existingManifest)&&JSON.parse(readFileSync(existingManifest,'utf8')).provenance.kind!=='original-procedural-placeholder')throw new Error('Designed assets exist. Refusing to overwrite them with placeholders. Use the current design generator.');
const writeJSON = (file, value) => {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
  writeFileSync(path.join(root, file), JSON.stringify(value, null, 2) + '\n');
};
const joints = ['head', 'leftShoulder', 'leftElbow', 'rightShoulder', 'rightElbow', 'leftHip', 'leftKnee', 'rightHip', 'rightKnee'];
const bounds = (minX, minY, maxX, maxY) => ({ minX, minY, maxX, maxY });
const palettes = {
  assetVersion: 1, note: '本作原创设计配色，不代表某一流派统一传统五色。',
  palettes: [
    { id: 'vermilion-v1', label: '朱砂', editable: true, colors: ['#B83B30', '#D7A253', '#314C58', '#17130F', '#F2E5C9'] },
    { id: 'indigo-v1', label: '青岚', editable: true, colors: ['#314C58', '#8BA6A4', '#D7A253', '#17130F', '#F2E5C9'] },
    { id: 'woodland-v1', label: '山林', editable: true, colors: ['#4F6B49', '#A26A42', '#D7A253', '#17130F', '#F2E5C9'] },
    { id: 'mother-v1', label: '母亲固定色', editable: false, colors: ['#8BA6A4', '#D7A253', '#314C58', '#17130F', '#F2E5C9'] },
    { id: 'guardian-v1', label: '守关固定色', editable: false, colors: ['#314C58', '#A26A42', '#D7A253', '#17130F', '#F2E5C9'] },
  ],
};
const tasks = [];
function part(role, partId, parentJoint, box, shape, slot, drawOrder) {
  const prefix = `${role}-${partId.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)}`;
  const size = { width: Math.ceil((box.maxX - box.minX) * 640), height: Math.ceil((box.maxY - box.minY) * 640) };
  const record = { partId, parentJoint, pivot: [0, 0], bindAngleRad: 0, bounds: box, drawOrder,
    maskAssetId: `${prefix}-mask`, colorAssetId: `${prefix}-color`, colorMapAssetId: `${prefix}-regions` };
  for (const mode of ['color', 'mask', 'regions']) tasks.push({
    id: `${prefix}-${mode}`, type: mode === 'regions' ? 'color-map' : mode === 'mask' ? 'alpha-mask' : 'part-color',
    path: `assets/puppets/${role}/${partId}-${mode}.png`, ...size,
    usage: `puppet:${role}/${partId}`, draw: { kind: 'part', mode, shape, slot, palette: palettes.palettes.find(p => p.id === (role === 'chenxiang-v1' ? 'vermilion-v1' : role)).colors },
  });
  return record;
}
function template(role, label, simple) {
  const active = simple === 0 ? joints : simple === 1 ? joints.slice(0, 5) : ['head', 'rightShoulder', 'rightElbow'];
  const anchors = {
    head: [0, .30], leftShoulder: [-.085, .24], rightShoulder: [.085, .24],
    leftElbow: [0, -.17], rightElbow: [0, -.17], leftHip: [-.05, -.03], rightHip: [.05, -.03],
    leftKnee: [0, -.14], rightKnee: [0, -.14],
  };
  const parents = { leftElbow: 'leftShoulder', rightElbow: 'rightShoulder', leftKnee: 'leftHip', rightKnee: 'rightHip' };
  const limits = { head: [-.4, .4], leftShoulder: [-1.8, 1.4], rightShoulder: [-1.4, 1.8], leftElbow: [-2.4, 0], rightElbow: [0, 2.4], leftHip: [-.45, .45], rightHip: [-.45, .45], leftKnee: [0, .8], rightKnee: [-.8, 0] };
  const parts = [part(role, 'torso', null, bounds(-.115, simple ? -.30 : -.08, .115, .31), simple ? 'robe' : 'torso', 'body', 20)];
  parts.push(part(role, 'head', 'head', bounds(-.065, -.012, .12, .30), 'head', 'fixed', 40));
  for (const side of ['left', 'right']) {
    if (simple === 2 && side === 'left') continue;
    parts.push(part(role, `${side}UpperArm`, `${side}Shoulder`, bounds(-.043, -.185, .043, .025), 'sleeve', 'sleeve', side === 'left' ? 10 : 30));
    parts.push(part(role, `${side}Forearm`, `${side}Elbow`, bounds(-.034, -.17, .034, .018), 'hand', 'sleeve', side === 'left' ? 11 : 31));
    if (!simple) {
      parts.push(part(role, `${side}Thigh`, `${side}Hip`, bounds(-.036, -.155, .036, .02), 'limb', 'hem', 5));
      parts.push(part(role, `${side}Shin`, `${side}Knee`, bounds(-.035, -.13, .075, .018), 'boot', 'hem', 6));
    }
  }
  return { id: role, assetVersion: 1, label, control: simple ? 'scripted' : 'user', defaultPaletteId: simple ? role : 'vermilion-v1',
    units: 'world', nominalHeight: .9, coordinateSystem: 'x-right-y-up', root: 'torso-pivot',
    parts, joints: joints.map(id => ({ jointId: id, parentJoint: parents[id] ?? null, anchor: anchors[id], restAngleRad: 0,
      enabled: active.includes(id), minRad: active.includes(id) ? limits[id][0] * (simple ? .8 : 1) : 0,
      maxRad: active.includes(id) ? limits[id][1] * (simple ? .8 : 1) : 0, defaultRad: 0 })),
    arms: ['left', 'right'].filter(side => simple !== 2 || side === 'right').map(side => ({ side, shoulder: `${side}Shoulder`, elbow: `${side}Elbow`, handLocal: [0, -.15], upperLength: .17, lowerLength: .15, bendSign: side === 'left' ? -1 : 1 })),
    rods: [ { id: 'body', partId: 'torso', point: [0, .14] },
      ...['left', 'right'].filter(side => simple !== 2 || side === 'right').map(side => ({ id: `${side}Hand`, partId: `${side}Forearm`, point: [0, -.15] })) ],
    bounds: bounds(-.16, -.30, .16, .60),
    motionEnvelope: bounds(-.60, -.50, .60, .70),
    boundsMeaning: 'neutral-image-union; motionEnvelope is conservative before root scale/facing; attachments have separate bounds',
    motifPlacement: role === 'guardian-v1' ? null : { partId: simple ? 'rightUpperArm' : 'torso', bounds: simple ? bounds(-.025, -.14, .025, -.045) : bounds(-.065, -.035, .065, .23), source: simple ? 'castSnapshot.sharedMotif' : 'appearance.patternId', segments: simple ? 'all' : 'appearance.carvedSegments' },
    attachments: role === 'mother-v1' ? [] : [{ id: role === 'guardian-v1' ? 'staff' : 'axe', assetId: role === 'guardian-v1' ? 'guardian-staff' : 'chenxiang-axe', partId: 'rightForearm', anchor: [0, -.15], pivot: [0, 0], bounds: bounds(-.05, -.22, .14, .12), bindAngleRad: 0, drawOrder: 35, defaultVisible: false }],
    note: '原创几何占位；十/六/四部件为本作数字简化，不是传统影偶标准。未使用的九关节 Pose 字段必须为 0。',
  };
}
const puppets = [template('chenxiang-v1', '沉香', 0), template('mother-v1', '母亲', 1), template('guardian-v1', '二郎神', 2)];
for (const [id, shape] of [['chenxiang-axe', 'axe'], ['guardian-staff', 'staff']]) tasks.push({ id, type: 'prop', path: `assets/puppets/${id}.png`, width: 122, height: 218, usage: `attachment:${id}`, draw: { kind: 'prop', shape } });
const patterns = ['cloud-v1', 'wave-v1', 'flower-v1'].map((id, index) => ({ id, label: ['云纹', '水纹', '花纹'][index],
  operation: 'destination-out', alphaMeaning: 'cut-away', mapping: 'stretch-to-placement-bounds',
  segments: [0, 1, 2].map(segment => {
    const assetId = `${id}-cut-${segment + 1}`;
    tasks.push({ id: assetId, type: 'carving-mask', path: `assets/masks/${assetId}.png`, width: 128, height: 256, usage: `pattern:${id}/segment:${segment + 1}`, draw: { kind: 'pattern', pattern: index, segment } });
    return assetId;
  }), note: '原创几何纹样示意，不作传统纹样复原声明。',
}));
const sceneLayer = (id, order, offsetRange = [0, 0]) => {
  const assetId = `scene-${id}`;
  tasks.push({ id: assetId, type: 'scene-layer', path: `assets/scenes/${id}.png`, width: 1024, height: 768, usage: `scene-layer:${id}`, draw: { kind: 'scene', layer: id } });
  return { id, assetId, order, x: 0, y: 0, opacity: 1, xRange: offsetRange, yRange: [0, 0], opacityRange: [0, 1] };
};
const mountainFar = sceneLayer('mountain-far', 0);
const leftMountain = sceneLayer('mountain-left', 20, [-.55, 0]);
const rightMountain = sceneLayer('mountain-right', 21, [0, .55]);
const dust = sceneLayer('mountain-dust', 30);
const scenes = { assetVersion: 1, coordinates: 'normalized-screen-x-right-y-down', actorOrder: 10, layerOrder: 'ascending',
  scenes: [
    { id: 'plain-v1', label: '素幕', background: '#F2E5C9', layers: [] },
    { id: 'home-v1', label: '家中与窗灯', background: '#F2E5C9', layers: [sceneLayer('home-window', 0), sceneLayer('home-floor', 1), { ...leftMountain, opacity: 0 }, { ...rightMountain, opacity: 0 }] },
    { id: 'road-v1', label: '山路与阻拦', background: '#E3DECF', layers: [mountainFar, sceneLayer('road-near', 2), sceneLayer('road-path', 3), sceneLayer('road-ledge', 4)] },
    { id: 'mountain-v1', label: '山前与团圆', background: '#F2E5C9', layers: [mountainFar, leftMountain, rightMountain, { ...dust, opacity: 0 }] },
  ], note: '母亲先绘于 actorOrder=10，前景山片20/21遮挡；开合为归一化 x 位移，尘幕为 opacity。无可执行回调。',
};

const browser = await chromium.launch();
let outputs;
try {
  const page = await browser.newPage();
  outputs = await page.evaluate(specs => {
    return specs.map(spec => {
      const canvas = document.createElement('canvas'); canvas.width = spec.width; canvas.height = spec.height;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas2D unavailable');
      const w = canvas.width, h = canvas.height, d = spec.draw;
      ctx.scale(w, h);
      const polygon = (points, fill) => { ctx.fillStyle = fill; ctx.beginPath(); points.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); ctx.fill(); };
      const ellipse = (x, y, rx, ry, fill) => { ctx.fillStyle = fill; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); };
      if (d.kind === 'part') {
        const shapes = {
          torso: [[.18,.02],[.82,.02],[.98,.92],[.75,1],[.25,1],[.02,.92]],
          robe: [[.23,.01],[.77,.01],[1,.97],[.7,1],[.3,1],[0,.97]],
          head: [[.26,.07],[.6,0],[.7,.11],[.69,.32],[.82,.43],[1,.48],[.83,.56],[.86,.7],[.67,.77],[.64,1],[.31,1],[.27,.78],[.14,.65],[.12,.38]],
          sleeve: [[.22,0],[.78,0],[1,.8],[.72,1],[.28,1],[0,.8]],
          hand: [[.25,0],[.75,0],[.8,.74],[.98,.85],[.8,.98],[.35,1],[.17,.86],[.2,.71]],
          limb: [[.2,0],[.8,0],[.9,.9],[.65,1],[.3,1],[.1,.9]],
          boot: [[.15,0],[.58,0],[.56,.67],[1,.78],[1,1],[.06,1],[0,.79]],
        };
        const codes = { body: '#FF0000', sleeve: '#00FF00', hem: '#0000FF', fixed: '#FFFF00' };
        const paletteIndex = { body: 0, sleeve: 1, hem: 2, fixed: 1 };
        const fill = d.mode === 'mask' ? '#FFFFFF' : d.mode === 'regions' ? codes[d.slot] : d.palette[paletteIndex[d.slot]];
        polygon(shapes[d.shape], fill);
        const silhouette = ctx.getImageData(0,0,w,h);
        if ((d.shape === 'robe' || d.shape === 'torso') && d.mode !== 'mask') {
          ctx.save(); ctx.globalCompositeOperation = 'source-atop'; ctx.fillStyle = d.mode === 'regions' ? codes.hem : d.palette[2]; ctx.fillRect(0,.79,1,.21); ctx.restore();
        }
        if (d.mode === 'color' && d.shape === 'head') {
          ctx.save(); ctx.globalCompositeOperation = 'source-atop';
          polygon([[.25,.08],[.6,.01],[.69,.12],[.67,.30],[.13,.37]], d.palette[3]);
          ellipse(.69,.42,.025,.023,d.palette[3]);
          ctx.restore();
        }
        // Reuse the exact silhouette coverage for all three maps. Labels are nearest
        // discrete codes, never blended RGB values at a region/antialias boundary.
        ctx.resetTransform(); const data = ctx.getImageData(0,0,w,h);
        for (let i=0; i<data.data.length; i+=4) {
          data.data[i+3] = silhouette.data[i+3];
          if (data.data[i+3] && d.mode === 'regions') {
            const labels = [[255,0,0],[0,255,0],[0,0,255],[255,255,0]];
            labels.sort((a,b)=>a.reduce((sum,v,c)=>sum+(v-data.data[i+c])**2,0)-b.reduce((sum,v,c)=>sum+(v-data.data[i+c])**2,0));
            for (let c=0;c<3;c++) data.data[i+c]=labels[0][c];
          }
        }
        ctx.putImageData(data,0,0);
      } else if (d.kind === 'prop') {
        polygon([[.37,.05],[.48,.05],[.48,1],[.37,1]], '#A26A42');
        if(d.shape === 'axe') polygon([[.4,.04],[.93,.12],[.85,.4],[.42,.3]], '#314C58');
        else { polygon([[.42,.02],[.64,.2],[.54,.31],[.42,.22],[.3,.31],[.2,.2]], '#D7A253'); }
      } else if (d.kind === 'pattern') {
        const y = .15 + d.segment * .32;
        if (d.pattern === 0) { ellipse(.32,y,.17,.035,'white'); ellipse(.55,y-.035,.18,.055,'white'); ellipse(.72,y,.16,.035,'white'); }
        if (d.pattern === 1) { ctx.strokeStyle='white';ctx.lineWidth=.035;ctx.beginPath();ctx.moveTo(.13,y);ctx.bezierCurveTo(.35,y-.12,.58,y+.12,.87,y);ctx.stroke(); }
        if (d.pattern === 2) { for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipse(.5+Math.cos(a)*.16,y+Math.sin(a)*.065,.075,.033,'white');}ellipse(.5,y,.055,.023,'white'); }
      } else if (d.kind === 'scene') {
        switch (d.layer) {
          case 'home-window':
            ctx.strokeStyle='#A26A42';ctx.lineWidth=.009;ctx.strokeRect(.12,.12,.3,.43);ctx.beginPath();ctx.moveTo(.27,.12);ctx.lineTo(.27,.55);ctx.moveTo(.12,.335);ctx.lineTo(.42,.335);ctx.stroke();ellipse(.78,.25,.055,.08,'#D7A253');break;
          case 'home-floor': polygon([[0,.85],[1,.85],[1,1],[0,1]], '#A26A42');break;
          case 'mountain-far': polygon([[0,.5],[.2,.13],[.44,.46],[.68,.06],[1,.53],[1,1],[0,1]], '#8BA6A4');break;
          case 'road-near': polygon([[0,.64],[.27,.42],[.46,.68],[.74,.28],[1,.62],[1,1],[0,1]], '#314C58');break;
          case 'road-path': polygon([[.37,1],[.65,1],[.55,.69],[.63,.57],[.57,.57],[.48,.7]], '#D7A253');break;
          case 'road-ledge': polygon([[.69,.8],[.86,.79],[.97,.93],[.66,.93]], '#A26A42');break;
          case 'mountain-left': polygon([[0,.39],[.22,.16],[.49,.05],[.51,.45],[.46,.73],[.51,1],[0,1]], '#314C58');break;
          case 'mountain-right': polygon([[.49,.05],[.74,.17],[1,.4],[1,1],[.51,1],[.54,.73],[.51,.45]], '#314C58');break;
          case 'mountain-dust': for(let i=0;i<7;i++) ellipse(.2+i*.1,.84-(i%2)*.06,.12,.09,'#D7A253AA');break;
          default: throw new Error(`Unknown scene ${d.layer}`);
        }
      } else throw new Error(`Unknown kind ${d.kind}`);
      return canvas.toDataURL('image/png').split(',')[1];
    });
  }, tasks);
} finally { await browser.close(); }
const creator = 'Codex / scripts/generate-placeholder-assets.mjs';
const assets = tasks.map((task, i) => {
  const png = Buffer.from(outputs[i], 'base64'); const target = path.join(root, 'public', task.path);
  mkdirSync(path.dirname(target), { recursive: true }); writeFileSync(target, png);
  const { draw: _draw, ...entry } = task;
  return { ...entry, creator, sourceUrl: '', license: 'unknown', credit: '影作原创几何占位（AI 辅助程序生成）', reviewStatus: 'draft', sha256: createHash('sha256').update(png).digest('hex') };
});
writeJSON('src/content/manifest.json', { assetVersion: 1, provenance: {
  kind: 'original-procedural-placeholder', generator: 'scripts/generate-placeholder-assets.mjs', tool: `Playwright 1.64.1 / Chromium ${browser.version()} / Canvas2D`,
  intent: '依据 T01 统一坐标生成原创占位轮廓、三种几何镂空和场景层；不是传统流派复原或正式美术。',
  externalMedia: false, manualEdits: 'none', licenseNote: '未代团队授予版权许可；unknown 待团队确认。',
}, colorMapEncoding: { body: [255,0,0], sleeve: [0,255,0], hem: [0,0,255], fixed: [255,255,0], outside: 'alpha=0', fixedMeaning: 'preserve-source-color', sampling: 'nearest' }, assets });
writeJSON('src/content/palettes.json', palettes);
writeJSON('src/content/patterns.json', { assetVersion: 1, patterns });
writeJSON('src/content/scenes.json', scenes);
for (const puppet of puppets) writeJSON(`src/content/puppets/${puppet.id}.json`, puppet);
const columns = ['id','type','path','creator','sourceUrl','license','credit','usage','reviewStatus','sha256'];
const csv = value => `"${String(value).replaceAll('"','""')}"`;
writeFileSync(path.join(root,'docs/assets.csv'), columns.join(',')+'\n'+assets.map(asset => columns.map(key => csv(asset[key])).join(',')).join('\n')+'\n');
console.log(`Generated ${assets.length} original draft PNGs and assetVersion=1 contracts; licenses remain unknown, review pending.`);
