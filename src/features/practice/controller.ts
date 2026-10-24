import { cableScreenPath } from '../../domain/cables';
import { mountLimbControls } from '../shared/limb-controls';
import { createAnimationClock } from '../../app/animation-clock';
import type { PageContext } from '../../app/view';
import type { StoreState } from '../../app/store';
import { assetCatalog } from '../../content/catalog';
import { actionDefinitions, sampleAction } from '../../domain/actions';
import type { ActionId } from '../../domain/actions';
import { defaultPose } from '../../domain/defaults';
import { constrainPoseToStage } from '../../domain/pose';
import { fitViewport, viewportToWorld, worldToViewport } from '../../domain/projection';
import type { Point } from '../../domain/projection';
import { moveRodBy, moveRodTo, ROD_IDS, rodScreenPoint } from '../../domain/rod-input';
import type { RodId } from '../../domain/rod-input';
import type { Pose, ProjectV1 } from '../../domain/types';
import type { canvasStage } from '../shared/canvas-stage';
import { append, element, scope } from '../shared/dom';

const template=assetCatalog.puppets.find(item=>item.id==='chenxiang-v1')!;
const clone=(pose:Pose):Pose=>({...pose,joints:{...pose.joints}});
const labels:Record<RodId,string>={body:'身杆',leftHand:'左手杆',rightHand:'右手杆'};
const directions:Record<string,Point>={ArrowLeft:{x:-1,y:0},ArrowRight:{x:1,y:0},ArrowUp:{x:0,y:1},ArrowDown:{x:0,y:-1}};
const keyName=(key:string)=>((({Left:'ArrowLeft',Right:'ArrowRight',Up:'ArrowUp',Down:'ArrowDown'}) as Record<string,string>)[key]??key);
type Drag={rod:RodId;id:number;offset:Point;handle:HTMLButtonElement;kind:'pointer'|'mouse'|'touch'};
type Phase={id:ActionId;base:Pose;elapsed:number;finished:boolean};

