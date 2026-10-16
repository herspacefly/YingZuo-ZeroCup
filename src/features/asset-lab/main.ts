import './style.css';
import { assetCatalog as catalog } from '../../content/catalog';
import { neutralJointTransform, neutralPartTransform, validateAssetCatalog } from '../../content/asset-contract';
import type { Bounds, PuppetPart } from '../../content/asset-types';
import sources from '../../content/sources.json';

const byId = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`;
const status = byId('asset-status');
status.dataset.entry=import.meta.env.LEGACY ? 'legacy' : 'modern';
const controls = byId<HTMLFieldSetElement>('asset-controls');
const puppetCanvas = byId<HTMLCanvasElement>('puppet-canvas');
const sceneCanvas = byId<HTMLCanvasElement>('scene-canvas');
const select = (id: string) => byId<HTMLSelectElement>(id).value;
const checked = (id: string) => byId<HTMLInputElement>(id).checked;
const assets = new Map(catalog.manifest.assets.map(asset => [asset.id,asset]));
const images = new Map<string, HTMLImageElement>();
const cancellations = new Set<() => void>();
let generation = 0, disposed = false;
function loadImage(id: string): Promise<HTMLImageElement> {
  return new Promise((resolve,reject) => {
    const image = new Image();
    const finish = () => { image.onload = null; image.onerror = null; cancellations.delete(cancel); };
    const cancel = () => { finish(); image.src = ''; reject(new Error(`已取消加载 ${id}`)); };
    cancellations.add(cancel);
    image.onload = () => { finish(); resolve(image); };
    image.onerror = () => { finish(); reject(new Error(`无法加载 ${id}，请检查本地文件并重试。`)); };
    const asset = assets.get(id);
    if (!asset) { finish(); reject(new Error(`资源不在清单中：${id}`)); return; }
    image.src = assetUrl(asset.path);
  });
}
function image(id: string) { const result = images.get(id); if (!result) throw new Error(`尚未加载 ${id}`); return result; }
function drawLocal(ctx: CanvasRenderingContext2D, id: string, b: Bounds) {
  // Parent transform uses y up; PNG pixels use y down. Flip only the image.
  ctx.save(); ctx.translate(b.minX,b.maxY); ctx.scale(1,-1);
  ctx.drawImage(image(id),0,0,b.maxX-b.minX,b.maxY-b.minY); ctx.restore();
}
function renderPuppet() {
  const ctx=puppetCanvas.getContext('2d'); if(!ctx) throw new Error('Canvas2D 不可用。');
  const puppet=catalog.puppets.find(item=>item.id === select('puppet'))!;
  ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,800,600); ctx.translate(400,400);ctx.scale(400,-400);
  const ordered = [...puppet.parts].sort((a,b)=>a.drawOrder-b.drawOrder);
  const renderPart = (part: PuppetPart) => {
    const transform=neutralPartTransform(puppet,part);
    ctx.save();ctx.translate(transform.x,transform.y);ctx.rotate(transform.angle);
    // Isolate destination-out to this part; carving must not erase actors/scene behind.
    const layer=document.createElement('canvas'); layer.width=256;layer.height=512;
    const lc=layer.getContext('2d'); if(!lc) throw new Error('Canvas2D 不可用。');
    const assetId=select('map') === 'mask' ? part.maskAssetId : select('map') === 'regions' ? part.colorMapAssetId : part.colorAssetId;
    lc.drawImage(image(assetId),0,0,256,512);
    const motif=puppet.motifPlacement;
    if(checked('carve') && motif?.partId === part.partId) {
      const pattern=catalog.patterns.patterns.find(item=>item.id === select('pattern'))!;
      const b=part.bounds,m=motif.bounds;
      lc.globalCompositeOperation='destination-out';
      for(const segment of pattern.segments) lc.drawImage(image(segment),(m.minX-b.minX)/(b.maxX-b.minX)*256,(b.maxY-m.maxY)/(b.maxY-b.minY)*512,(m.maxX-m.minX)/(b.maxX-b.minX)*256,(m.maxY-m.minY)/(b.maxY-b.minY)*512);
    }
    ctx.save();ctx.translate(part.bounds.minX,part.bounds.maxY);ctx.scale(1,-1);ctx.drawImage(layer,0,0,part.bounds.maxX-part.bounds.minX,part.bounds.maxY-part.bounds.minY);ctx.restore();ctx.restore();
  };
  const operations=ordered.map(part=>({order:part.drawOrder,draw:()=>renderPart(part)}));
  if(checked('prop')) for(const prop of puppet.attachments) {
    operations.push({order:prop.drawOrder,draw:()=>{
    const host=puppet.parts.find(part=>part.partId === prop.partId)!;
    const transform=neutralPartTransform(puppet,host);
    ctx.save();ctx.translate(transform.x,transform.y);ctx.rotate(transform.angle);ctx.translate(prop.anchor[0],prop.anchor[1]);ctx.rotate(prop.bindAngleRad);ctx.translate(-prop.pivot[0],-prop.pivot[1]);
    drawLocal(ctx,prop.assetId,prop.bounds);
    if(checked('guides')) {ctx.strokeStyle='#B83B30';ctx.lineWidth=.003;ctx.strokeRect(prop.bounds.minX,prop.bounds.minY,prop.bounds.maxX-prop.bounds.minX,prop.bounds.maxY-prop.bounds.minY);}
    ctx.restore();
    }});
  }
  for(const operation of operations.sort((a,b)=>a.order-b.order)) operation.draw();
  if(checked('guides')) {
    ctx.strokeStyle='#B83B30';ctx.lineWidth=.003;const b=puppet.bounds;ctx.strokeRect(b.minX,b.minY,b.maxX-b.minX,b.maxY-b.minY);
    for(const joint of puppet.joints.filter(j=>j.enabled)) { const t=neutralJointTransform(puppet,joint.jointId);ctx.beginPath();ctx.arc(t.x,t.y,.009,0,Math.PI*2);ctx.stroke(); }
    for(const rod of puppet.rods) {
      const host=puppet.parts.find(p=>p.partId === rod.partId)!;const t=neutralPartTransform(puppet,host);
      const x=t.x+Math.cos(t.angle)*rod.point[0]-Math.sin(t.angle)*rod.point[1],y=t.y+Math.sin(t.angle)*rod.point[0]+Math.cos(t.angle)*rod.point[1];
      ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,-.42);ctx.stroke();
    }
  }
  byId('puppet-summary').textContent=`${puppet.label} · ${puppet.parts.length} 部件 · ${puppet.joints.filter(j=>j.enabled).length} 活动关节 · ${puppet.rods.length} 杆连接 · 高 0.9 world`;
  puppetCanvas.dataset.template=puppet.id;
}
function renderScene() {
  const ctx=sceneCanvas.getContext('2d'); if(!ctx) throw new Error('Canvas2D 不可用。');
  const scene=catalog.scenes.scenes.find(item=>item.id === select('scene'))!;
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;ctx.fillStyle=scene.background;ctx.fillRect(0,0,1024,768);
  const split=Number(byId<HTMLInputElement>('split').value)/100,dust=Number(byId<HTMLInputElement>('dust').value)/100;
  for(const layer of [...scene.layers].sort((a,b)=>a.order-b.order)) {
    const mountain=layer.id === 'mountain-left' || layer.id === 'mountain-right';
    const x=layer.x+(mountain ? (layer.id === 'mountain-left'?layer.xRange[0]:layer.xRange[1])*split : 0);
    ctx.globalAlpha=layer.id === 'mountain-dust' ? dust : mountain && scene.id === 'home-v1' ? split : layer.opacity;
    ctx.drawImage(image(layer.assetId),x*1024,layer.y*768,1024,768);
  }
  ctx.globalAlpha=1;sceneCanvas.dataset.scene=scene.id;
  byId('scene-summary').textContent=`${scene.label} · ${scene.layers.length} 层；演员绘制顺序 10，前景山片 20/21。山片与尘幕为示意图层。`;
}
function galleries() {
  const patterns=byId('pattern-gallery');patterns.textContent='';
  for(const pattern of catalog.patterns.patterns) for(const [index,id] of pattern.segments.entries()) {
    const figure=document.createElement('figure');const img=document.createElement('img'); img.src=image(id).src;img.alt=`${pattern.label}第${index+1}段镂空`;
    const caption=document.createElement('figcaption');caption.textContent=img.alt;figure.appendChild(img);figure.appendChild(caption);patterns.appendChild(figure);
  }
  const palettes=byId('palette-gallery');palettes.textContent='';
  for(const palette of catalog.palettes.palettes) {
    const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=palette.label;figure.appendChild(caption);
    for(const color of palette.colors) {const swatch=document.createElement('span');swatch.className='swatch';swatch.style.background=color;swatch.title=color;figure.appendChild(swatch);} palettes.appendChild(figure);
  }
  const list=byId('source-list');list.textContent='';
  for(const source of sources.sources) {
    const li=document.createElement('li'),link=document.createElement('a');link.href=source.url;link.textContent=`${source.id} · ${source.title}`;link.target='_blank';link.rel='noopener noreferrer';
    li.appendChild(link);li.appendChild(document.createTextNode(` — ${source.verificationMethod === 'page' ? '正文已读' : source.verificationMethod === 'official-search-index' ? '官方索引核对，原页超时' : '访问受阻，正文未核实'}（${source.checkedAt}）`));list.appendChild(li);
  }
}
function failure(error: unknown) {
  controls.disabled=true; status.dataset.state='error';status.textContent=error instanceof Error ? error.message : String(error);
  for(const canvas of [puppetCanvas,sceneCanvas]) { const ctx=canvas.getContext('2d');if(ctx){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);} }
}
async function load() {
  const token=++generation;for(const cancel of [...cancellations]) cancel();images.clear();controls.disabled=true;status.dataset.state='loading';status.textContent='正在加载并检查本地资源…';
  try {
    const errors=validateAssetCatalog(catalog);if(errors.length) throw new Error(errors.join('; '));
    const loaded=await Promise.all(catalog.manifest.assets.map(async asset=>[asset.id,await loadImage(asset.id)] as const));
    if(disposed || token !== generation) return;
    for(const [id,img] of loaded) images.set(id,img);
    galleries();renderPuppet();renderScene();controls.disabled=false;status.dataset.state='ready';
    status.textContent=`已加载 ${images.size} 张 PNG；资源结构可检查，全部仍为草稿，正式许可待确认。`;
  } catch(error) { if(!disposed && token === generation) { for(const cancel of [...cancellations]) cancel();failure(error); } }
}
const change=()=>{if(status.dataset.state === 'ready') try{renderPuppet();renderScene();}catch(error){failure(error);}};
const retry=()=>{void load();};
document.addEventListener('change',change);document.addEventListener('input',change);byId('retry-assets').addEventListener('click',retry);
function dispose() { disposed=true;generation++;for(const cancel of [...cancellations]) cancel();images.clear();document.removeEventListener('change',change);document.removeEventListener('input',change);byId('retry-assets').removeEventListener('click',retry); }
const onShow=(event: PageTransitionEvent)=>{if(event.persisted) window.location.reload();};
window.addEventListener('pagehide',dispose);window.addEventListener('pageshow',onShow);
if(import.meta.hot) import.meta.hot.dispose(()=>{dispose();window.removeEventListener('pagehide',dispose);window.removeEventListener('pageshow',onShow);});
void load();
