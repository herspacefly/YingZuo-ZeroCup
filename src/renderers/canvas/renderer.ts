import type { AssetCatalog, Bounds, PuppetTemplate, RenderActor } from '../../content/asset-types';
import { attachmentTransform, jointTransform, partTransform, rodPoint } from '../../domain/pose';
import { fitViewport, projectLocalPoint } from '../../domain/projection';
import { PartCompositor } from './compositing';
import { prepareFrame, requiredAssets } from './frame';
import { TextureCache } from './texture-cache';
import type { CanvasFrame, CanvasStatus } from './types';

/** Event-driven renderer: update/resize draw once; the future director owns the only clock. */
export function mountCanvasRenderer(host: HTMLElement, catalog: AssetCatalog, onStatus: (status: CanvasStatus) => void) {
  const canvas=document.createElement('canvas'); canvas.className='shadow-stage'; canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','皮影舞台，人物与场景为原创皮影风格设计稿'); host.appendChild(canvas);
  const assets=new TextureCache(catalog.manifest), compositor=new PartCompositor(assets,catalog);
  let ctx: CanvasRenderingContext2D | null = null, frame: CanvasFrame | null=null, generation=0, disposed=false, ready=false, draws=0,lightweight=false;
  try { ctx=canvas.getContext('2d'); } catch { ctx=null; }
  function status(state: CanvasStatus['state'], message: string) {
    if (!disposed) { canvas.setAttribute('data-state',state); onStatus({state,message}); }
  }
  function clear() { if(ctx) { ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); } }
  function fail(error: unknown) {
    ready=false; assets.clear(); compositor.dispose(); clear(); status('error',error instanceof Error?error.message:String(error));
  }
  function drawImage(image: CanvasImageSource,b: Bounds) {
    ctx!.save(); ctx!.translate(b.minX,b.maxY); ctx!.scale(1,-1);
    ctx!.drawImage(image,0,0,b.maxX-b.minX,b.maxY-b.minY); ctx!.restore();
  }
  function drawActor(actor: RenderActor,template: PuppetTemplate) {
    const t=1.2/(1.2-frame!.stage.puppetDistance), root=projectLocalPoint({x:0,y:0},actor.pose,frame!.stage);
    ctx!.save(); ctx!.globalAlpha=frame!.actorOpacity?.[actor.actorId]??1; ctx!.translate(root.x,root.y); ctx!.scale(t*actor.pose.scale*actor.pose.facing,t*actor.pose.scale);
    const operations: { order:number; draw():void }[]=template.parts.map(part=>({order:part.drawOrder,draw(){
      const transform=partTransform(template,actor.pose,part);
      ctx!.save(); ctx!.translate(transform.x,transform.y); ctx!.rotate(transform.angle);
      drawImage(compositor.part(actor,template,part),part.bounds); ctx!.restore();
    }}));
    for (const prop of template.attachments) if (frame!.attachments!.some(item=>item.actorId===actor.actorId&&item.attachmentId===prop.id)) operations.push({order:prop.drawOrder,draw(){
      const transform=attachmentTransform(template,actor.pose,prop);
      ctx!.save(); ctx!.translate(transform.x,transform.y); ctx!.rotate(transform.angle); drawImage(assets.get(prop.assetId),prop.bounds); ctx!.restore();
    }});
    for (const op of operations.map((op,index)=>({...op,index})).sort((a,b)=>a.order-b.order||a.index-b.index)) op.draw();
    if (frame!.showRods) {
      ctx!.strokeStyle='rgba(70,44,27,.55)'; ctx!.lineWidth=.004;
      for (const rod of template.rods) {
        const point=rodPoint(template,actor.pose,rod.id);
        ctx!.beginPath(); ctx!.moveTo(point.x,point.y); ctx!.lineTo(point.x-.025,-.65); ctx!.stroke();
      }
      ctx!.fillStyle='#d7a253';
      for (const joint of template.joints.filter(item=>item.enabled)) { const p=jointTransform(template,actor.pose,joint.jointId); ctx!.beginPath(); ctx!.arc(p.x,p.y,.008,0,Math.PI*2); ctx!.fill(); }
    }
    ctx!.restore();
  }
  function draw() {
    if(disposed||!ready||!ctx||!frame) return;
    try {
      clear(); const v=fitViewport(canvas.width,canvas.height), scene=catalog.scenes.scenes.find(item=>item.id===frame!.stage.backgroundId)!;
      ctx.fillStyle='#17130f'; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.save();
      ctx.beginPath(); ctx.rect(v.x,v.y,v.width,v.height); ctx.clip(); ctx.fillStyle=scene.background; ctx.fillRect(v.x,v.y,v.width,v.height);
      const glow=ctx.createRadialGradient(v.x+v.width*(.5+frame.stage.lampX*.15),v.y+v.height*.4,0,v.x+v.width*.5,v.y+v.height*.5,v.width*.8);
      glow.addColorStop(0,'rgba(255,236,187,.28)'); glow.addColorStop(1,'rgba(120,78,36,.12)'); ctx.fillStyle=glow; ctx.fillRect(v.x,v.y,v.width,v.height);
      const layers=scene.layers.map(layer=>{
        const override=frame!.sceneLayers!.find(item=>item.id===layer.id);
        return {...layer,x:override?.x??layer.x,y:override?.y??layer.y,opacity:override?.opacity??layer.opacity};
      }).sort((a,b)=>a.order-b.order);
      const drawLayer=(layer:typeof layers[number])=>{ ctx!.globalAlpha=layer.opacity; ctx!.drawImage(assets.get(layer.assetId),v.x+layer.x*v.width,v.y+layer.y*v.height,v.width,v.height); ctx!.globalAlpha=1; };
      for(const layer of layers.filter(item=>item.order<catalog.scenes.actorOrder)) drawLayer(layer);
      ctx.save(); ctx.translate(v.x+v.width/2,v.y+v.height/2); ctx.scale(v.scale,-v.scale);
      for(const actor of frame.actors) drawActor(actor,catalog.puppets.find(item=>item.id===actor.templateId)!);
      ctx.restore(); for(const layer of layers.filter(item=>item.order>=catalog.scenes.actorOrder)) drawLayer(layer);
      ctx.restore(); draws++; canvas.setAttribute('data-draws',String(draws)); canvas.setAttribute('data-actors',frame.actors.map(actor=>actor.actorId).join(','));
      canvas.setAttribute('data-scene',frame.stage.backgroundId); status('ready',`幕上${frame.actors.length}位角色 · 皮影设计稿`);
    } catch(error) { if(ctx) { canvas.width=canvas.width; ctx=canvas.getContext('2d'); } fail(error); }
  }
  function resize() {
    if(disposed) return;
    const bounds=host.getBoundingClientRect(), width=Math.max(1,host.clientWidth||bounds.width||1024), height=Math.max(1,host.clientHeight||bounds.height||width*.75);
    const dpr=Math.min(window.devicePixelRatio||1,lightweight?1:2), limit=lightweight||width<=600?512:1024, ratio=Math.min(dpr,limit/width);
    canvas.width=Math.max(1,Math.round(width*ratio)); canvas.height=Math.max(1,Math.round(height*ratio)); draw();
  }
  async function update(input: CanvasFrame) {
    const token=++generation;
    if(disposed) return;
    if(!ctx) { fail(new Error('此浏览器无法启动 Canvas 2D，文字内容仍可阅读。')); return; }
    try {
      frame=prepareFrame(input,catalog); const ids=requiredAssets(frame,catalog);
      if(assets.hasAll(ids)) {assets.retain(ids);compositor.retain(frame.actors.map(actor=>actor.actorId));ready=true;draw();return;}
      ready=false;clear();status('loading','正在准备影偶与幕面…');
      await assets.load(ids);
      if(disposed||token!==generation) return;
      assets.retain(ids); compositor.retain(frame.actors.map(actor=>actor.actorId)); ready=true; resize();
    } catch(error) { if(!disposed&&token===generation) fail(error); }
  }
  const onResize=()=>resize(); window.addEventListener('resize',onResize);
  return {
    canvas, update, resize,
    setLightweight(enabled:boolean) {if(disposed)return;lightweight=enabled;canvas.setAttribute('data-quality',enabled?'lightweight':'original');resize();},
    reset() { generation++;ready=false;frame=null;assets.clear();compositor.dispose();clear(); },
    pause() { /* No renderer clock exists; the future director controls elapsed time. */ },
    dispose() { if(disposed)return; disposed=true;generation++;window.removeEventListener('resize',onResize);assets.dispose();compositor.dispose();frame=null;canvas.width=canvas.height=0;if(canvas.parentNode)canvas.parentNode.removeChild(canvas);ctx=null; },
  };
}