export function mountPracticeController(panel:HTMLElement,stage:ReturnType<typeof canvasStage>,ctx:PageContext) {
  const life=scope(),field=element('fieldset'),legend=element('legend','','沉香的三根杆');field.appendChild(legend);
  const runtime=element('p','practice-runtime','正在恢复练习姿态…');runtime.id='practice-runtime';runtime.setAttribute('role','status');
  const help=element('p','quiet-note','拖动手脚或幕下握柄；舞台方向键移动身躯，方向按钮移动所选杆，下方滑块精调关节。');help.id='practice-help';
  const rod=element('select');rod.id='practice-rod';
  for(const id of ROD_IDS){const option=element('option','',labels[id]);option.value=id;rod.appendChild(option);}
  const rodLabel=element('label','','当前操纵杆');rodLabel.appendChild(rod);append(field,rodLabel);
  const pad=element('div','direction-pad');pad.setAttribute('role','group');pad.setAttribute('aria-label','逐步移动当前操纵杆');
  for(const [name,delta] of [['向左',{x:-.025,y:0}],['向上',{x:0,y:.025}],['向下',{x:0,y:-.025}],['向右',{x:.025,y:0}]] as const){
    const button=element('button','',name);button.type='button';pad.appendChild(button);life.on(button,'click',()=>nudge(delta));
  }
  field.appendChild(pad);
  const ranges=new Map<string,HTMLInputElement>();
  function range(label:string,id:string,min:number,max:number,step:number,change:(value:number)=>void) {
    const group=element('label','range-control',label),value=element('output'),input=element('input');
    input.type='range';input.id=id;input.min=String(min);input.max=String(max);input.step=String(step);input.setAttribute('aria-label',label);value.setAttribute('for',id);
    append(group,value,input);field.appendChild(group);ranges.set(id,input);
    life.on(input,'input',()=>change(Number(input.value)));life.on(input,'change',()=>{change(Number(input.value));if(dirty)submit(true);});
  }
  range('身杆左右','practice-x',0,1,.005,value=>manual({...pose,x:value}));
  range('身杆高低','practice-y',0,1,.005,value=>manual({...pose,y:value}));
  for(const side of ['left','right'] as const)for(const joint of ['Shoulder','Elbow','Hip','Knee'] as const){
    const id=`${side}${joint}` as const,limit=template.joints.find(item=>item.jointId===id)!;
    range(`${side==='left'?'左':'右'}${({Shoulder:'肩',Elbow:'肘',Hip:'髋',Knee:'膝'})[joint]}角度`,`practice-${id}`,limit.minRad,limit.maxRad,.01,value=>manual({...pose,joints:{...pose.joints,[id]:value}}));
  }
  range('影偶大小','practice-scale',.6,1,.01,value=>manual({...pose,scale:value}));
  const facing=element('select');facing.id='practice-facing';
  for(const [value,label] of [['1','面向右侧'],['-1','面向左侧']]){const option=element('option','',label);option.value=value!;facing.appendChild(option);}
  const faceLabel=element('label','','影偶朝向');faceLabel.appendChild(facing);field.appendChild(faceLabel);
  const action=element('select');action.id='practice-action';
  for(const definition of actionDefinitions){const option=element('option','',definition.label);option.value=definition.id;action.appendChild(option);}
  const actionLabel=element('label','','基础动作');actionLabel.appendChild(action);field.appendChild(actionLabel);
  const transport=element('div','practice-transport'),play=element('button','button primary','演示所选动作'),pause=element('button','button secondary','暂停'),resume=element('button','button secondary','继续动作'),step=element('button','button secondary','前进 0.25 秒');
  play.id='practice-play';pause.id='practice-pause';resume.id='practice-resume';step.id='practice-step';append(transport,play,pause,resume,step);field.appendChild(transport);
  const save=element('button','button secondary','保存当前姿态'),reset=element('button','button secondary','姿态归位');save.id='practice-save';reset.id='practice-reset';append(field,save,reset);
  append(panel,help,runtime,field);

  const overlay=element('div','rod-overlay');overlay.hidden=true;overlay.setAttribute('aria-label','沉香操纵杆');
  const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('aria-hidden','true');svg.setAttribute('class','rod-lines');overlay.appendChild(svg);
  const handles=new Map<RodId,HTMLButtonElement>(),lines=new Map<RodId,SVGPathElement>();
  for(const id of ROD_IDS){
    const line=document.createElementNS('http://www.w3.org/2000/svg','path');svg.appendChild(line);lines.set(id,line);
    const handle=element('button','rod-handle',id==='body'?'身':id==='leftHand'?'左':'右');handle.type='button';handle.setAttribute('data-rod',id);handle.setAttribute('aria-label',`拖动${labels[id]}，方向键移动`);handle.setAttribute('aria-describedby','practice-help');
    overlay.appendChild(handle);handles.set(id,handle);
  }
  stage.screen.appendChild(overlay);
  let project:ProjectV1|null=null,state:StoreState|null=null,pose=defaultPose(),projectId='',selected:RodId='body',selectedAction:ActionId='wave-v1';
  let phase:Phase|null=null,playing=false,drag:Drag|null=null,disposed=false,ready=false,dirty=false,lastSubmit=0,previousStatus='';
  let saveTimer:ReturnType<typeof setTimeout>|undefined;
  const keys=new Set<string>(),reduced=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)').matches:false;
  const touchCleanups:(()=>void)[]=[];
  let message='已恢复，默认暂停。';
  const attachments=()=>actionDefinitions.find(item=>item.id===selectedAction)!.attachmentIds;
  const blocked=()=>!project||!state||state.hasPending||ctx.isBusy()||['loading','closed','conflict','unsupported','recovery'].includes(state.status);
  const canInput=()=>!disposed&&!blocked()&&ready;
  const direct=mountLimbControls(stage,{read(){return project?{frame:{actors:[{actorId:'chenxiang',templateId:'chenxiang-v1',appearance:project.appearance,pose}],stage:project.stage,attachments:attachments().map(attachmentId=>({actorId:'chenxiang',attachmentId}))},enabled:canInput()}:null;},change(next){playing=false;phase=null;applyFit(constrainPoseToStage(next,template,project!.stage,attachments()));submit(false);},wake(){clock.start();renderUI();},end(){if(!playing&&!keys.size&&!stage.cables.active)clock.stop();if(dirty)submit(true);renderUI();},report(text){message=text;renderUI();}});
  const clock=createAnimationClock({request:callback=>window.requestAnimationFrame(callback),cancel:id=>window.cancelAnimationFrame(id),now:()=>performance.now()},delta=>{
    direct.tick(delta);renderHandles();
    if(!canInput()){stop('当前操作已暂停。',false);return false;}
    if(playing&&phase){phase.elapsed+=delta;sample();if(phase.finished){stop('这段动作已结束，保留最后姿态。');return false;}}
    else if(keys.size){const vector={x:0,y:0};for(const key of keys){vector.x+=directions[key]!.x;vector.y+=directions[key]!.y;}
      const length=Math.hypot(vector.x,vector.y);if(length)applyFit(moveRodBy(template,pose,project!.stage,selected,{x:vector.x/length*.4*delta/1000,y:vector.y/length*.4*delta/1000},attachments()));}
    submit(false);return playing||keys.size>0||direct.isActive();
  },fault=>{stop(fault.reason==='gap'?'页面停顿较久，已暂停；继续时不补算这段时间。':`动作已停止：${fault.error instanceof Error?fault.error.message:String(fault.error)}`);},stage.frameObserver);

  function submit(flush:boolean,allowBusy=false,force=false,explicitSave=false) {
    if(disposed||!project||!state||state.hasPending||(!allowBusy&&ctx.isBusy())||ctx.store.getState().project?.projectId!==projectId)return;
    const now=performance.now();if(!flush&&!force){if(!dirty)return;if(now-lastSubmit<200){if(saveTimer===undefined)saveTimer=setTimeout(()=>{saveTimer=undefined;submit(false);},200-(now-lastSubmit));return;}}
    clearTimeout(saveTimer);saveTimer=undefined;
    const snapshot=clone(pose),shouldFlush=flush&&(explicitSave||!['memory','error','conflict','unsupported'].includes(ctx.store.getState().status));lastSubmit=now;dirty=false;
    void ctx.run(async()=>{await ctx.store.edit({type:'POSE',pose:snapshot});if(shouldFlush)return ctx.store.flush();});
  }
  function release() {
    const current=drag;drag=null;
    if(current?.kind==='pointer')try{if(current.handle.hasPointerCapture?.(current.id))current.handle.releasePointerCapture(current.id);}catch(error){if(!disposed)message=`拖动已结束：${error instanceof Error?error.message:String(error)}`;}
  }
  function stop(text:string,savePose=true) {
    playing=false;keys.clear();release();direct.release();stage.cables.clear();clock.stop();clearTimeout(saveTimer);saveTimer=undefined;message=text;if(savePose&&dirty)submit(true);renderUI();
  }
  function manual(next:Pose) {
    if(!canInput())return;
    playing=false;phase=null;keys.clear();release();clock.stop();applyFit(constrainPoseToStage(next,template,project!.stage,attachments()));submit(false);
  }
  function applyFit(fit:ReturnType<typeof constrainPoseToStage>) {
    if(!fit.fits){stop('当前姿态无法完整放进幕面，请减小影偶或调整关节。',false);return;}
    if(JSON.stringify(pose)!==JSON.stringify(fit.pose)){pose=clone(fit.pose);dirty=true;}
    message='练习中的姿态会自动保存；本场剧情保持不变。';renderFrame();renderUI();
  }
  function nudge(delta:Point) {
    if(!canInput())return;playing=false;phase=null;keys.clear();release();clock.stop();
    applyFit(moveRodBy(template,pose,project!.stage,selected,delta,attachments()));submit(true);
  }
  function sample() {
    if(!project||!phase)return;
    const result=sampleAction(phase.id,phase.base,phase.elapsed,template,project.stage);phase.elapsed=result.elapsedMs;phase.finished=result.finished;
    applyFit(result);
  }
  function begin() {
    if(!canInput())return;stop('动作已准备。');phase={id:selectedAction,base:clone(pose),elapsed:0,finished:false};
    if(reduced){message='已启用减少动态。可逐步预览同一个动作。';renderUI();return;}
    playing=true;message='正在演示；拖杆或调整滑块可接管。';renderUI();clock.start();
  }
  function renderFrame() {
    if(!project){overlay.hidden=true;stage.update(null);return;}
    stage.update({actors:[{actorId:'chenxiang',templateId:'chenxiang-v1',appearance:project.appearance,pose}],stage:project.stage,attachments:attachments().map(attachmentId=>({actorId:'chenxiang' as const,attachmentId}))});
  }
  function renderHandles() {
    if(!project){direct.render();return;}
    const rect=stage.canvas.getBoundingClientRect(),v=fitViewport(rect.width,rect.height);svg.setAttribute('viewBox',`0 0 ${rect.width||1} ${rect.height||1}`);
    for(const id of ROD_IDS){
      const point=worldToViewport(rodScreenPoint(template,pose,project.stage,id),v);
      const dx=id==='body'?0:(id==='leftHand'?-.16:.16)*v.width,dy=(id==='body'?.22:.19)*v.height;
      const x=Math.max(24,Math.min(rect.width-24,point.x+dx)),y=Math.max(24,Math.min(rect.height-24,point.y+dy));
      const handle=handles.get(id)!;handle.style.left=`${x}px`;handle.style.top=`${y}px`;handle.disabled=!canInput();handle.setAttribute('aria-pressed',String(id===selected));
      const line=lines.get(id)!;const motion=stage.cables.sample();line.setAttribute('d',cableScreenPath(point,{x,y},motion?.source===id?motion.bend:0,v.scale));
    }
    overlay.hidden=!ready||blocked();direct.render(rect);
  }
  function renderUI() {
    if(disposed)return;
    field.disabled=!canInput();play.disabled=!canInput();pause.disabled=!canInput()||(!playing&&!keys.size&&!drag&&!direct.isActive()&&!direct.isDragging());
    resume.disabled=!canInput()||playing||!phase||phase.finished||reduced;step.disabled=!canInput()||playing;
    if(runtime.textContent!==message)runtime.textContent=message;runtime.setAttribute('data-state',playing?'playing':drag||direct.isDragging()?'dragging':keys.size||direct.isActive()?'moving':'paused');
    runtime.setAttribute('data-elapsed',String(Math.round(phase?.elapsed??0)));
    const values:Record<string,number>={'practice-x':pose.x,'practice-y':pose.y,'practice-scale':pose.scale};
    for(const side of ['left','right'] as const)for(const joint of ['Shoulder','Elbow','Hip','Knee'] as const)values[`practice-${side}${joint}`]=pose.joints[`${side}${joint}`];
    for(const [id,input]of ranges){input.value=String(values[id]);const output=input.parentNode!.querySelector('output')!;output.textContent=/Shoulder|Elbow|Hip|Knee/.test(id)?`${Math.round(values[id]!*180/Math.PI)}°`:`${Math.round(values[id]!*100)}%`;}
    rod.value=selected;facing.value=String(pose.facing);action.value=selectedAction;renderHandles();
  }
  function screenPoint(clientX:number,clientY:number):Point|null {
    const rect=stage.canvas.getBoundingClientRect();return viewportToWorld({x:clientX-rect.left,y:clientY-rect.top},fitViewport(rect.width,rect.height));
  }
  function startDrag(id:RodId,eventId:number,clientX:number,clientY:number,handle:HTMLButtonElement,kind:Drag['kind']) {
    if(!canInput()||drag)return false;const point=screenPoint(clientX,clientY);if(!point)return false;
    playing=false;phase=null;keys.clear();clock.stop();selected=id;
    const connection=rodScreenPoint(template,pose,project!.stage,id);stage.cables.pull(id);drag={rod:id,id:eventId,handle,kind,offset:{x:point.x-connection.x,y:point.y-connection.y}};message=`正在牵动${labels[id]}。`;renderUI();clock.start();return true;
  }
  function moveDrag(clientX:number,clientY:number) {
    if(!drag||!canInput())return;const point=screenPoint(clientX,clientY);if(!point)return;
    stage.cables.pull(drag.rod,point.x-rodScreenPoint(template,pose,project!.stage,drag.rod).x);applyFit(moveRodTo(template,pose,project!.stage,drag.rod,{x:point.x-drag.offset.x,y:point.y-drag.offset.y},attachments()));submit(false);
  }
  function endDrag(){if(!drag)return;release();stage.cables.release();clock.start();message='已放开操纵杆，保留当前姿态。';submit(true);renderUI();}
  if('PointerEvent' in window&&window.PointerEvent) {
    for(const [id,handle] of handles){
      life.on(handle,'pointerdown',event=>{const e=event as PointerEvent;if(e.button!==0||e.isPrimary===false)return;
        if(startDrag(id,e.pointerId,e.clientX,e.clientY,handle,'pointer')){e.preventDefault();handle.focus();try{handle.setPointerCapture?.(e.pointerId);}catch(error){message=`使用页面范围跟踪拖动：${error instanceof Error?error.message:String(error)}`;}}});
      life.on(handle,'lostpointercapture',event=>{if(drag?.kind==='pointer'&&drag.id===(event as PointerEvent).pointerId)endDrag();});
    }
    life.on(window,'pointermove',event=>{const e=event as PointerEvent;if(drag?.kind==='pointer'&&drag.id===e.pointerId){e.preventDefault();moveDrag(e.clientX,e.clientY);}});
    for(const name of ['pointerup','pointercancel'])life.on(window,name,event=>{if(drag?.kind==='pointer'&&drag.id===(event as PointerEvent).pointerId)endDrag();});
  } else {
    for(const [id,handle] of handles){
      life.on(handle,'mousedown',event=>{const e=event as MouseEvent;if(e.button===0&&startDrag(id,0,e.clientX,e.clientY,handle,'mouse')){e.preventDefault();handle.focus();}});
      const onTouch=(event:Event)=>{const e=event as TouchEvent,t=e.changedTouches[0];if(t&&startDrag(id,t.identifier,t.clientX,t.clientY,handle,'touch'))e.preventDefault();};
      handle.addEventListener('touchstart',onTouch,{passive:false});touchCleanups.push(()=>handle.removeEventListener('touchstart',onTouch,{capture:false}));
    }
    life.on(window,'mousemove',event=>{const e=event as MouseEvent;if(drag?.kind==='mouse')moveDrag(e.clientX,e.clientY);});life.on(window,'mouseup',()=>{if(drag?.kind==='mouse')endDrag();});
    const touchMove=(event:Event)=>{const e=event as TouchEvent;if(drag?.kind!=='touch')return;for(let i=0;i<e.changedTouches.length;i++){const t=e.changedTouches[i]!;if(t.identifier===drag.id){e.preventDefault();moveDrag(t.clientX,t.clientY);}}};
    const touchEnd=(event:Event)=>{const e=event as TouchEvent;if(drag?.kind!=='touch')return;for(let i=0;i<e.changedTouches.length;i++)if(e.changedTouches[i]!.identifier===drag.id){endDrag();break;}};
    window.addEventListener('touchmove',touchMove,{passive:false});window.addEventListener('touchend',touchEnd);window.addEventListener('touchcancel',touchEnd);
    touchCleanups.push(()=>{window.removeEventListener('touchmove',touchMove,{capture:false});window.removeEventListener('touchend',touchEnd);window.removeEventListener('touchcancel',touchEnd);});
  }
  for(const [id,handle]of handles){
    life.on(handle,'keydown',event=>{const e=event as KeyboardEvent,key=keyName(e.key);if(!directions[key]||!canInput())return;e.preventDefault();
      if(!keys.has(key)){playing=false;phase=null;release();selected=id;keys.add(key);applyFit(moveRodBy(template,pose,project!.stage,id,{x:directions[key]!.x*.02,y:directions[key]!.y*.02},attachments()));submit(false);clock.start();}});
    life.on(handle,'blur',()=>{if(keys.size)stop('已移开焦点，方向键已松开。');});
  }
  life.on(window,'keyup',event=>{const key=keyName((event as KeyboardEvent).key);if(keys.delete(key)&&!keys.size){clock.stop();message='方向键已松开。';submit(true);renderUI();}});
  life.on(window,'blur',()=>stop('已切换窗口，练习暂停。'));life.on(document,'visibilitychange',()=>{if(document.hidden)stop('页面已隐藏，练习暂停。');});
  life.on(window,'resize',renderHandles);
  life.on(rod,'change',()=>{const value=rod.value as RodId;stop('已切换操纵杆。');selected=value;renderUI();});
  life.on(facing,'change',()=>{manual({...pose,facing:Number(facing.value) as 1|-1});if(dirty)submit(true);});
  life.on(action,'change',()=>{const value=action.value as ActionId;stop('动作已准备，点击演示或逐步预览。');selectedAction=value;phase=null;if(project)applyFit(constrainPoseToStage(pose,template,project.stage,attachments()));if(dirty)submit(true);renderFrame();renderUI();});
  life.on(play,'click',begin);life.on(pause,'click',()=>stop('已暂停，保留当前动作时间。'));
  life.on(resume,'click',()=>{if(canInput()&&phase&&!phase.finished&&!reduced){playing=true;message='从暂停处继续。';renderUI();clock.start();}});
  life.on(step,'click',()=>{if(!canInput())return;stop('逐步预览。');if(!phase||phase.finished)phase={id:selectedAction,base:clone(pose),elapsed:0,finished:false};phase.elapsed+=250;sample();message=phase.finished?'这段动作已结束。':'已前进 0.25 秒，保持暂停。';submit(true);renderUI();});
  life.on(save,'click',()=>{stop('保留当前姿态，保存状态见顶部。',false);dirty=true;submit(true,false,false,true);});
  life.on(reset,'click',()=>{manual(defaultPose());submit(true);});
  const unsubscribe=stage.subscribe(status=>{ready=status.state==='ready';if(status.state==='error')stop('幕面未就绪，练习暂停；可重试幕面。');else renderUI();});
  return {
    update(next:StoreState) {
      if(disposed)return;state=next;const nextProject=next.project;
      if(nextProject?.projectId!==projectId){stop('已恢复练习姿态，默认暂停。',false);project=nextProject;projectId=nextProject?.projectId??'';phase=null;dirty=false;
        if(project){const fit=constrainPoseToStage(project.pose,template,project.stage,attachments());pose=clone(fit.pose);if(!fit.fits)message='当前姿态无法完整放进幕面。';}}
      else project=nextProject;
      if(blocked()) {if(dirty&&!next.hasPending){if(ctx.isBusy())submit(true,true);else if(next.status==='conflict')submit(false,false,true);}stop('先处理作品操作，再继续练习。',false);}
      else if(next.status==='error'&&previousStatus!=='error'){stop('保存失败；姿态保留在本页，可导出当前作品。',false);if(dirty)submit(false,false,true);}
      previousStatus=next.status;renderFrame();renderUI();
    },
    dispose() {if(disposed)return;if(dirty)submit(true);stop('练习已离开。',false);disposed=true;clock.dispose();direct.dispose();unsubscribe();life.dispose();touchCleanups.forEach(cleanup=>cleanup());if(overlay.parentNode)overlay.parentNode.removeChild(overlay);project=null;},
  };
}
