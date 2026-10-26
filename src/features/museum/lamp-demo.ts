import '../light/light.css';
import { assetCatalog } from '../../content/catalog';
import { defaultPose } from '../../domain/defaults';
import { minimumLampDepth, projectionParameters } from '../../domain/projection';
import type { ProjectV1 } from '../../domain/types';
import { mountCanvasRenderer } from '../../renderers/canvas/renderer';
import type { mountThreeStage } from '../../renderers/three/renderer';
import { append, element, scope } from '../shared/dom';
import { museumPreviewFrame } from './demo-geometry';

/** An independent, disposable lamp experiment. Nothing is sent to Store. */
export function mountMuseumLamp(host:HTMLElement){
  const life=scope(),root=element('section','museum-demo museum-lamp-demo');root.id='museum-demo-root';root.dataset.kind='lamp';
  const layout=element('div','workspace'),figure=element('figure','stage-figure lamp-workshop'),mount=element('div','lamp-spatial-host'),shadow=element('div','lamp-shadow-host'),caption=element('figcaption'),status=element('p','lamp-status'),panel=element('div','control-panel');
  mount.setAttribute('aria-label','拖动金色灯具，观察颜色与幕影');status.setAttribute('role','status');
  const toggle=element('button','button secondary','改用二维灯影'),retry=element('button','button secondary','重试三维灯影'),retryImage=element('button','button secondary','重试影偶素材');retry.hidden=retryImage.hidden=true;
  append(caption,element('p','','抓住木台后方的金色灯，左右拖动或拉近。影偶留在原位，织幕上的影子随光改变。'),status,toggle,retry,retryImage);append(figure,mount,shadow,caption);
  const field=element('fieldset');field.appendChild(element('legend','','亲手挪灯 · 让影子回应'));
  const reading=element('p','selection-summary');reading.id='museum-demo-reading';reading.setAttribute('role','status');
  const x=element('input'),depth=element('input'),xo=element('output'),dpo=element('output');
  const reset=element('button','button secondary','重置灯位');reset.id='museum-demo-reset';
  let disposed=false,spatial:ReturnType<typeof mountThreeStage>|null=null,frame=museumPreviewFrame(null),generation=0,loading=false,ready=false,two=false,identity='';
  let drag:{id:number;kind:'pointer'|'mouse';offset:{x:number;depth:number}}|null=null;
  frame.actors[0]!.pose={...defaultPose(),x:.5,y:.57,scale:.84};frame.stage={...frame.stage,lampGeometry:{version:1,depth:1.2}};frame.shadowOnly=true;frame.shadowColor='original';
  function release(){drag=null;mount.classList.remove('is-dragging');}
  function mode(fallback:boolean){two=fallback;release();mount.hidden=two;shadow.hidden=!two;toggle.textContent=two?'展开三维灯影':'改用二维灯影';toggle.setAttribute('aria-pressed',String(two));if(two){generation++;loading=false;spatial?.dispose();spatial=null;renderer.resize();}else void open();}
  function fail(message:string){if(disposed)return;mode(true);retry.hidden=false;status.textContent=message+' 可继续使用下方滑块移动灯，或重试三维。';}
  const renderer=mountCanvasRenderer(shadow,assetCatalog,result=>{
    if(disposed)return;ready=result.state==='ready';
    if(result.state==='error'){retryImage.hidden=false;fail(result.message);return;}
    if(ready){const repaired=!retryImage.hidden;retryImage.hidden=true;if(two&&repaired)status.textContent='二维灯影已就绪，继续用滑块移灯，或重试三维。';if(!two&&!spatial&&!loading)void open();if(spatial){const token=generation;void spatial.update(frame).catch(error=>{if(token===generation)fail(String(error));});}}
  });
  renderer.canvas.setAttribute('aria-label','幕前彩色影像：灯移动时影子反向偏移，灯靠近时影子放大');
  async function open(){
    if(disposed||two||loading||!ready)return;
    if(import.meta.env.LEGACY||typeof window.WebGL2RenderingContext!=='function'){fail('当前浏览器使用二维灯影。');return;}
    const token=++generation;loading=true;retry.hidden=true;status.textContent='正在点亮木台、织幕与灯具…';
    try{const module=await import('../../renderers/three/renderer');if(disposed||two||token!==generation)return;
      const next=module.mountThreeStage(mount,renderer.canvas,{pixelRatio:Math.min(window.devicePixelRatio||1,1.5),maxWidth:window.innerWidth<600?512:1024,textureSize:window.innerWidth<600?512:1024},update=>{
        if(disposed||token!==generation)return;
        if(update.state==='error'||update.state==='lost'){fail(update.message);return;}
        status.textContent=update.state==='ready'?'三维灯影已就绪 · 拖动金色灯具试一试。':update.message;
      });
      if(disposed||token!==generation){next.dispose();return;}spatial=next;loading=false;next.setView('lamp-workshop');await next.update(frame);
    }catch(error){if(!disposed&&token===generation)fail('三维灯影暂未就绪：'+(error instanceof Error?error.message:String(error)));}
  }
  function render(){if(disposed)return;const p=projectionParameters(frame.stage);x.value=String(frame.stage.lampX);depth.min=String(minimumLampDepth(frame.stage));depth.value=String(p.lampDepth);xo.textContent=frame.stage.lampX.toFixed(2);dpo.textContent=p.lampDepth.toFixed(2);reading.textContent=`影偶固定 · 影子倍率 ${p.magnification.toFixed(2)}×。向左挪灯，影子向右；灯靠近影偶，影子变大。`;void renderer.update(frame);}
  function position(px:number,pd:number){if(disposed)return;frame={...frame,stage:{...frame.stage,lampX:Math.max(-.8,Math.min(.8,px)),lampGeometry:{version:1,depth:Math.max(minimumLampDepth(frame.stage),Math.min(2.4,pd))}}};render();}
  function range(label:string,input:HTMLInputElement,output:HTMLOutputElement,id:string,min:number,max:number,change:(v:number)=>void){const group=element('label','range-control',label);input.type='range';input.id=id;input.min=String(min);input.max=String(max);input.step='.01';input.setAttribute('aria-label',label);output.setAttribute('for',id);append(group,output,input);field.appendChild(group);life.on(input,'input',()=>{release();change(Number(input.value));});}
  range('灯的左右位置',x,xo,'museum-lamp',-.8,.8,v=>position(v,projectionParameters(frame.stage).lampDepth));
  range('灯离幕的距离',depth,dpo,'museum-lamp-depth',.6,2.4,v=>position(frame.stage.lampX,v));
  const pad=element('div','direction-pad');for(const [text,dx,dd]of [['灯向左',-.1,0],['灯向右',.1,0],['灯靠近影偶',0,-.1],['灯远离影偶',0,.1]]as const){const b=element('button','',text);b.type='button';life.on(b,'click',()=>position(frame.stage.lampX+dx,projectionParameters(frame.stage).lampDepth+dd));pad.appendChild(b);}append(field,pad,reset);
  append(panel,field,reading,element('p','quiet-note','观察：彩色皮样留下色面，镂空处透出幕光。本模型帮助理解灯、偶与幕的关系。'),element('p','quiet-note','这里随时可操作；灯位仅用于本次参观，离开后还原。'));append(layout,figure,panel);root.appendChild(layout);host.appendChild(root);shadow.hidden=true;
  function begin(px:number,py:number,id:number,kind:'pointer'|'mouse'){if(disposed||two||!spatial)return false;const offset=spatial.pickLamp(px,py);if(!offset)return false;drag={id,kind,offset};mount.classList.add('is-dragging');return true;}
  function move(px:number,py:number){if(!drag||!spatial)return;const p=spatial.lampPlanePoint(px,py);if(p)position(p.x-drag.offset.x,p.depth-drag.offset.depth);}
  if(window.PointerEvent){life.on(mount,'pointerdown',event=>{const e=event as PointerEvent;if(e.button===0&&begin(e.clientX,e.clientY,e.pointerId,'pointer')){e.preventDefault();mount.setPointerCapture?.(e.pointerId);}});life.on(window,'pointermove',event=>{const e=event as PointerEvent;if(drag?.kind==='pointer'&&drag.id===e.pointerId){e.preventDefault();move(e.clientX,e.clientY);}});for(const n of ['pointerup','pointercancel','lostpointercapture'])life.on(window,n,release);
  }else{life.on(mount,'mousedown',event=>{const e=event as MouseEvent;if(e.button===0&&begin(e.clientX,e.clientY,0,'mouse'))e.preventDefault();});life.on(window,'mousemove',event=>{if(drag?.kind==='mouse'){const e=event as MouseEvent;move(e.clientX,e.clientY);}});life.on(window,'mouseup',release);}
  life.on(window,'blur',release);life.on(document,'visibilitychange',()=>{if(document.hidden)release();});life.on(toggle,'click',()=>{mode(!two);if(two)status.textContent='二维灯影 · 使用滑块或按钮移灯。';});life.on(retry,'click',()=>mode(false));life.on(retryImage,'click',()=>render());life.on(reset,'click',()=>{release();position(0,1.2);});render();
  return {update(project:ProjectV1|null){const key=JSON.stringify(project?.story?.castSnapshot?.appearance??null);if(key===identity)return;identity=key;const actor=frame.actors[0]!,source=museumPreviewFrame(project).actors[0]!;if(actor.actorId==='chenxiang'&&source.actorId==='chenxiang')frame={...frame,actors:[{...actor,appearance:source.appearance}]};render();},dispose(){if(disposed)return;disposed=true;generation++;release();life.dispose();spatial?.dispose();renderer.dispose();if(root.parentNode)root.parentNode.removeChild(root);}};
}
