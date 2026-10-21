import { spatialCapability } from '../../app/capabilities';
import { museumExhibits } from '../../content/museum';
import type { CanvasFrame,CanvasStatus } from '../../renderers/canvas/types';
import type { StageView,mountThreeStage } from '../../renderers/three/renderer';
import { append,element,link,scope } from './dom';

type SpatialStage=ReturnType<typeof mountThreeStage>;
export interface SpatialPreference {expanded:boolean;view:StageView;yaw:number;pitch:number;zoom:number;actorId:string}
let serial=0;

/** Optional observation beside the complete 2D controls. No Store, input geometry or clock. */
export function mountSpatialStage(figure:HTMLElement,source:HTMLCanvasElement){
  const life=scope(),root=element('section','spatial-stage'),toggle=element('button','button secondary','展开戏台空间'),status=element('p','spatial-status'),panel=element('div','spatial-panel'),mount=element('div','spatial-mount');
  const id=++serial;panel.id='spatial-panel-'+id;toggle.type='button';toggle.classList.add('spatial-toggle');toggle.setAttribute('aria-controls',panel.id);toggle.setAttribute('aria-expanded','false');panel.hidden=true;
  status.setAttribute('role','status');root.setAttribute('data-state','closed');mount.setAttribute('aria-label','同一成影的空间观察');
  const controls=element('div','spatial-views');controls.setAttribute('role','group');controls.setAttribute('aria-label','戏台观察机位');
  const viewButtons=new Map<StageView,HTMLButtonElement>();
  for(const [view,label]of [['workshop','工坊近景'],['front','幕前'],['backstage','幕后'],['exhibit','展台'],['story','剧情空间'],['character','人物近看']] as const){
    const button=element('button','button secondary',label);button.type='button';button.setAttribute('data-view',view);button.setAttribute('aria-pressed',String(view==='front'));viewButtons.set(view,button);controls.appendChild(button);
  }
  const exhibits=element('nav','spatial-exhibits');exhibits.setAttribute('aria-label','从展台前往展签');exhibits.hidden=true;
  for(const item of museumExhibits)exhibits.appendChild(link(`${item.id} · ${item.title}`,`#/museum/${item.id}`,'spatial-exhibit-link'));
  const inspect=element('div','spatial-inspect'),actorSelect=element('select'),resetView=element('button','button secondary','复位观察'),zoomIn=element('button','button secondary','放大'),zoomOut=element('button','button secondary','缩小');
  actorSelect.setAttribute('aria-label','近看人物');for(const [id,label]of [['chenxiang','沉香'],['mother','母亲'],['guardian','二郎神']]){const option=element('option','',label);option.value=id!;actorSelect.appendChild(option);}append(inspect,element('p','quiet-note','拖动空间画面改变视角；放大查看刻纹与持物。操偶仍在上方二维幕面完成。'),actorSelect,zoomIn,zoomOut,resetView);
  const close=element('button','button secondary spatial-close','只看二维幕面');close.type='button';
  append(panel,mount,controls,inspect,exhibits,element('p','quiet-note','空间模型为本作示意，影偶、刻纹与灯位沿用上方这张幕。操作仍在二维幕面完成，切换观察机位不会改变演出。'),close);
  append(root,toggle,status,panel);figure.appendChild(root);
  let disposed=false,expanded=false,loading=false,originReady=false,last:CanvasFrame|null=null,stage:SpatialStage|null=null,generation=0,view:StageView='story',lightweight=false;
  let yaw=0,pitch=0,zoom=1,drag:{x:number;y:number}|null=null,wanted=false;
  function observe(){stage?.observe(yaw,pitch,zoom,actorSelect.value);}
  life.on(actorSelect,'change',()=>{view='character';stage?.setView(view);observe();sync();});
  life.on(resetView,'click',()=>{yaw=pitch=0;zoom=1;observe();});
  life.on(zoomIn,'click',()=>{zoom=Math.min(1.8,zoom+.15);observe();});life.on(zoomOut,'click',()=>{zoom=Math.max(.7,zoom-.15);observe();});
  life.on(mount,'pointerdown',e=>{const p=e as PointerEvent;if(p.button!==0)return;drag={x:p.clientX,y:p.clientY};mount.setPointerCapture?.(p.pointerId);});
  life.on(mount,'pointermove',e=>{if(!drag)return;const p=e as PointerEvent;yaw=Math.max(-.65,Math.min(.65,yaw+(p.clientX-drag.x)*.005));pitch=Math.max(-.25,Math.min(.4,pitch+(p.clientY-drag.y)*.004));drag={x:p.clientX,y:p.clientY};observe();});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])life.on(mount,event,()=>{drag=null;});
  life.on(window,'blur',()=>{drag=null;});
  function capability(){
    const hints=navigator as Navigator&{deviceMemory?:number;connection?:{saveData?:boolean}};
    return spatialCapability({legacy:!!import.meta.env.LEGACY,webgl2:typeof window.WebGL2RenderingContext==='function',width:window.innerWidth,deviceMemory:hints.deviceMemory,hardwareConcurrency:navigator.hardwareConcurrency,saveData:hints.connection?.saveData,dpr:window.devicePixelRatio});
  }
  function sync(){
    const eligible=capability().eligible;inspect.hidden=!expanded;for(const b of [zoomIn,zoomOut,resetView,actorSelect])b.disabled=!stage;
    for(const o of Array.from(actorSelect.options)){o.hidden=!last?.actors.some(a=>a.actorId===o.value);o.disabled=o.hidden;}if(last&&!last.actors.some(a=>a.actorId===actorSelect.value)){actorSelect.value=last.actors[0]?.actorId??'chenxiang';observe();}toggle.disabled=!eligible||!originReady||lightweight;toggle.textContent=expanded?'收起空间观察':root.getAttribute('data-state')==='error'?'重试空间观察':'展开戏台空间';toggle.setAttribute('aria-expanded',String(expanded));
    for(const [key,button]of viewButtons){button.disabled=!stage||!originReady;button.setAttribute('aria-pressed',String(key===view));}exhibits.hidden=view!=='exhibit';
  }
  function shutdown(){drag=null;wanted=false;generation++;loading=false;stage?.dispose();stage=null;while(mount.firstChild)mount.removeChild(mount.firstChild);expanded=false;panel.hidden=true;}
  function fail(text:string){shutdown();root.setAttribute('data-state','error');status.textContent=`空间观察已回到二维：${text}`;sync();}
  function render(){
    if(disposed||!expanded||!stage||!last||!originReady)return;const token=generation,current=stage;mount.hidden=false;
    void current.update(last).catch(error=>{if(!disposed&&token===generation)fail(error instanceof Error?error.message:String(error));});
  }
  async function open(){
    if(disposed||lightweight||loading||!originReady||!last||!capability().eligible)return;
    const token=++generation;let moduleLoaded=false;expanded=true;loading=true;panel.hidden=false;root.setAttribute('data-state','loading');status.textContent='正在展开这张幕的背面…';sync();
    try{
      const module=await import('../../renderers/three/renderer');
      moduleLoaded=true;
      if(disposed||token!==generation||!expanded)return;
      const next=module.mountThreeStage(mount,source,capability().budget,update=>{
        if(disposed||token!==generation)return;
        if(update.state==='error'||update.state==='lost'){fail(update.message);return;}
        root.setAttribute('data-state',update.state);if(status.textContent!==update.message)status.textContent=update.message;sync();
      });
      if(disposed||token!==generation){next.dispose();return;}
      stage=next;loading=false;next.setView(view);observe();render();sync();
    }catch(error){if(!disposed&&token===generation)fail(moduleLoaded?(error instanceof Error?error.message:String(error)):'空间组件未能载入，请刷新页面再试。当前二维幕面可以继续使用。');}
  }
  life.on(toggle,'click',()=>{if(expanded){shutdown();root.setAttribute('data-state','closed');status.textContent='已收起空间观察，继续使用二维幕面。';sync();}else void open();});
  life.on(close,'click',()=>{shutdown();root.setAttribute('data-state','closed');status.textContent='继续使用二维幕面。';sync();toggle.focus();});
  for(const [key,button]of viewButtons)life.on(button,'click',()=>{if(!stage||!originReady)return;view=key;try{stage.setView(key);observe();sync();}catch(error){fail(error instanceof Error?error.message:String(error));}});
  const eligibility=capability();status.textContent=eligibility.eligible?'从幕前走到背面，看灯、薄片与操偶杆。':eligibility.reason;sync();
  return {
    preference():SpatialPreference{return {expanded,view,yaw,pitch,zoom,actorId:actorSelect.value};},
    restorePreference(preference:SpatialPreference|undefined){if(!preference||disposed)return;view=preference.view;yaw=preference.yaw;pitch=preference.pitch;zoom=preference.zoom;actorSelect.value=preference.actorId;wanted=preference.expanded;if(wanted&&originReady){wanted=false;void open();}},
    setLightweight(enabled:boolean){
      if(disposed)return;lightweight=enabled;shutdown();root.setAttribute('data-state','closed');
      status.textContent=enabled?'轻量二维已启用，恢复原画质后可展开空间。':capability().reason;sync();
    },
    update(frame:CanvasFrame|null,state:CanvasStatus['state']){
      if(disposed)return;originReady=state==='ready'&&!!frame&&source.width>0;last=frame?JSON.parse(JSON.stringify(frame)) as CanvasFrame:null;
      if(!frame){shutdown();root.setAttribute('data-state','closed');}
      else if(state==='error'&&expanded)fail('先修复上方幕面资源，再重新展开。');
      else if(!originReady&&expanded){mount.hidden=true;root.setAttribute('data-state','loading');status.textContent='正在等同一张幕面准备就绪…';}
      else if(expanded)render();
      if(wanted&&originReady&&!loading&&!expanded){wanted=false;void open();}
      sync();
    },
    dispose(){if(disposed)return;disposed=true;life.dispose();shutdown();last=null;if(root.parentNode)root.parentNode.removeChild(root);},
  };
}
