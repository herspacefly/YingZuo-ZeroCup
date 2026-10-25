import { cableScreenPath } from '../../domain/cables';
import { assetCatalog } from '../../content/catalog';
import { LIMBS,limbScreenPoint,moveLimbTo } from '../../domain/limb-input';
import type { LimbId } from '../../domain/limb-input';
import { fitViewport,viewportToWorld,worldToViewport,unprojectPoint,projectPoint,projectionParameters } from '../../domain/projection';
import type { Point } from '../../domain/projection';
import { moveRodBy } from '../../domain/rod-input';
import type { Pose } from '../../domain/types';
import type { CanvasFrame } from '../../renderers/canvas/types';
import type { canvasStage } from './canvas-stage';
import { element,scope,focusWithoutScroll } from './dom';

const template=assetCatalog.puppets.find(p=>p.id==='chenxiang-v1')!;
const labels:Record<LimbId,string>={leftHand:'左手',rightHand:'右手',leftFoot:'左脚',rightFoot:'右脚'};
const directions:Record<string,Point>={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:1},ArrowDown:{x:0,y:-1}};
export interface LimbPort{read():{frame:CanvasFrame;enabled:boolean}|null;change(pose:Pose,source:LimbId|'body'):void;wake():void;end?():void;report(message:string):void}
/** Transient input only. The page supplies its existing clock and persistence policy. */
export function mountLimbControls(stage:ReturnType<typeof canvasStage>,port:LimbPort){
  const life=scope(),overlay=element('div','limb-overlay'),keys=new Set<string>(),handles=new Map<LimbId,HTMLButtonElement>();
  let disposed=false,drag:{id:LimbId;pointer:number;offset:Point}|null=null,touchCleanup=()=>{};
  stage.screen.tabIndex=0;stage.screen.setAttribute('aria-label','操偶幕面：直接拖动手脚，方向键移动身躯');
  const hint=element('p','quiet-note','拖动手、脚上的圆点摆动四肢；点击幕面后用 ↑ ↓ ← → 移动身躯。');
  const guides=document.createElementNS('http://www.w3.org/2000/svg','svg'),lines=new Map<LimbId,SVGPathElement>();guides.setAttribute('class','limb-lines');guides.setAttribute('aria-hidden','true');overlay.appendChild(guides);
  for(const id of LIMBS){const line=document.createElementNS('http://www.w3.org/2000/svg','path');guides.appendChild(line);lines.set(id,line);}
  stage.figure.appendChild(hint);stage.screen.appendChild(overlay);
  for(const id of LIMBS){const h=element('button','limb-handle',labels[id]);h.type='button';h.dataset.limb=id;h.setAttribute('aria-label','拖动沉香'+labels[id]);overlay.appendChild(h);handles.set(id,h);}
  function read(){if(disposed)return null;const data=port.read(),actor=data?.frame.actors.find(a=>a.actorId==='chenxiang');return data&&actor?{...data,actor}:null;}
  function active(){const r=read();return r?.enabled&&stage.getStatus().state==='ready'?r:null;}
  function point(x:number,y:number){const r=stage.canvas.getBoundingClientRect();return viewportToWorld({x:x-r.left,y:y-r.top},fitViewport(r.width,r.height));}
  function release(settle=false){if(settle)stage.cables.release();else {stage.cables.clear();for(const line of lines.values()){const values=line.getAttribute('d')?.match(/-?\d+(?:\.\d+)?(?:e[-+]?\d+)?/gi)?.map(Number);if(values?.length===8)line.setAttribute('d',cableScreenPath({x:values[0]!,y:values[1]!},{x:values[6]!,y:values[7]!},0,1));}}const old=drag;drag=null;keys.clear();if(old){const h=handles.get(old.id)!;try{if(h.hasPointerCapture?.(old.pointer))h.releasePointerCapture(old.pointer);}catch(e){port.report('已结束拖动：'+String(e));}}}
  function render(bounds?:DOMRect){
    const r=read();overlay.hidden=!r?.enabled;if(!r?.enabled){release();return;}
    const rect=bounds??stage.canvas.getBoundingClientRect(),v=fitViewport(rect.width,rect.height),enabled=stage.getStatus().state==='ready';
    const placed:(Point&{radius:number})[]=[];
    guides.setAttribute('viewBox',`0 0 ${rect.width||1} ${rect.height||1}`);
    for(const h of stage.screen.querySelectorAll<HTMLButtonElement>('.rod-handle')){const x=parseFloat(h.style.left),y=parseFloat(h.style.top);if(!h.hidden&&!h.disabled&&Number.isFinite(x)&&Number.isFinite(y))placed.push({x,y,radius:28});}
    for(const [id,h] of handles){
      const anchor=worldToViewport(limbScreenPoint(template,r.actor.pose,r.frame.stage,id),v);
      const bound=(p:Point)=>({x:Math.max(24,Math.min(rect.width-24,p.x)),y:Math.max(24,Math.min(rect.height-24,p.y))});
      let position=bound(anchor),found=false;
      // A bent knee can put a foot over either hand. Separate every pair, not only left/right peers.
      for(const radius of [0,48,64,80,96,112,128]){
        for(let angle=0;angle<16;angle++){
          const candidate=bound({x:anchor.x+radius*Math.cos(angle*Math.PI/8),y:anchor.y+radius*Math.sin(angle*Math.PI/8)});
          if(placed.every(p=>Math.hypot(p.x-candidate.x,p.y-candidate.y)>=p.radius+24)){position=candidate;found=true;break;}
        }
        if(found)break;
      }
      placed.push({...position,radius:24});h.style.left=position.x+'px';h.style.top=position.y+'px';h.disabled=!enabled;
      const line=lines.get(id)!;const motion=stage.cables.sample(),world=unprojectPoint(limbScreenPoint(template,r.actor.pose,r.frame.stage,id),r.frame.stage),end=worldToViewport(projectPoint({x:world.x-.025,y:-1.6},r.frame.stage),v);line.setAttribute('d',cableScreenPath(anchor,end,motion?.source===id?-motion.bend*projectionParameters(r.frame.stage).magnification:0,v.scale));
    }
  }
  function move(x:number,y:number){const r=active(),p=point(x,y);if(!r||!p||!drag)return;const fit=moveLimbTo(template,r.actor.pose,r.frame.stage,drag.id,{x:p.x-drag.offset.x,y:p.y-drag.offset.y},r.frame.attachments?.filter(a=>a.actorId==='chenxiang').map(a=>a.attachmentId));if(fit.fits){const before=limbScreenPoint(template,r.actor.pose,r.frame.stage,drag.id),after=limbScreenPoint(template,fit.pose,r.frame.stage,drag.id);stage.cables.pull(drag.id,after.x-before.x);port.change(fit.pose,drag.id);port.wake();render();}}
  function begin(id:LimbId,x:number,y:number,pointer:number){const r=active(),p=point(x,y);if(!r||!p||drag)return false;const anchor=limbScreenPoint(template,r.actor.pose,r.frame.stage,id);stage.cables.pull(id);drag={id,pointer,offset:{x:p.x-anchor.x,y:p.y-anchor.y}};keys.clear();port.wake();return true;}
  if(window.PointerEvent){
    life.on(stage.screen,'pointerdown',event=>{const e=event as PointerEvent;if(e.button!==0||e.isPrimary===false)return;const r=active();if(!r)return;const target=e.target as HTMLElement;let id=target.dataset.limb as LimbId|undefined;
      if(!id&&target===stage.canvas){const rect=stage.canvas.getBoundingClientRect(),v=fitViewport(rect.width,rect.height);let best=30;for(const candidate of LIMBS){const p=worldToViewport(limbScreenPoint(template,r.actor.pose,r.frame.stage,candidate),v),d=Math.hypot(e.clientX-rect.left-p.x,e.clientY-rect.top-p.y);if(d<best){best=d;id=candidate;}}}
      if(id){e.preventDefault();focusWithoutScroll(stage.screen);if(begin(id,e.clientX,e.clientY,e.pointerId))handles.get(id)!.setPointerCapture?.(e.pointerId);}else if(target===stage.canvas||target===stage.screen)focusWithoutScroll(stage.screen);
    });
    life.on(window,'pointermove',event=>{const e=event as PointerEvent;if(drag?.pointer===e.pointerId){e.preventDefault();move(e.clientX,e.clientY);}});
    for(const name of ['pointerup','pointercancel','lostpointercapture'])life.on(name==='lostpointercapture'?overlay:window,name,()=>{if(drag){release(true);port.wake();port.end?.();}});
  }else{
    for(const [id,h] of handles)life.on(h,'mousedown',event=>{const e=event as MouseEvent;if(e.button===0&&begin(id,e.clientX,e.clientY,0)){e.preventDefault();focusWithoutScroll(stage.screen);}});
    life.on(window,'mousemove',event=>{if(drag){const e=event as MouseEvent;move(e.clientX,e.clientY);}});life.on(window,'mouseup',()=>{if(drag){release(true);port.wake();port.end?.();}});
    const startTouch=(event:Event)=>{const e=event as TouchEvent,t=e.changedTouches[0],id=(e.target as HTMLElement).dataset.limb as LimbId;if(t&&LIMBS.includes(id)&&begin(id,t.clientX,t.clientY,t.identifier))e.preventDefault();};
    const moveTouch=(event:Event)=>{const e=event as TouchEvent;if(!drag)return;for(let i=0;i<e.changedTouches.length;i++){const t=e.changedTouches[i]!;if(t.identifier===drag.pointer){e.preventDefault();move(t.clientX,t.clientY);}}};
    const endTouch=()=>{if(drag){release(true);port.wake();port.end?.();}};
    overlay.addEventListener('touchstart',startTouch,{passive:false});window.addEventListener('touchmove',moveTouch,{passive:false});window.addEventListener('touchend',endTouch);window.addEventListener('touchcancel',endTouch);
    touchCleanup=()=>{overlay.removeEventListener('touchstart',startTouch);window.removeEventListener('touchmove',moveTouch);window.removeEventListener('touchend',endTouch);window.removeEventListener('touchcancel',endTouch);};
  }
  const onKey=(event:Event)=>{const e=event as KeyboardEvent,target=e.target as HTMLElement,key=({Left:'ArrowLeft',Right:'ArrowRight',Up:'ArrowUp',Down:'ArrowDown'} as Record<string,string>)[e.key]??e.key;
    if(!directions[key]||/INPUT|SELECT|TEXTAREA/.test(target.tagName)||target.isContentEditable)return;const r=active();if(!r)return;e.preventDefault();e.stopImmediatePropagation();if(!keys.has(key)){const fit=moveRodBy(template,r.actor.pose,r.frame.stage,'body',{x:directions[key]!.x*.02,y:directions[key]!.y*.02},r.frame.attachments?.filter(a=>a.actorId==='chenxiang').map(a=>a.attachmentId));if(fit.fits){stage.cables.pull('body',directions[key]!.x*.02);port.change(fit.pose,'body');render();}}keys.add(key);port.wake();};
  stage.screen.addEventListener('keydown',onKey,true);
  life.on(window,'keyup',event=>{const key=({Left:'ArrowLeft',Right:'ArrowRight',Up:'ArrowUp',Down:'ArrowDown'} as Record<string,string>)[(event as KeyboardEvent).key]??(event as KeyboardEvent).key;if(keys.delete(key)){if(!keys.size){stage.cables.release();port.wake();port.end?.();}}});
  life.on(window,'blur',()=>release());life.on(stage.screen,'focusout',event=>{const next=(event as FocusEvent).relatedTarget;if(next instanceof Node&&stage.screen.contains(next))return;release();port.end?.();});life.on(document,'visibilitychange',()=>{if(document.hidden)release();});life.on(window,'resize',()=>render());
  return {render,release,isActive:()=>keys.size>0||stage.cables.active,isDragging:()=>!!drag,tick(delta:number){stage.cables.tick(delta);render();const r=active();if(!r){release();return;}if(!(delta>0&&delta<=250)||!keys.size)return;let x=0,y=0;for(const k of keys){x+=directions[k]!.x;y+=directions[k]!.y;}const length=Math.hypot(x,y);if(!length)return;const fit=moveRodBy(template,r.actor.pose,r.frame.stage,'body',{x:x/length*.4*delta/1000,y:y/length*.4*delta/1000},r.frame.attachments?.filter(a=>a.actorId==='chenxiang').map(a=>a.attachmentId));if(fit.fits){stage.cables.pull('body',x/length*.4*delta/1000);port.change(fit.pose,'body');render();}},dispose(){release();disposed=true;life.dispose();touchCleanup();stage.screen.removeEventListener('keydown',onKey,true);if(overlay.parentNode)overlay.parentNode.removeChild(overlay);if(hint.parentNode)hint.parentNode.removeChild(hint);}};
}
