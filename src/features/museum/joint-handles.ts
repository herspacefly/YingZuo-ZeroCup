import {assetCatalog} from '../../content/catalog';
import {jointTransform} from '../../domain/pose';
import {fitViewport,projectLocalPoint,viewportToWorld,worldToViewport} from '../../domain/projection';
import {moveRodBy,moveRodTo,ROD_IDS,rodScreenPoint,type RodId} from '../../domain/rod-input';
import type {Pose} from '../../domain/types';
import type {CanvasFrame} from '../../renderers/canvas/types';
import type {canvasStage} from '../shared/canvas-stage';
import {element,focusWithoutScroll,scope} from '../shared/dom';

/** Three independent rods, with the same projection and bounded IK as the theatre. */
export function mountJointHandles(stage:ReturnType<typeof canvasStage>,port:{read():CanvasFrame;enabled():boolean;change(pose:Pose,rod:RodId):void}){
 const life=scope(),template=assetCatalog.puppets.find(p=>p.id==='chenxiang-v1')!,overlay=element('div','museum-rod-overlay'),ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),handles=new Map<RodId,HTMLButtonElement>(),lines=new Map<RodId,SVGPathElement>();
 const labels:Record<RodId,string>={body:'身杆',leftHand:'左手杆',rightHand:'右手杆'},dots:SVGCircleElement[]=[];
 svg.setAttribute('aria-hidden','true');overlay.appendChild(svg);stage.screen.appendChild(overlay);stage.screen.tabIndex=0;stage.screen.setAttribute('aria-label','三杆操偶幕面：拖动身杆、左手杆或右手杆，方向键移动身躯');
 let disposed=false,drag:{id:RodId;pointer:number;offset:{x:number;y:number}}|null=null;
 for(const id of ROD_IDS){const line=document.createElementNS(ns,'path'),button=element('button','museum-rod-handle',labels[id]);button.type='button';button.dataset.rod=id;button.setAttribute('aria-label','拖动'+labels[id]);svg.appendChild(line);lines.set(id,line);handles.set(id,button);overlay.appendChild(button);}
 for(const joint of template.joints){const dot=document.createElementNS(ns,'circle');dot.setAttribute('r','4');dot.setAttribute('data-joint',joint.jointId);svg.appendChild(dot);dots.push(dot);}
 function point(x:number,y:number){const rect=stage.canvas.getBoundingClientRect();return viewportToWorld({x:x-rect.left,y:y-rect.top},fitViewport(rect.width,rect.height));}
 function release(){drag=null;overlay.classList.remove('is-dragging');}
 function render(){if(disposed)return;const frame=port.read(),actor=frame.actors[0]!;const rect=stage.canvas.getBoundingClientRect(),v=fitViewport(rect.width,rect.height);svg.setAttribute('viewBox',`0 0 ${rect.width} ${rect.height}`);const placed:{x:number;y:number}[]=[];
  for(const id of ROD_IDS){const anchor=worldToViewport(rodScreenPoint(template,actor.pose,frame.stage,id),v),button=handles.get(id)!;let p={x:anchor.x,y:anchor.y};
   const bounded=(p:{x:number;y:number})=>({x:Math.max(24,Math.min(rect.width-24,p.x)),y:Math.max(24,Math.min(rect.height-24,p.y))});p=bounded(p);
   if(placed.some(a=>Math.hypot(a.x-p.x,a.y-p.y)<50)){search:for(let r=50;r<=150;r+=25)for(let n=0;n<16;n++){const candidate=bounded({x:anchor.x+Math.cos(n*Math.PI/8)*r,y:anchor.y+Math.sin(n*Math.PI/8)*r});if(placed.every(a=>Math.hypot(a.x-candidate.x,a.y-candidate.y)>=50)){p=candidate;break search;}}}
   placed.push(p);button.style.left=p.x+'px';button.style.top=p.y+'px';button.disabled=!port.enabled();lines.get(id)!.setAttribute('d',`M ${anchor.x} ${rect.height} L ${anchor.x} ${anchor.y} L ${p.x} ${p.y}`);
  }
  template.joints.forEach((joint,index)=>{const p=worldToViewport(projectLocalPoint(jointTransform(template,actor.pose,joint.jointId),actor.pose,frame.stage),v);dots[index]!.setAttribute('cx',String(p.x));dots[index]!.setAttribute('cy',String(p.y));});
 }
 function begin(id:RodId,x:number,y:number,pointer:number){if(disposed||!port.enabled())return false;const p=point(x,y);if(!p)return false;const frame=port.read(),anchor=rodScreenPoint(template,frame.actors[0]!.pose,frame.stage,id);drag={id,pointer,offset:{x:p.x-anchor.x,y:p.y-anchor.y}};overlay.classList.add('is-dragging');focusWithoutScroll(stage.screen);return true;}
 function move(x:number,y:number){if(!drag||!port.enabled()){release();return;}const p=point(x,y);if(!p)return;const frame=port.read(),fit=moveRodTo(template,frame.actors[0]!.pose,frame.stage,drag.id,{x:p.x-drag.offset.x,y:p.y-drag.offset.y});if(fit.fits)port.change(fit.pose,drag.id);}
 if(window.PointerEvent){for(const [id,button]of handles)life.on(button,'pointerdown',event=>{const e=event as PointerEvent;if(e.button===0&&begin(id,e.clientX,e.clientY,e.pointerId)){e.preventDefault();button.setPointerCapture?.(e.pointerId);}});life.on(window,'pointermove',event=>{const e=event as PointerEvent;if(drag?.pointer===e.pointerId){e.preventDefault();move(e.clientX,e.clientY);}});for(const event of ['pointerup','pointercancel','lostpointercapture'])life.on(window,event,release);
 }else{for(const [id,button]of handles)life.on(button,'mousedown',event=>{const e=event as MouseEvent;if(e.button===0&&begin(id,e.clientX,e.clientY,0))e.preventDefault();});life.on(window,'mousemove',event=>{if(drag){const e=event as MouseEvent;move(e.clientX,e.clientY);}});life.on(window,'mouseup',release);}
 life.on(stage.screen,'keydown',event=>{const e=event as KeyboardEvent,key=({Left:'ArrowLeft',Right:'ArrowRight',Up:'ArrowUp',Down:'ArrowDown'}as Record<string,string>)[e.key]??e.key,d=({ArrowLeft:[-.025,0],ArrowRight:[.025,0],ArrowUp:[0,.025],ArrowDown:[0,-.025]}as Record<string,number[]>)[key];if(!d||!port.enabled()||e.altKey||e.ctrlKey||e.metaKey)return;e.preventDefault();const frame=port.read(),fit=moveRodBy(template,frame.actors[0]!.pose,frame.stage,'body',{x:d[0]!,y:d[1]!});if(fit.fits)port.change(fit.pose,'body');});
 life.on(window,'resize',render);life.on(window,'blur',release);life.on(document,'visibilitychange',()=>{if(document.hidden)release();});life.on(stage.screen,'focusout',event=>{const next=(event as FocusEvent).relatedTarget;if(!(next instanceof Node)||!stage.screen.contains(next))release();});
 return {render,release,dispose(){if(disposed)return;disposed=true;release();life.dispose();if(overlay.parentNode)overlay.parentNode.removeChild(overlay);}};
}
