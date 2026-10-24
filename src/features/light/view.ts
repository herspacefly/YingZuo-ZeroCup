import './light.css';
import { append, element, link, scope } from '../shared/dom';
import { editable, heading, pageLinks } from '../shared/pieces';
import { assetCatalog } from '../../content/catalog';
import { defaultPose } from '../../domain/defaults';
import { minimumLampDepth, projectionParameters } from '../../domain/projection';
import { mountCanvasRenderer } from '../../renderers/canvas/renderer';
import type { mountThreeStage } from '../../renderers/three/renderer';
import type { CanvasFrame } from '../../renderers/canvas/types';
import type { PageFactory } from '../../app/view';
import type { StoreState } from '../../app/store';

type Spatial = ReturnType<typeof mountThreeStage>;
export const mountLight: PageFactory = (host, ctx) => {
  const life=scope();append(host,heading('一束光','走到幕后的灯影工坊。','影偶安静站在幕前。请拖动发亮的灯：左右移动看影子反向偏移，向影偶靠近看影子放大。'),pageLinks());
  const layout=element('section','workspace light-workspace'),figure=element('figure','stage-figure lamp-workshop'),spatialHost=element('div','lamp-spatial-host'),shadowHost=element('div','lamp-shadow-host'),caption=element('figcaption'),status=element('p','lamp-status'),toggle=element('button','button secondary','改用二维灯影'),retry=element('button','button secondary','重试三维灯影'),retryShadow=element('button','button secondary','重试幕影素材');
  spatialHost.setAttribute('aria-label','幕后三维调灯工坊：拖动发光灯具');shadowHost.setAttribute('aria-label','独立幕影');status.setAttribute('role','status');retry.hidden=true;retryShadow.hidden=true;
  append(caption,element('p','','木台 · 织幕 · 灯 · 影偶与真正的幕影。只拖灯，不移动影偶。'),status,toggle,retry,retryShadow);append(figure,spatialHost,shadowHost,caption);
  const panel=element('div','control-panel'),field=element('fieldset');field.appendChild(element('legend','','在灯与幕之间'));
  let state:StoreState|null=null,disposed=false,spatial:Spatial|null=null,latest:CanvasFrame|null=null,generation=0,loading=false,fallback=false,originReady=false;
  let drag:{id:number;offset:{x:number;depth:number};kind:'pointer'|'mouse'}|null=null;
  const allowed=()=>!!state&&editable(state)&&!state.hasPending&&!ctx.isBusy();
  function release(){drag=null;spatialHost.classList.remove('is-dragging');}
  function mode(two:boolean){fallback=two;release();shadowHost.hidden=!two;spatialHost.hidden=two;toggle.textContent=two?'展开三维灯影':'改用二维灯影';plan.hidden=!two;if(two){generation++;loading=false;spatial?.dispose();spatial=null;status.textContent='二维灯影已就绪；拖动下方俯视图中的灯，或使用滑块。';renderer.resize();}else void open();}
  function fail(message:string){mode(true);retry.hidden=false;status.textContent='三维灯影暂不可用：'+message+' 二维灯影可完整继续。';}
  const renderer=mountCanvasRenderer(shadowHost,assetCatalog,update=>{originReady=update.state==='ready';if(update.state==='error'){mode(true);retryShadow.hidden=false;status.textContent=update.message;return;}if(update.state==='ready')retryShadow.hidden=true;if(originReady){if(!fallback&&!spatial&&!loading)void open();if(spatial&&latest)void spatial.update(latest);}});
  renderer.canvas.setAttribute('aria-label','织幕上的独立棕色影子，随灯位和灯距变化');
  function position(x:number,depth:number){if(!allowed()||!latest)return;const min=minimumLampDepth(latest.stage);ctx.edit({type:'LAMP_POSITION',lampX:Math.max(-.8,Math.min(.8,x)),lampDepth:Math.max(min,Math.min(2.4,depth))});}
  async function open(){
    if(disposed||loading||fallback||!latest||!originReady)return;
    if(typeof window.WebGL2RenderingContext!=='function'||import.meta.env.LEGACY){fail('当前浏览器没有可用的 WebGL 2。');return;}
    const token=++generation;loading=true;status.textContent='正在点亮木台与织幕…';retry.hidden=true;
    let moduleLoaded=false;try{const module=await import('../../renderers/three/renderer');moduleLoaded=true;if(disposed||token!==generation||fallback)return;
      const narrow=window.innerWidth<=600;const next=module.mountThreeStage(spatialHost,renderer.canvas,{pixelRatio:Math.min(window.devicePixelRatio||1,narrow?1:1.5),maxWidth:narrow?512:1024,textureSize:narrow?512:1024},update=>{
        if(disposed||token!==generation)return;if(update.state==='error'||update.state==='lost'){fail(update.message);return;}status.textContent=update.state==='ready'?'拖动金色灯具，观察同一影偶投在织幕上的影子。':update.message;
      });
      if(disposed||token!==generation){next.dispose();return;}spatial=next;next.setView('lamp-workshop');await next.update(latest!);loading=false;
    }catch(error){if(!disposed&&token===generation)fail(moduleLoaded?(error instanceof Error?error.message:String(error)):'三维组件未能载入，请检查网络后重试。');}
  }
  function begin(x:number,y:number,id:number,kind:'pointer'|'mouse'){if(!allowed()||fallback||!spatial)return false;const offset=spatial.pickLamp(x,y);if(!offset)return false;drag={id,kind,offset};spatialHost.classList.add('is-dragging');return true;}
  function move(x:number,y:number){if(!drag||!allowed()){release();return;}const p=spatial?.lampPlanePoint(x,y);if(p)position(p.x-drag.offset.x,p.depth-drag.offset.depth);}
  if(window.PointerEvent){life.on(spatialHost,'pointerdown',e=>{const p=e as PointerEvent;if(p.button===0&&begin(p.clientX,p.clientY,p.pointerId,'pointer')){p.preventDefault();spatialHost.setPointerCapture?.(p.pointerId);}});life.on(window,'pointermove',e=>{const p=e as PointerEvent;if(drag?.kind==='pointer'&&drag.id===p.pointerId){p.preventDefault();move(p.clientX,p.clientY);}});for(const event of ['pointerup','pointercancel','lostpointercapture'])life.on(window,event,release);
  }else{life.on(spatialHost,'mousedown',e=>{const p=e as MouseEvent;if(p.button===0&&begin(p.clientX,p.clientY,0,'mouse'))p.preventDefault();});life.on(window,'mousemove',e=>{if(drag?.kind==='mouse'){const p=e as MouseEvent;move(p.clientX,p.clientY);}});life.on(window,'mouseup',release);}
  life.on(window,'blur',release);life.on(document,'visibilitychange',()=>{if(document.hidden)release();});
  const lamp=element('input'),depth=element('input'),lampOutput=element('output'),depthOutput=element('output');
  function range(label:string,input:HTMLInputElement,output:HTMLOutputElement,id:string,min:number,max:number,change:(value:number)=>void){const group=element('label','range-control',label);input.type='range';input.id=id;input.min=String(min);input.max=String(max);input.step='.01';input.setAttribute('aria-label',label);output.setAttribute('for',id);append(group,output,input);field.appendChild(group);for(const name of ['input','change'])life.on(input,name,()=>{release();if(allowed())change(Number(input.value));});}
  range('灯的左右位置',lamp,lampOutput,'light-lamp',-.8,.8,x=>position(x,projectionParameters(latest!.stage).lampDepth));
  range('灯离幕的距离',depth,depthOutput,'light-distance',.6,2.4,d=>position(latest!.stage.lampX,d));
  const pad=element('div','direction-pad');pad.setAttribute('role','group');pad.setAttribute('aria-label','逐步移动灯具');
  for(const [label,dx,dd]of [['灯向左',-.05,0],['灯向右',.05,0],['灯靠近影偶',0,-.05],['灯远离影偶',0,.05]]as const){const b=element('button','',label);pad.appendChild(b);life.on(b,'click',()=>{release();if(latest)position(latest.stage.lampX+dx,projectionParameters(latest.stage).lampDepth+dd);});}field.appendChild(pad);
  const plan=element('div','lamp-plan');plan.hidden=true;const planTitle=element('p','quiet-note','俯视图：拖动金色灯点，蓝线影偶保持原位。');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 360 250');svg.setAttribute('role','img');svg.setAttribute('aria-label','灯、固定影偶与幕的俯视图');
  const screen=document.createElementNS(svg.namespaceURI,'path');screen.setAttribute('d','M 30 20 H 330');screen.setAttribute('class','lamp-plan-screen');svg.appendChild(screen);
  const puppet=document.createElementNS(svg.namespaceURI,'path');puppet.setAttribute('class','lamp-plan-puppet');svg.appendChild(puppet);
  const ray=document.createElementNS(svg.namespaceURI,'path');ray.setAttribute('class','lamp-plan-rays');svg.appendChild(ray);
  const dot=document.createElementNS(svg.namespaceURI,'circle');dot.setAttribute('r','14');dot.setAttribute('class','lamp-plan-dot');svg.appendChild(dot);append(plan,planTitle);plan.appendChild(svg);
  let planDrag=false;function planMove(e:PointerEvent){if(!planDrag||!latest||!allowed())return;const r=svg.getBoundingClientRect();position(((e.clientX-r.left)/r.width*360-180)/160,((e.clientY-r.top)/r.height*250-20)/85);}
  life.on(dot,'pointerdown',event=>{const e=event as PointerEvent;if(!allowed())return;e.preventDefault();planDrag=true;dot.setPointerCapture?.(e.pointerId);});life.on(dot,'pointermove',event=>planMove(event as PointerEvent));for(const name of ['pointerup','pointercancel','lostpointercapture'])life.on(dot,name,()=>{planDrag=false;});life.on(window,'blur',()=>{planDrag=false;});
  const reset=element('button','button secondary','重置灯位'),save=element('button','button secondary','保存灯影设置'),summary=element('p','selection-summary');summary.id='light-summary';
  append(field,reset);append(panel,field,plan,summary,save,element('p','quiet-note','影偶站位固定。这里保存灯影实验，不改变本场剧情灯位。'),link('去看“一盏灯，两种尺度” →','#/museum/E04'));
  const next=element('button','button primary journey-recommended','保存灯影，下一步练习 →');next.id='journey-to-practice';const nextBox=element('section','journey-next');append(nextBox,element('p','','第3步 / 调灯：看清灯、偶与影的关系，接下来亲手牵动影偶。'),next);panel.appendChild(nextBox);
  append(layout,figure,panel);host.appendChild(layout);shadowHost.hidden=true;
  life.on(retryShadow,'click',()=>{if(latest)void renderer.update(latest);});life.on(toggle,'click',()=>mode(!fallback));life.on(retry,'click',()=>mode(false));life.on(reset,'click',()=>{release();position(0,1.2);});life.on(save,'click',()=>{if(allowed())void ctx.run(()=>ctx.store.flush());});life.on(next,'click',()=>{if(allowed())void ctx.durable(()=>ctx.store.flush(),{path:'/practice',exhibitId:null});});
  return {update(nextState){state=nextState;field.disabled=!allowed();save.disabled=next.disabled=!allowed()||nextState.status==='saving';if(!allowed()){release();planDrag=false;}const project=ctx.store.getExportProject()??nextState.project;if(!project){release();latest=null;return;}
    // This workshop has a canonical fixed stand. Lamp motion never invokes actor auto-fit.
    const pose={...defaultPose(),x:.5,y:.57,scale:.84};latest={actors:[{actorId:'chenxiang',templateId:'chenxiang-v1',costumeTreatment:'original-texture',appearance:project.appearance,pose}],stage:{...project.stage,backgroundId:'plain-v1'},shadowOnly:true};void renderer.update(latest);
    const {lampDepth,magnification}=projectionParameters(project.stage);lamp.value=String(project.stage.lampX);depth.min=String(minimumLampDepth(project.stage));depth.value=String(lampDepth);lampOutput.textContent=project.stage.lampX.toFixed(2);depthOutput.textContent=lampDepth.toFixed(2)+'（近 → 远）';summary.textContent=`影偶固定 · 灯位 ${project.stage.lampX.toFixed(2)} · 灯距 ${lampDepth.toFixed(2)} · 几何倍率 ${magnification.toFixed(2)}×。调整会保存到编辑稿。`;
    const x=180+project.stage.lampX*160,y=20+lampDepth*85;dot.setAttribute('cx',String(x));dot.setAttribute('cy',String(y));puppet.setAttribute('d',`M 158 ${20+project.stage.puppetDistance*85} H 202`);ray.setAttribute('d',`M ${x} ${y} L 120 20 M ${x} ${y} L 240 20`);
  },dispose(){disposed=true;generation++;release();planDrag=false;life.dispose();spatial?.dispose();renderer.dispose();latest=null;}};
};
