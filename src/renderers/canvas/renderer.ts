import { limbLocalPoint } from '../../domain/limb-input';
import { cableCurve } from '../../domain/cables';
import { localToWorld, worldToLocal } from '../../domain/projection';
import type { AssetCatalog, Bounds, PuppetTemplate, RenderActor } from '../../content/asset-types';
import { attachmentTransform, jointTransform, partTransform, rodPoint } from '../../domain/pose';
import { fitViewport, projectLocalPoint, projectionParameters } from '../../domain/projection';
import { PartCompositor } from './compositing';
import { prepareFrame, requiredAssets,actorSceneOrder } from './frame';
import { TextureCache } from './texture-cache';
import { BackdropCache } from './backdrop-cache';
import type { CanvasFrame, CanvasStatus } from './types';

/** Event-driven renderer: update/resize draw once; the future director owns the only clock. */
export function mountCanvasRenderer(host: HTMLElement, catalog: AssetCatalog, onStatus: (status: CanvasStatus) => void) {
  const canvas=document.createElement('canvas'); canvas.className='shadow-stage'; canvas.setAttribute('role','img');
  canvas.setAttribute('aria-label','皮影舞台'); host.appendChild(canvas);
  const assets=new TextureCache(catalog.manifest), compositor=new PartCompositor(assets,catalog),backdrop=new BackdropCache();
  let ctx: CanvasRenderingContext2D | null = null, frame: CanvasFrame | null=null, generation=0, disposed=false, ready=false, draws=0,lightweight=false;
  try { ctx=canvas.getContext('2d'); } catch { ctx=null; }
  function status(state: CanvasStatus['state'], message: string) {
    if (!disposed) { canvas.setAttribute('data-state',state); onStatus({state,message}); }
  }
  function clear() { if(ctx) { ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,canvas.width,canvas.height); } }
  function fail(error: unknown) {
    ready=false;backdrop.clear();assets.clear();compositor.dispose();clear();status('error',error instanceof Error?error.message:String(error));
  }
  function drawImage(image: CanvasImageSource,b: Bounds) {
    ctx!.save(); ctx!.translate(b.minX,b.maxY); ctx!.scale(1,-1);
    ctx!.drawImage(image,0,0,b.maxX-b.minX,b.maxY-b.minY); ctx!.restore();
  }
  function drawActor(actor: RenderActor,template: PuppetTemplate) {
    const t=projectionParameters(frame!.stage).magnification, root=projectLocalPoint({x:0,y:0},actor.pose,frame!.stage);
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
      for (const rod of [...template.rods,...(actor.actorId==='chenxiang'?[{id:'leftFoot'},{id:'rightFoot'}]:[])]) {
        const point=rod.id==='leftFoot'||rod.id==='rightFoot'?limbLocalPoint(template,actor.pose,rod.id):rodPoint(template,actor.pose,rod.id);
        const world=localToWorld(point,actor.pose),end=worldToLocal({x:world.x-.025,y:-1.6},actor.pose);
        const motion=actor.actorId==='chenxiang'&&frame!.cableMotion?.source===rod.id?frame!.cableMotion:undefined;
        const curve=cableCurve(point,end,(motion?.bend??0)*actor.pose.facing/actor.pose.scale);
        ctx!.beginPath();ctx!.moveTo(point.x,point.y);ctx!.bezierCurveTo(curve.first.x,curve.first.y,curve.second.x,curve.second.y,end.x,end.y);ctx!.stroke();
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
      if(frame.shadowOnly){
        ctx.save();ctx.beginPath();ctx.rect(v.x,v.y,v.width,v.height);ctx.clip();
        ctx.translate(v.x+v.width/2,v.y+v.height/2);ctx.scale(v.scale,-v.scale);
        for(const actor of frame.actors)drawActor(actor,catalog.puppets.find(item=>item.id===actor.templateId)!);
        ctx.restore();if(frame.shadowColor!=='original'){ctx.save();ctx.globalCompositeOperation='source-in';ctx.fillStyle='rgba(61,34,26,.83)';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.restore();}
        draws++;canvas.setAttribute('data-draws',String(draws));canvas.setAttribute('data-shadow-only','true');canvas.setAttribute('data-actors',frame.actors.map(actor=>actor.actorId).join(','));status('ready','独立幕影已就绪 · 拖动幕后的灯，观察影子偏移与放大');return;
      }
      canvas.removeAttribute('data-shadow-only');
      const layers=scene.layers.map(layer=>{
        const override=frame!.sceneLayers!.find(item=>item.id===layer.id);
        return {...layer,x:override?.x??layer.x,y:override?.y??layer.y,opacity:override?.opacity??layer.opacity};
      }).sort((a,b)=>a.order-b.order);
      const behind=layers.filter(item=>item.order<catalog.scenes.actorOrder);
      const key=JSON.stringify([canvas.width,canvas.height,scene.id,scene.background,frame.stage.lampX,behind.map(layer=>[layer.id,layer.assetId,layer.x,layer.y,layer.opacity])]);
      backdrop.draw(ctx,key,canvas.width,canvas.height,target=>{
        target.save();
        try{
          target.setTransform(1,0,0,1,0,0);target.globalAlpha=1;
          target.fillStyle='#17130f';target.fillRect(0,0,canvas.width,canvas.height);
          target.beginPath();target.rect(v.x,v.y,v.width,v.height);target.clip();
          target.fillStyle=scene.background;target.fillRect(v.x,v.y,v.width,v.height);
          const glow=target.createRadialGradient(v.x+v.width*(.5+frame!.stage.lampX*.15),v.y+v.height*.4,0,v.x+v.width*.5,v.y+v.height*.5,v.width*.8);
          glow.addColorStop(0,'rgba(255,236,187,.28)');glow.addColorStop(1,'rgba(120,78,36,.12)');target.fillStyle=glow;target.fillRect(v.x,v.y,v.width,v.height);
          for(const layer of behind){target.globalAlpha=layer.opacity;target.drawImage(assets.get(layer.assetId),v.x+layer.x*v.width,v.y+layer.y*v.height,v.width,v.height);}
        }finally{target.restore();}
      });
      // The cached opaque buffer already contains its viewport edge coverage.
      // Copy it before establishing the actor/foreground clip, exactly once.
      ctx.save();ctx.beginPath();ctx.rect(v.x,v.y,v.width,v.height);ctx.clip();
      const drawLayer=(layer:typeof layers[number])=>{ ctx!.globalAlpha=layer.opacity; ctx!.drawImage(assets.get(layer.assetId),v.x+layer.x*v.width,v.y+layer.y*v.height,v.width,v.height); ctx!.globalAlpha=1; };
      const foreground=layers.filter(item=>item.order>=catalog.scenes.actorOrder),actorPlanes=frame.actors.map((actor,index)=>({actor,index,order:actorSceneOrder(frame!,catalog,actor.actorId)}));
      const planes=[...foreground.map(layer=>({order:layer.order,index:-1,draw:()=>drawLayer(layer)})),...actorPlanes.map(({actor,index,order})=>({order,index,draw:()=>{ctx!.save();try{ctx!.translate(v.x+v.width/2,v.y+v.height/2);ctx!.scale(v.scale,-v.scale);drawActor(actor,catalog.puppets.find(item=>item.id===actor.templateId)!);}finally{ctx!.restore();}}}))].sort((a,b)=>a.order-b.order||a.index-b.index);
      for(const plane of planes)plane.draw();
      ctx.restore(); draws++; canvas.setAttribute('data-draws',String(draws)); canvas.setAttribute('data-actors',frame.actors.map(actor=>actor.actorId).join(','));
      canvas.setAttribute('data-scene',frame.stage.backgroundId); status('ready','');
    } catch(error) { if(ctx) { canvas.width=canvas.width; ctx=canvas.getContext('2d'); } fail(error); }
  }
  function resize() {
    if(disposed) return;
    const bounds=host.getBoundingClientRect(), width=Math.max(1,host.clientWidth||bounds.width||1024), height=Math.max(1,host.clientHeight||bounds.height||width*.75);
    const dpr=Math.min(window.devicePixelRatio||1,lightweight?1:2), limit=lightweight||width<=600?512:1024, ratio=Math.min(dpr,limit/width);
    const nextWidth=Math.max(1,Math.round(width*ratio)),nextHeight=Math.max(1,Math.round(height*ratio));
    if(canvas.width!==nextWidth||canvas.height!==nextHeight)backdrop.clear();
    canvas.width=nextWidth;canvas.height=nextHeight;draw();
  }
  async function update(input: CanvasFrame) {
    const token=++generation;
    if(disposed) return;
    if(!ctx) { fail(new Error('此浏览器无法启动 Canvas 2D，文字内容仍可阅读。')); return; }
    try {
      frame=prepareFrame(input,catalog); const ids=requiredAssets(frame,catalog);
      if(assets.hasAll(ids)) {assets.retain(ids);compositor.retain(frame.actors.map(actor=>actor.actorId));ready=true;draw();return;}
      ready=false;backdrop.clear();clear();status('loading','正在准备影偶与幕面…');
      await assets.load(ids);
      if(disposed||token!==generation) return;
      assets.retain(ids); compositor.retain(frame.actors.map(actor=>actor.actorId)); ready=true; resize();
    } catch(error) { if(!disposed&&token===generation) fail(error); }
  }
  const onResize=()=>resize(); window.addEventListener('resize',onResize);
  return {
    canvas, update, resize,
    setLightweight(enabled:boolean) {if(disposed)return;lightweight=enabled;canvas.setAttribute('data-quality',enabled?'lightweight':'original');resize();},
    reset() { generation++;ready=false;frame=null;backdrop.clear();assets.clear();compositor.dispose();clear(); },
    pause() { /* No renderer clock exists; the future director controls elapsed time. */ },
    dispose() { if(disposed)return; disposed=true;generation++;window.removeEventListener('resize',onResize);backdrop.clear();assets.dispose();compositor.dispose();frame=null;canvas.width=canvas.height=0;if(canvas.parentNode)canvas.parentNode.removeChild(canvas);ctx=null; },
  };
}
