import { cableScreenPath } from '../../domain/cables';
import { mountLimbControls } from '../shared/limb-controls';
import { assetCatalog } from '../../content/catalog';
import type { Bounds } from '../../content/asset-types';
import { constrainPoseToStage } from '../../domain/pose';
import { fitViewport, viewportToWorld, worldToViewport } from '../../domain/projection';
import type { Point, Viewport } from '../../domain/projection';
import { moveRodBy, moveRodTo, ROD_IDS, rodScreenPoint } from '../../domain/rod-input';
import type { RodId } from '../../domain/rod-input';
import type { Pose } from '../../domain/types';
import type { LimbId } from '../../domain/limb-input';
import type { CanvasFrame } from '../../renderers/canvas/types';
import type { canvasStage } from '../shared/canvas-stage';
import { append, element, scope } from '../shared/dom';

export interface StoryRodPort {
  read(): { frame:CanvasFrame; enabled:boolean; rods:readonly RodId[]; lights:boolean; target:Bounds|null; region:Bounds|null } | null;
  change(pose:Pose,source?:LimbId|'body'):void;
  light(lampX:number,puppetDistance:number):void;
  wake():void;
  report(message:string):void;
}

type Readout = NonNullable<ReturnType<StoryRodPort['read']>>;
type Drag = { rod:RodId; id:number; offset:Point; handle:HTMLButtonElement; kind:'pointer'|'mouse'|'touch' };
const labels:Record<RodId,string> = {body:'身杆',leftHand:'左手杆',rightHand:'右手杆'};
const directions:Record<string,Point> = {ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:1},ArrowDown:{x:0,y:-1}};
const keyName = (key:string) => ({Left:'ArrowLeft',Right:'ArrowRight',Up:'ArrowUp',Down:'ArrowDown'} as Record<string,string>)[key] ?? key;
const template = assetCatalog.puppets.find(item=>item.id==='chenxiang-v1')!;
const clone = (pose:Pose):Pose => ({...pose,joints:{...pose.joints}});

/** DOM input only. The story controller owns the frame, constraints and single clock. */
export function mountStoryRodControls(panel:HTMLElement,stage:ReturnType<typeof canvasStage>,port:StoryRodPort) {
  const direct=mountLimbControls(stage,port);
  const life=scope(),extraCleanups:(()=>void)[]=[],root=element('div','story-rod-controls');
  const help=element('p','quiet-note','拖动沉香的手脚或握柄；舞台上的方向键移动身躯，方向按钮移动所选杆，滑块可精调关节。');
  help.id='story-rod-help';
  const field=element('fieldset'),legend=element('legend','','牵动沉香');field.appendChild(legend);
  const select=element('select');select.id='story-rod-select';
  const options=new Map<RodId,HTMLOptionElement>();
  for(const id of ROD_IDS){const option=element('option','',labels[id]);option.value=id;select.appendChild(option);options.set(id,option);}
  const selectLabel=element('label','','当前操纵杆');selectLabel.htmlFor=select.id;selectLabel.appendChild(select);field.appendChild(selectLabel);
  const pad=element('div','direction-pad');pad.setAttribute('role','group');pad.setAttribute('aria-label','逐步移动当前操纵杆');
  for(const [id,name,delta] of [['left','向左',{x:-.025,y:0}],['up','向上',{x:0,y:.025}],['down','向下',{x:0,y:-.025}],['right','向右',{x:.025,y:0}]] as const){
    const button=element('button','',name);button.id=`story-rod-${id}`;button.type='button';pad.appendChild(button);
    life.on(button,'click',()=>{release();nudge(delta);});
  }
  field.appendChild(pad);
  const ranges=new Map<string,{input:HTMLInputElement;output:HTMLOutputElement;group:HTMLLabelElement;rod:RodId|'lights'}>();
  function range(label:string,id:string,min:number,max:number,step:number,rod:RodId|'lights',change:(value:number)=>void) {
    const group=element('label','range-control',label),output=element('output'),input=element('input');
    input.type='range';input.id=id;input.min=String(min);input.max=String(max);input.step=String(step);input.setAttribute('aria-label',label);
    group.htmlFor=id;output.setAttribute('for',id);append(group,output,input);field.appendChild(group);ranges.set(id,{input,output,group,rod});
    life.on(input,'input',()=>{release();change(Number(input.value));});
    life.on(input,'change',()=>{release();change(Number(input.value));});
  }
  range('身杆左右','story-rod-x',0,1,.005,'body',value=>manual(pose=>({...pose,x:value}),'body'));
  range('身杆高低','story-rod-y',0,1,.005,'body',value=>manual(pose=>({...pose,y:value}),'body'));
  for(const side of ['left','right'] as const)for(const joint of ['Shoulder','Elbow','Hip','Knee'] as const){
    const id=`${side}${joint}` as const,limit=template.joints.find(item=>item.jointId===id)!;
    range(`${side==='left'?'左':'右'}${({Shoulder:'肩',Elbow:'肘',Hip:'髋',Knee:'膝'})[joint]}角度`,`story-rod-${id}`,limit.minRad,limit.maxRad,.01,joint==='Hip'||joint==='Knee'?'body':`${side}Hand`,value=>manual(pose=>({...pose,joints:{...pose.joints,[id]:value}}),joint==='Hip'||joint==='Knee'?'body':`${side}Hand`,joint==='Hip'||joint==='Knee'?`${side}Foot`:`${side}Hand`));
  }
  range('影偶大小','story-rod-scale',.6,1,.01,'body',value=>manual(pose=>({...pose,scale:value}),'body'));
  range('灯位左右','story-lamp',-.8,.8,.01,'lights',value=>light(value,null));
  range('影偶离幕距离','story-distance',.05,.4,.005,'lights',value=>light(null,value));
  append(root,help,field);panel.appendChild(root);

  const overlay=element('div','rod-overlay');overlay.hidden=true;overlay.setAttribute('aria-label','沉香操纵杆');overlay.setAttribute('data-story-rod','overlay');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');svg.setAttribute('class','rod-lines');overlay.appendChild(svg);
  const region=document.createElementNS('http://www.w3.org/2000/svg','rect'),target=document.createElementNS('http://www.w3.org/2000/svg','rect');
  region.setAttribute('class','story-region');target.setAttribute('class','story-target');svg.appendChild(region);svg.appendChild(target);
  const handles=new Map<RodId,HTMLButtonElement>(),lines=new Map<RodId,SVGPathElement>();
  for(const id of ROD_IDS){
    const line=document.createElementNS('http://www.w3.org/2000/svg','path');svg.appendChild(line);lines.set(id,line);
    const handle=element('button','rod-handle',id==='body'?'身':id==='leftHand'?'左':'右');handle.type='button';handle.setAttribute('data-story-rod',id);
    handle.setAttribute('aria-label',`拖动${labels[id]}，方向键移动`);handle.setAttribute('aria-describedby',help.id);overlay.appendChild(handle);handles.set(id,handle);
  }
  stage.screen.appendChild(overlay);
  let selected:RodId='rightHand',drag:Drag|null=null,disposed=false,lastTouch=0;
  const keys=new Set<string>();

  function read() {
    if(disposed)return null;
    const data=port.read(),actor=data?.frame.actors.find(item=>item.actorId==='chenxiang');
    return data&&actor ? {data,actor} : null;
  }
  function enabled(data:Readout) {return data.enabled&&stage.getStatus().state==='ready';}
  function active() {const current=read();return current&&enabled(current.data) ? current : null;}
  function attachments(data:Readout) {return (data.frame.attachments??[]).filter(item=>item.actorId==='chenxiang').map(item=>item.attachmentId);}
  function allowed(data:Readout,id:RodId) {return data.rods.indexOf(id)!==-1;}
  function selectAllowed(data:Readout) {
    if(!allowed(data,selected))selected=allowed(data,'rightHand')?'rightHand':allowed(data,'body')?'body':data.rods[0]??'rightHand';
  }
  function apply(fit:ReturnType<typeof constrainPoseToStage>,source?:LimbId|'body') {
    if(!fit.fits){port.report('当前姿态无法完整放进幕面，请减小影偶或调整关节。');return;}
    const current=active();if(!current)return;
    if(JSON.stringify(current.actor.pose)!==JSON.stringify(fit.pose)){port.change(clone(fit.pose),source);port.wake();}
    render();
  }
  function manual(change:(pose:Pose)=>Pose,id:RodId,source:LimbId|'body'=id) {
    const current=active();if(!current||!allowed(current.data,id))return;
    apply(constrainPoseToStage(change(clone(current.actor.pose)),template,current.data.frame.stage,attachments(current.data)),source);
  }
  function light(lampX:number|null,distance:number|null) {
    const current=active();if(!current||!current.data.lights)return;
    const nextLamp=lampX??current.data.frame.stage.lampX,nextDistance=distance??current.data.frame.stage.puppetDistance;
    if(!Number.isFinite(nextLamp)||!Number.isFinite(nextDistance))return;
    if(nextLamp!==current.data.frame.stage.lampX||nextDistance!==current.data.frame.stage.puppetDistance){port.light(nextLamp,nextDistance);port.wake();}
    render();
  }
  function nudge(delta:Point) {
    const current=active();if(!current)return;selectAllowed(current.data);if(!allowed(current.data,selected))return;
    stage.cables.pull(selected,delta.x);apply(moveRodBy(template,current.actor.pose,current.data.frame.stage,selected,delta,attachments(current.data)),selected);stage.cables.release();
  }
  function release() {
    direct.release();
    keys.clear();const previous=drag;drag=null;
    if(previous?.kind==='pointer')try {if(previous.handle.hasPointerCapture?.(previous.id))previous.handle.releasePointerCapture(previous.id);}
    catch(error){if(!disposed)port.report(`拖动已结束：${error instanceof Error?error.message:String(error)}`);}
  }
  function rectangle(node:SVGRectElement,bounds:Bounds|null,viewport:Viewport) {
    if(!bounds){node.setAttribute('display','none');return;}
    const topLeft=worldToViewport({x:bounds.minX,y:bounds.maxY},viewport),bottomRight=worldToViewport({x:bounds.maxX,y:bounds.minY},viewport);
    node.removeAttribute('display');node.setAttribute('x',String(topLeft.x));node.setAttribute('y',String(topLeft.y));
    node.setAttribute('width',String(Math.max(0,bottomRight.x-topLeft.x)));node.setAttribute('height',String(Math.max(0,bottomRight.y-topLeft.y)));
  }
  function render() {
    if(disposed)return;
    const current=read();
    if(!current){direct.render();release();root.hidden=true;overlay.hidden=true;return;}
    const {data,actor}=current,canInput=enabled(data);selectAllowed(data);
    if(!canInput||!allowed(data,selected)||drag&&!allowed(data,drag.rod))release();
    root.hidden=!data.rods.length&&!data.lights;field.disabled=!canInput;selectLabel.hidden=!data.rods.length;pad.hidden=!data.rods.length;select.value=selected;
    for(const [id,option] of options){option.hidden=!allowed(data,id);option.disabled=!allowed(data,id);}
    const values:Record<string,number>={'story-rod-x':actor.pose.x,'story-rod-y':actor.pose.y,'story-rod-scale':actor.pose.scale,'story-lamp':data.frame.stage.lampX,'story-distance':data.frame.stage.puppetDistance};
    for(const side of ['left','right'] as const)for(const joint of ['Shoulder','Elbow','Hip','Knee'] as const)values[`story-rod-${side}${joint}`]=actor.pose.joints[`${side}${joint}`];
    for(const [id,item] of ranges){
      const visible=item.rod==='lights'?data.lights:allowed(data,item.rod);item.group.hidden=!visible;item.input.disabled=!canInput||!visible;item.input.value=String(values[id]);
      item.output.textContent=/Shoulder|Elbow|Hip|Knee/.test(id)?`${Math.round(values[id]!*180/Math.PI)}°`:`${Math.round(values[id]!*100)}%`;
    }
    const rect=stage.canvas.getBoundingClientRect(),viewport=fitViewport(rect.width,rect.height);svg.setAttribute('viewBox',`0 0 ${rect.width||1} ${rect.height||1}`);
    rectangle(target,data.target,viewport);rectangle(region,data.region,viewport);
    for(const id of ROD_IDS){
      const handle=handles.get(id)!,line=lines.get(id)!,visible=allowed(data,id);handle.hidden=!visible;line.setAttribute('display',visible?'inline':'none');handle.disabled=!canInput||!visible;
      handle.setAttribute('aria-pressed',String(id===selected));
      if(!visible)continue;
      const point=worldToViewport(rodScreenPoint(template,actor.pose,data.frame.stage,id),viewport);
      const dx=id==='body'?0:(id==='leftHand'?-.16:.16)*viewport.width,dy=(id==='body'?.22:.19)*viewport.height;
      const x=Math.max(24,Math.min(rect.width-24,point.x+dx)),y=Math.max(24,Math.min(rect.height-24,point.y+dy));
      handle.style.left=`${x}px`;handle.style.top=`${y}px`;const motion=stage.cables.sample();line.setAttribute('d',cableScreenPath(point,{x,y},motion?.source===id?motion.bend:0,viewport.scale));
    }
    overlay.hidden=stage.getStatus().state!=='ready'||(!data.rods.length&&!data.target&&!data.region);direct.render(rect);
  }
  function screenPoint(clientX:number,clientY:number) {
    const rect=stage.canvas.getBoundingClientRect();return viewportToWorld({x:clientX-rect.left,y:clientY-rect.top},fitViewport(rect.width,rect.height));
  }
  function startDrag(id:RodId,eventId:number,clientX:number,clientY:number,handle:HTMLButtonElement,kind:Drag['kind']) {
    const current=active();if(!current||drag||!allowed(current.data,id))return false;
    const point=screenPoint(clientX,clientY);if(!point)return false;
    keys.clear();selected=id;const connection=rodScreenPoint(template,current.actor.pose,current.data.frame.stage,id);
    stage.cables.pull(id);drag={rod:id,id:eventId,handle,kind,offset:{x:point.x-connection.x,y:point.y-connection.y}};render();port.wake();return true;
  }
  function moveDrag(clientX:number,clientY:number) {
    const current=active();if(!drag||!current||!allowed(current.data,drag.rod)){release();return;}
    const point=screenPoint(clientX,clientY);if(!point)return;
    stage.cables.pull(drag.rod,point.x-rodScreenPoint(template,current.actor.pose,current.data.frame.stage,drag.rod).x);apply(moveRodTo(template,current.actor.pose,current.data.frame.stage,drag.rod,{x:point.x-drag.offset.x,y:point.y-drag.offset.y},attachments(current.data)),drag.rod);
  }
  function endDrag() {const source=drag?.rod;release();if(source){stage.cables.pull(source);stage.cables.release();port.wake();}render();}
  if('PointerEvent' in window&&window.PointerEvent){
    for(const [id,handle] of handles){
      life.on(handle,'pointerdown',event=>{const e=event as PointerEvent;if(e.button!==0||e.isPrimary===false)return;
        if(startDrag(id,e.pointerId,e.clientX,e.clientY,handle,'pointer')){e.preventDefault();handle.focus();try{handle.setPointerCapture?.(e.pointerId);}catch(error){port.report(`使用页面范围跟踪拖动：${error instanceof Error?error.message:String(error)}`);}}});
      life.on(handle,'lostpointercapture',event=>{if(drag?.kind==='pointer'&&drag.id===(event as PointerEvent).pointerId)endDrag();});
    }
    life.on(window,'pointermove',event=>{const e=event as PointerEvent;if(drag?.kind==='pointer'&&drag.id===e.pointerId){e.preventDefault();moveDrag(e.clientX,e.clientY);}});
    for(const type of ['pointerup','pointercancel'])life.on(window,type,event=>{if(drag?.kind==='pointer'&&drag.id===(event as PointerEvent).pointerId)endDrag();});
  }else{
    for(const [id,handle] of handles){
      life.on(handle,'mousedown',event=>{const e=event as MouseEvent;if(Date.now()-lastTouch<600)return;if(e.button===0&&startDrag(id,0,e.clientX,e.clientY,handle,'mouse')){e.preventDefault();handle.focus();}});
      const touchStart=(event:Event)=>{const e=event as TouchEvent;if(e.touches.length!==1||drag)return;const touch=e.changedTouches[0];
        if(touch&&startDrag(id,touch.identifier,touch.clientX,touch.clientY,handle,'touch')){lastTouch=Date.now();e.preventDefault();}};
      handle.addEventListener('touchstart',touchStart,{passive:false});extraCleanups.push(()=>handle.removeEventListener('touchstart',touchStart,{capture:false}));
    }
    life.on(window,'mousemove',event=>{const e=event as MouseEvent;if(drag?.kind==='mouse')moveDrag(e.clientX,e.clientY);});
    life.on(window,'mouseup',()=>{if(drag?.kind==='mouse')endDrag();});
    const touchMove=(event:Event)=>{const e=event as TouchEvent;if(drag?.kind!=='touch')return;
      for(let i=0;i<e.changedTouches.length;i++){const touch=e.changedTouches[i]!;if(touch.identifier===drag.id){e.preventDefault();moveDrag(touch.clientX,touch.clientY);break;}}};
    const touchEnd=(event:Event)=>{const e=event as TouchEvent;if(drag?.kind!=='touch')return;
      for(let i=0;i<e.changedTouches.length;i++)if(e.changedTouches[i]!.identifier===drag.id){lastTouch=Date.now();endDrag();break;}};
    window.addEventListener('touchmove',touchMove,{passive:false});window.addEventListener('touchend',touchEnd);window.addEventListener('touchcancel',touchEnd);
    extraCleanups.push(()=>{window.removeEventListener('touchmove',touchMove,{capture:false});window.removeEventListener('touchend',touchEnd);window.removeEventListener('touchcancel',touchEnd);});
  }
  for(const [id,handle] of handles){
    life.on(handle,'keydown',event=>{const e=event as KeyboardEvent,key=keyName(e.key),current=active();if(!directions[key]||!current||!allowed(current.data,id))return;
      e.preventDefault();if(keys.has(key))return;if(selected!==id){release();selected=id;}else if(drag)release();keys.add(key);render();port.wake();});
    life.on(handle,'blur',()=>{if(keys.size){release();render();}});
  }
  life.on(window,'keyup',event=>{if(keys.delete(keyName((event as KeyboardEvent).key)))render();});
  life.on(window,'blur',()=>{release();render();});life.on(document,'visibilitychange',()=>{if(document.hidden){release();render();}});
  life.on(window,'resize',render);
  life.on(select,'change',()=>{const current=read(),id=select.value as RodId;if(!current||!allowed(current.data,id))return;release();selected=id;render();});

  render();
  return {
    render,
    release,
    tick(deltaMs:number) {
      direct.tick(deltaMs);render();
      if(disposed)return;
      const current=active();if(!current){release();return;}
      if(!keys.size||!Number.isFinite(deltaMs)||deltaMs<=0)return;
      if(deltaMs>250){release();return;}
      if(!allowed(current.data,selected)){release();return;}
      const delta={x:0,y:0};for(const key of keys){delta.x+=directions[key]!.x;delta.y+=directions[key]!.y;}
      const length=Math.hypot(delta.x,delta.y);if(length)nudge({x:delta.x/length*.4*deltaMs/1000,y:delta.y/length*.4*deltaMs/1000});
    },
    dispose() {
      if(disposed)return;disposed=true;release();direct.dispose();life.dispose();extraCleanups.splice(0).forEach(cleanup=>cleanup());
      if(overlay.parentNode)overlay.parentNode.removeChild(overlay);if(root.parentNode)root.parentNode.removeChild(root);
    },
  };
}
