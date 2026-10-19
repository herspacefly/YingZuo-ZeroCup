import { createAnimationClock } from '../../app/animation-clock';
import { submitScopedSceneCommand } from '../../app/story-scene-commands';
import type { SceneCommand,SceneObservation } from '../../app/story-scene-commands';
import type { PageContext } from '../../app/view';
import type { StoreState } from '../../app/store';
import { assetCatalog } from '../../content/catalog';
import { reunionDefinition } from '../../content/reunion';
import { subtitlesForMode } from '../../content/story-contract';
import { moveRodTo,rodScreenPoint } from '../../domain/rod-input';
import type { RodId } from '../../domain/rod-input';
import { storyEntry } from '../../domain/story';
import type { Pose,ProjectV1,StageConfig } from '../../domain/types';
import type { CanvasFrame } from '../../renderers/canvas/types';
import { createSceneDirector } from '../../story/director';
import { createNodeScope } from '../../story/node-scope';
import { createNodeInteraction,interactionGoal,interactionHandPoints,projectedInteractionRegion } from '../../story/node-interaction';
import type { InteractionReading } from '../../story/node-interaction';
import { normalizedTargetBounds } from '../../story/interactions';
import { stagePlayFrame } from '../../story/play-staging';
import { introSkipCommand } from '../intro/events';
import { canvasStage } from '../shared/canvas-stage';
import { append,clear,element,link,scope } from '../shared/dom';
import { mountStoryRodControls } from './rod-controls';
import { mountSubtitles } from './subtitles';
import { createStageSound } from '../../audio/stage-sound';
import type { StageSoundSample, StageSoundStatus } from '../../audio/stage-sound';

type Director=ReturnType<typeof createSceneDirector>;
type ReadyCommand={command:SceneCommand;facts:SceneObservation};
type Resolution={elapsed:number;duration:number;ready:ReadyCommand};
type Assistance={elapsed:number;base:Pose;stage:Pick<StageConfig,'lampX'|'puppetDistance'>;goal:NonNullable<ReturnType<typeof interactionGoal>>};
type Runtime={entry:ReturnType<typeof storyEntry>;scene:Director;scope:ReturnType<typeof createNodeScope>;
  stage:ReturnType<typeof canvasStage>;clock:ReturnType<typeof createAnimationClock>;shade:HTMLDivElement;
  controls:ReturnType<typeof mountStoryRodControls>|null;interaction:ReturnType<typeof createNodeInteraction>;
  sample:ReturnType<Director['sample']>;elapsed:number;playing:boolean;ready:boolean;requested:boolean;mode:'full'|'guided';
  pose:Pose;light:Pick<StageConfig,'lampX'|'puppetDistance'>;operated:boolean;handOperated:boolean;reading:InteractionReading|null;
  assistance:Assistance|null;resolution:Resolution|null;completed:ReadyCommand|null};
let generation=0;
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);
const template=assetCatalog.puppets.find(item=>item.id==='chenxiang-v1')!;
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const smooth=(value:number)=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
const tips:Record<string,string>={
  'memory-wave':'牵起右手杆，让手臂进入金色轮廓，停一小会。她会回应你。',
  road:'用身杆向右前行，走到金色区域后稍作停留。也可用下方方向按钮。',
  guardian:'牵动右手杆，让手臂进入金色架挡区域，稳住这一瞬。',
  'call-light':'先把偶幕距离调大，再用身杆提起纹样、左右移灯，让白框覆盖金色山缝。',
  'split-search':'山已打开。调大偶幕距离，用身杆和灯位把纹样送进金色区域，让尘幕散去。',
  'call-split':'身杆保持稳定，把持斧手抬到约70°并停半秒，再由你落回身侧。',
  'split-axe':'身杆保持稳定，把持斧手抬到约70°并停半秒，再由你落回身侧。',
  'reunion-reach':'慢慢牵右手靠近母亲。你停下，她会等你；握柄和下方滑块都能操作。',
};

export function mountStoryController(stageSlot:HTMLElement,panel:HTMLElement,ctx:PageContext){
  const life=scope(),title=element('h2'),lead=element('p'),runtime=element('p','story-runtime'),shot=element('p','eyebrow'),cueHost=element('div','subtitles');
  runtime.id='story-runtime';runtime.setAttribute('role','status');shot.id='story-shot';
  const subtitles=mountSubtitles(cueHost),start=element('button','button primary','确认开始这一场'),skip=element('button','button secondary','先为他备好行装');
  const play=element('button','button primary','继续片段'),pause=element('button','button secondary','暂停'),reset=element('button','button secondary','重开片段（暂停）');
  const retry=element('button','button secondary','重试当前片段'),finish=element('button','button primary','确认进入下一段'),assist=element('button','button secondary','帮我演过这一段');
  const mode=element('select'),modeLabel=element('label','','演出节奏（暂停时可切换）'),transport=element('div','story-transport');
  const soundToggle=element('button','button secondary','开启舞台音效'),soundStatus=element('p','quiet-note'),soundPanel=element('div','stage-sound-controls');
  soundToggle.id='story-sound-toggle';soundToggle.type='button';soundStatus.id='story-sound-status';soundStatus.setAttribute('role','status');
  soundToggle.setAttribute('aria-describedby',soundStatus.id);append(soundPanel,soundToggle,soundStatus);
  let soundState:StageSoundStatus['state']='muted',soundDisposed=false;
  const sound=createStageSound(update=>{
    if(soundDisposed)return;soundState=update.state;soundStatus.textContent=update.message;soundStatus.setAttribute('data-state',update.state);
    soundToggle.textContent=update.state==='enabled'?'关闭舞台音效':update.state==='enabling'?'正在开启音效…':'开启舞台音效';
    soundToggle.setAttribute('aria-pressed',String(update.state==='enabled'));soundToggle.disabled=['unavailable','enabling','disposed'].includes(update.state);
  });
  function updateSound(sample:StageSoundSample){sound.update(sample);ctx.musicSample?.(sample);}
  for(const [value,label]of [['full','完整演出'],['guided','三分钟导览']]){const option=element('option','',label);option.value=value!;mode.appendChild(option);}
  const craft=link('去备行装 →','#/craft'),result=link('带走本场节目单 →','#/result'),note=element('p','quiet-note'),inputHost=element('div'),choices=element('div','story-choices');
  const call=element('button','button primary','先举灯呼唤'),split=element('button','button primary','先挥斧开山');
  call.id='story-call-first';split.id='story-split-first';append(choices,call,split);
  for(const [node,id]of [[start,'start'],[skip,'skip'],[play,'play'],[pause,'pause'],[reset,'reset'],[retry,'retry'],[finish,'finish'],[assist,'assist'],[mode,'mode']] as const)node.id=`story-${id}`;
  note.id='story-help';modeLabel.appendChild(mode);append(transport,play,pause,reset);
  append(panel,runtime,title,lead,shot,cueHost,start,skip,craft,choices,modeLabel,transport,soundPanel,finish,assist,note,inputHost,retry,result,link('先去展馆走走 →','#/museum'));
  let live:Runtime|null=null,display:Runtime|null=null,state:StoreState|null=null,key='',identity='',disposed=false,mountError='',holding:CanvasFrame|null=null;
  let message='已恢复，暂停接续。';
  const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');let reduced=media?.matches??false;
  function blocked(){return disposed||!state?.project||state.hasPending||ctx.isBusy()||['loading','closed','conflict','recovery','unsupported'].includes(state.status);}
  function current(rt:Runtime){return !disposed&&rt===live&&rt.scope.isCurrent(rt.entry.token);}
  function interactive(rt:Runtime){return rt.entry.node.kind==='interaction'&&rt.entry.node.id!=='craft';}
  function canPlay(rt:Runtime){return current(rt)&&!blocked()&&rt.ready&&!rt.completed&&!rt.requested&&(interactive(rt)||(['cinematic','curtain'].includes(rt.entry.node.kind)&&!rt.sample.ended));}
  function facts(rt:Runtime):SceneObservation{return {token:rt.entry.token,paused:!rt.playing,elapsedMs:rt.elapsed,now:new Date().toISOString()};}
  function stop(rt:Runtime,text?:string){
    rt.playing=false;rt.clock.stop();rt.controls?.release();
    updateSound({nodeId:rt.entry.node.id,mode:rt.mode,elapsedMs:rt.elapsed,playing:false});
    if(!rt.completed&&!rt.resolution){rt.interaction.reset();rt.reading=null;
      if(rt.assistance){rt.assistance.elapsed=0;rt.assistance.base=clone(rt.pose);rt.assistance.stage={...rt.light};}}
    if(text)message=text;renderUI();
  }
  function closeScope(rt:Runtime){rt.playing=false;updateSound({nodeId:rt.entry.node.id,mode:rt.mode,elapsedMs:rt.elapsed,playing:false});try{rt.scope.dispose();}catch(error){ctx.notify(`片段已退出，清理报告失败：${errorText(error)}`);}}
  function clearRuntimes(){if(live){closeScope(live);if(live!==display)live.stage.dispose();}display?.stage.dispose();live=display=null;clear(stageSlot);}
  function show(rt:Runtime){
    if(!current(rt))return;rt.ready=true;
    if(display!==rt){display?.stage.dispose();clear(stageSlot);stageSlot.appendChild(rt.stage.figure);display=rt;rt.stage.resize();}
    message='已恢复，暂停接续。';renderDisplayed();renderUI();
  }
  function renderDisplayed(){
    if(!display)return;const rt=display;title.textContent=rt.entry.node.title;lead.textContent=rt.entry.node.lead;shot.textContent=rt.sample.shotLabel;
    rt.shade.style.opacity=String(1-rt.sample.lightLevel);subtitles.update(rt.sample.cues,subtitlesForMode(rt.entry.node,rt.mode),rt.entry.token);
  }
  function submit(rt:Runtime,ready:ReadyCommand){
    if(!current(rt)||blocked()||rt.requested)return;
    rt.completed=ready;rt.requested=true;stop(rt,'正在保存这一刻，保存后再切幕…');
    void ctx.durable(()=>submitScopedSceneCommand(ctx.store,rt.scope,ready.command,ready.facts),
      rt.entry.node.id==='intro'?{path:'/craft',exhibitId:null}:undefined);
  }
  function offer(rt:Runtime,ready:ReadyCommand){
    rt.completed=ready;stop(rt,'这一段已完成。');
    if(['memory','error'].includes(ctx.store.getState().status))message='这一段已演完；确认进入下一段时，将尝试保存检查点。';else submit(rt,ready);
    renderUI();
  }
  function sample(rt:Runtime){
    rt.sample=rt.scene.sample(rt.elapsed,interactive(rt)?{chenxiangPose:rt.pose,stage:rt.light}:undefined,reduced);
    const progress=rt.resolution?rt.resolution.elapsed/rt.resolution.duration:0;
    const t=reduced?(progress>=1?1:progress>=.5?.5:0):smooth(progress),kind=rt.entry.node.completion.kind;
    rt.sample.frame=stagePlayFrame(rt.entry.node,rt.sample.frame,{opening:kind==='axe'?t:0,reveal:rt.resolution?1:(rt.reading?.coverage??0)/.35,
      reaction:rt.entry.node.id==='memory-wave'?t:0,guardianExit:rt.entry.node.id==='guardian'?t:0,holding});
    if(interactive(rt))rt.sample.frame.showRods=true;
    rt.stage.update(rt.sample.frame);if(display===rt)renderDisplayed();rt.controls?.render();
    updateSound({nodeId:rt.entry.node.id,mode:rt.mode,elapsedMs:rt.elapsed,playing:rt.playing&&rt.ready});
  }
  function safeSample(rt:Runtime){try{sample(rt);}catch(error){stop(rt,`场面已暂停：${errorText(error)}`);ctx.notify(message);}}
  function assistanceFrame(rt:Runtime,delta:number){
    const action=rt.assistance!;action.elapsed+=delta;let target=action.goal;
    if(rt.entry.node.completion.kind==='reach')target=interactionGoal(rt.entry.node,rt.sample.frame)??target;
    const t=reduced?(action.elapsed>=1600?1:0):smooth(action.elapsed/1600),pose=clone(action.base);
    pose.x=mix(action.base.x,target.pose.x,t);pose.y=mix(action.base.y,target.pose.y,t);pose.scale=mix(action.base.scale,target.pose.scale,t);
    for(const id of Object.keys(pose.joints) as (keyof Pose['joints'])[])pose.joints[id]=mix(action.base.joints[id],target.pose.joints[id],t);
    if(rt.entry.node.completion.kind==='axe'&&action.elapsed>2300)pose.joints.rightShoulder=mix(target.pose.joints.rightShoulder,0,reduced?(action.elapsed>=3000?1:0):smooth((action.elapsed-2300)/700));
    rt.pose=pose;rt.light={lampX:mix(action.stage.lampX,target.stage.lampX,t),puppetDistance:mix(action.stage.puppetDistance,target.stage.puppetDistance,t)};rt.operated=true;
  }
  function beginResolution(rt:Runtime,reading:InteractionReading){
    if(!reading.evidence)return;
    const source=rt.assistance?'assistance':'user',observed=facts(rt);
    if(rt.assistance)observed.assistanceElapsedMs=rt.assistance.elapsed;
    const command:SceneCommand=source==='assistance'?{...rt.entry.guard,action:'COMPLETE_INTERACTION',source}:
      {...rt.entry.guard,action:'COMPLETE_INTERACTION',source,evidence:reading.evidence};
    const kind=rt.entry.node.completion.kind;
    if(kind==='reach'){
      const hands=interactionHandPoints(rt.sample.frame),actor=rt.sample.frame.actors.find(item=>item.actorId==='chenxiang');
      if(hands&&actor){const dx=hands.mother.x-hands.chenxiang.x,dy=hands.mother.y-hands.chenxiang.y,distance=Math.hypot(dx,dy),weight=distance?Math.min(1,.04/distance):0;
        const fit=moveRodTo(template,actor.pose,rt.sample.frame.stage,'rightHand',{x:hands.chenxiang.x+dx*weight,y:hands.chenxiang.y+dy*weight});
        const moved=rodScreenPoint(template,fit.pose,rt.sample.frame.stage,'rightHand');
        if(fit.fits&&Math.hypot(moved.x-hands.chenxiang.x,moved.y-hands.chenxiang.y)<=.04+1e-8){rt.pose=fit.pose;sample(rt);}}
      holding=clone(rt.sample.frame);
    }
    rt.resolution={elapsed:0,duration:kind==='axe'?4000:kind==='wave'?2000:kind==='reach'?700:1500,ready:{command,facts:observed}};
    if(kind==='axe'||kind==='light'||kind==='reach')updateSound({nodeId:rt.entry.node.id,mode:rt.mode,elapsedMs:rt.elapsed,playing:rt.playing&&rt.ready,event:kind==='axe'?'mountain-open':kind==='light'?'light-found':'hands-meet'});
    rt.controls?.release();message=kind==='wave'?'她看见了你的手。袖口也留着同一纹样。':kind==='axe'?'斧已落下，山片正在打开。':kind==='light'?'纹样的光穿过遮挡，她在回应你。':kind==='reach'?'这一回，握住。':'让这一瞬的动作留在幕上。';renderUI();
  }
  function tick(rt:Runtime,delta:number){
    if(!current(rt)||blocked()||!rt.ready){stop(rt,'当前操作已暂停。');return false;}
    rt.elapsed+=delta;
    if(rt.resolution){rt.resolution.elapsed+=delta;sample(rt);if(rt.resolution.elapsed>=rt.resolution.duration){const ready=rt.resolution.ready;rt.resolution=null;offer(rt,ready);return false;}renderUI();return true;}
    if(interactive(rt)){
      if(rt.assistance)assistanceFrame(rt,delta);else rt.controls?.tick(delta);
      sample(rt);rt.reading=rt.interaction.observe(rt.sample.frame,rt.elapsed,false,rt.operated&&(rt.entry.node.completion.kind!=='reach'||rt.handOperated||!!rt.assistance));
      if(rt.reading.evidence&&(!rt.assistance||rt.assistance.elapsed>=3200))beginResolution(rt,rt.reading);
      else if(rt.assistance&&rt.assistance.elapsed>10000){stop(rt,'这次协助动作未能满足当前条件，请重开片段后重试或手动调整。');return false;}
      renderUI();return true;
    }
    sample(rt);
    if(rt.sample.ended){
      const observed=facts(rt);
      if(rt.sample.automatic)offer(rt,{command:{...rt.entry.guard,action:'COMPLETE_SCENE',source:'script'},facts:observed});
      else if(rt.entry.node.id==='reunion-hold'){rt.completed={command:{...rt.entry.guard,action:'COMPLETE_SCENE',source:'user'},facts:observed};stop(rt,'让这一刻安静停留。准备好了，再由你谢幕。');}
      else stop(rt,'片段已播完。');
      return false;
    }
    renderUI();return true;
  }
  function mount(project:ProjectV1){
    if(live){closeScope(live);if(live!==display)live.stage.dispose();}live=null;mountError='';
    const nextIdentity=`${project.projectId}:${project.story!.runId}`;
    if(identity!==nextIdentity||!['reunion-hold','curtain','completed'].includes(project.story!.nodeId))holding=null;
    identity=nextIdentity;
    try{
      const entry=storyEntry(project,reunionDefinition,++generation),scene=createSceneDirector(project,entry),initialSample=scene.sample(0,undefined,reduced);
      sound.reset(entry.node.id);ctx.musicSample?.({nodeId:entry.node.id,mode:project.story!.mode,elapsedMs:0,playing:false});
      const stage=canvasStage('当前短节点 · 使用本场冻结造型；操作与瞬时姿态不另存为录像。'),nodeScope=createNodeScope(entry.token,error=>ctx.notify(`片段清理失败：${errorText(error)}`));
      const shade=element('div','story-scene-shade');shade.setAttribute('aria-hidden','true');stage.screen.appendChild(shade);
      const rt:Runtime={entry,scene,scope:nodeScope,stage,shade,sample:initialSample,elapsed:0,playing:false,ready:false,requested:false,mode:project.story!.mode,clock:null!,controls:null,
        interaction:createNodeInteraction(entry.node),pose:clone(entry.node.entryPoses.chenxiang!),light:{lampX:entry.node.entryStage.lampX,puppetDistance:entry.node.entryStage.puppetDistance},operated:false,handOperated:false,reading:null,assistance:null,resolution:null,completed:null};
      rt.clock=createAnimationClock({request:callback=>window.requestAnimationFrame(callback),cancel:id=>window.cancelAnimationFrame(id),now:()=>performance.now()},delta=>tick(rt,delta),
        fault=>stop(rt,fault.reason==='gap'?'页面停顿较久，已暂停；继续时不补算这段时间。':`片段已停止：${errorText(fault.error)}`));
      live=rt;message='已恢复，暂停接续。';nodeScope.own(()=>rt.clock.dispose());
      nodeScope.listen(window,'blur',()=>{if(rt.playing)stop(rt,'已切换窗口，片段暂停。');});
      nodeScope.listen(document,'visibilitychange',()=>{if(document.hidden&&rt.playing)stop(rt,'页面已隐藏，片段暂停。');});
      nodeScope.own(stage.subscribe(status=>{
        if(!current(rt))return;if(status.state==='ready'){if(!rt.ready)show(rt);}
        else {rt.ready=false;if(rt.playing)stop(rt);message=status.state==='error'?`当前片段准备失败：${status.message}`:display&&display!==rt?'正在准备下一段，保留上一幕画面与台词。':'正在准备当前片段…';}renderUI();
      }));
      if(interactive(rt)){
        rt.controls=mountStoryRodControls(inputHost,stage,{
          read(){if(!current(rt))return null;const completion=entry.node.completion;
            const rods:readonly RodId[]=completion.kind==='wave'?['rightHand']:['body','rightHand'];
            const hands=completion.kind==='reach'?interactionHandPoints(rt.sample.frame):null;
            const target=hands?{minX:hands.mother.x-.07,maxX:hands.mother.x+.07,minY:hands.mother.y-.07,maxY:hands.mother.y+.07}:
              'target'in completion?normalizedTargetBounds(completion.target):null;
            return {frame:rt.sample.frame,enabled:!blocked()&&rt.ready&&rt.playing&&!rt.assistance&&!rt.resolution&&!rt.completed,rods,
              lights:completion.kind==='light',target,
              region:hands?{minX:hands.chenxiang.x-.03,maxX:hands.chenxiang.x+.03,minY:hands.chenxiang.y-.03,maxY:hands.chenxiang.y+.03}:
                ['wave','road','block','light'].includes(completion.kind)?projectedInteractionRegion(rt.sample.frame,completion.kind as 'wave'|'road'|'block'|'light'):null};},
          change(pose){if(!current(rt)||blocked()||!rt.playing||rt.assistance||rt.resolution)return;
            if(Math.abs(pose.joints.rightShoulder-rt.pose.joints.rightShoulder)>1e-8||Math.abs(pose.joints.rightElbow-rt.pose.joints.rightElbow)>1e-8)rt.handOperated=true;
            rt.pose=clone(pose);rt.operated=true;safeSample(rt);renderUI();},
          light(lampX,puppetDistance){if(!current(rt)||blocked()||!rt.playing||rt.assistance||rt.resolution)return;rt.light={lampX,puppetDistance};rt.operated=true;safeSample(rt);renderUI();},
          wake(){if(rt.playing&&current(rt)&&!blocked())rt.clock.start();},report(text){message=text;renderUI();},
        });nodeScope.own(()=>rt.controls?.dispose());
      }
      if(!display){display=rt;stageSlot.appendChild(stage.figure);renderDisplayed();}sample(rt);
    }catch(error){if(live){closeScope(live);if(live!==display)live.stage.dispose();live=null;}mountError=errorText(error);message=`片段未能准备：${mountError}`;ctx.notify(message);renderUI();}
  }
  function renderUI(){
    if(disposed)return;const rt=live,node=rt?.entry.node,hasStory=!!state?.project?.story;
    start.hidden=hasStory;start.disabled=blocked();skip.hidden=node?.id!=='intro';skip.disabled=blocked()||!rt?.ready;
    craft.hidden=node?.id!=='craft'||display!==rt;result.hidden=!['curtain','completed'].includes(node?.id??'');modeLabel.hidden=!rt;transport.hidden=!rt||node?.kind==='choice'||node?.kind==='terminal'||node?.id==='craft';
    choices.hidden=node?.kind!=='choice';call.disabled=split.disabled=blocked()||!rt?.ready||!!rt.requested;
    play.disabled=!rt||!canPlay(rt)||rt.playing;pause.disabled=!rt?.playing;reset.disabled=!rt||blocked();
    soundToggle.disabled=!rt||blocked()||['unavailable','enabling','disposed'].includes(soundState);
    play.textContent=node?.id==='intro'&&rt?.elapsed===0?'点亮幕灯，开始序幕':rt&&interactive(rt)?'继续操偶':'继续片段';
    mode.disabled=!rt||blocked()||rt.playing||!rt.ready;if(rt)mode.value=rt.mode;
    retry.hidden=!mountError&&rt?.stage.getStatus().state!=='error';retry.disabled=blocked();
    finish.hidden=!rt?.completed||rt.requested;finish.disabled=blocked()||!rt?.ready;finish.textContent=node?.id==='reunion-hold'?'谢幕':'确认进入下一段';
    assist.hidden=!rt||!interactive(rt)||!!rt.completed;assist.disabled=blocked()||!rt?.ready||!!rt?.resolution||!!rt?.assistance;
    const phase=mountError||rt?.stage.getStatus().state==='error'?'error':blocked()?'saving':rt&&!rt.ready?'loading':rt?.playing?'playing':'paused';
    runtime.setAttribute('data-state',phase);runtime.setAttribute('data-elapsed',String(Math.round(rt?.elapsed??0)));runtime.setAttribute('data-node',node?.id??'');
    runtime.setAttribute('data-token',rt?.entry.token??'');runtime.setAttribute('data-reduced-motion',String(reduced));runtime.setAttribute('data-coverage',String(rt?.reading?.coverage??0));
    runtime.setAttribute('data-held',String(rt?.reading?.heldMs??0));runtime.setAttribute('data-interaction',rt?.reading?.phase??'waiting');runtime.setAttribute('data-distance',String(rt?.reading?.distanceRatio??1));
    runtime.textContent=state?.hasPending?'检查点尚未保存；画面保留在当前段。请在作品工具中重试、取消或选择仅在本页继续。':message;
    note.textContent=!rt?'确认开演后，才会为本场留下独立的演出身份；直接打开页面不会替你开始。':node?.id==='craft'?'从“去备行装”继续制作并确认本场造型。':
      node?.kind==='choice'?'这是你对演出顺序的选择。两条路都会团圆；请亲自选定。':
      interactive(rt)?`${tips[node!.id]} 金色是目标区域，白线是当前观察范围。暂停不累计动作时间；刷新会从本段开头的静止画面重新开始。`:
      `尚未播放时是本段开头的静止画面；继续片段后，字幕与场面一起走。${reduced?'已启用减少动态。':''}声音可选，静音也保留全部字幕与操作。`;
    if(!hasStory){title.textContent='还没有开始这一场';lead.textContent=note.textContent;shot.textContent='';subtitles.update([],[],'empty');}rt?.controls?.render();
  }
  life.on(start,'click',()=>ctx.start('full'));
  life.on(soundToggle,'click',()=>{if(soundState==='enabled')sound.mute();else void sound.enable();});
  life.on(play,'click',()=>{const rt=live;if(!rt||!canPlay(rt))return;rt.playing=true;message=interactive(rt)?'这一段在等你的手。':reduced?'正在播放静态分镜与字幕。':'正在播放当前片段。';updateSound({nodeId:rt.entry.node.id,mode:rt.mode,elapsedMs:rt.elapsed,playing:true});renderUI();rt.clock.start();});
  life.on(pause,'click',()=>{if(live)stop(live,'片段已暂停；继续时从此处接续，连续动作重新计时。');});
  life.on(reset,'click',()=>{if(!blocked()&&state?.project?.story)mount(state.project);});
  life.on(retry,'click',()=>{if(blocked())return;if(mountError&&state?.project?.story)mount(state.project);else live?.stage.retry();});
  life.on(skip,'click',()=>{const rt=live;if(!rt||blocked()||!rt.ready||rt.entry.node.id!=='intro')return;submit(rt,{command:introSkipCommand(rt.entry.guard),facts:facts(rt)});});
  life.on(mode,'change',()=>{const selected=mode.value as 'full'|'guided',rt=live;if(!rt||blocked()||rt.playing||!rt.ready)return;
    void ctx.durable(()=>submitScopedSceneCommand(ctx.store,rt.scope,{...rt.entry.guard,action:'SET_MODE',mode:selected},facts(rt)));});
  life.on(finish,'click',()=>{const rt=live;if(rt?.completed)submit(rt,{command:rt.completed.command,facts:{...rt.completed.facts,now:new Date().toISOString()}});});
  for(const [button,approach]of [[call,'call-first'],[split,'split-first']] as const)life.on(button,'click',()=>{
    const rt=live;if(!rt||blocked()||!rt.ready||rt.entry.node.kind!=='choice')return;
    submit(rt,{command:{...rt.entry.guard,action:'CHOOSE',approach},facts:facts(rt)});
  });
  life.on(assist,'click',()=>{
    const rt=live;if(!rt||blocked()||!rt.ready||!interactive(rt)||rt.assistance||rt.resolution||rt.completed)return;
    const goal=interactionGoal(rt.entry.node,rt.sample.frame);if(!goal){message='当前几何条件无法演出这段协助动作，请重开片段后重试。';renderUI();return;}
    rt.interaction.reset();rt.assistance={elapsed:0,base:clone(rt.pose),stage:{...rt.light},goal};rt.playing=true;message='与你协作演这一段；完成后节目单会记录本段协助。';updateSound({nodeId:rt.entry.node.id,mode:rt.mode,elapsedMs:rt.elapsed,playing:true});renderUI();rt.clock.start();
  });
  const motionChanged=()=>{reduced=media?.matches??false;if(live){stop(live,'动态偏好已变化，当前片段暂停。');safeSample(live);}renderUI();};
  if(media){if(media.addEventListener)media.addEventListener('change',motionChanged);else media.addListener(motionChanged);}
  return {
    update(next:StoreState){
      const hadPending=state?.hasPending;state=next;const project=next.project,story=project?.story,nextKey=story?`${project!.projectId}:${story.runId}:${story.revision}:${story.nodeId}`:'';
      if(hadPending&&!next.hasPending&&nextKey===key&&live?.requested){live.requested=false;message='已取消未保存的切幕，保留当前片段；可重新确认或重开。';}
      if(nextKey!==key){key=nextKey;if(project&&story)mount(project);else {holding=null;identity='';clearRuntimes();}}
      if(live&&blocked()&&live.playing)stop(live,'正在处理作品，片段已暂停。');renderUI();
    },
    dispose(){if(disposed)return;disposed=true;soundDisposed=true;sound.dispose();life.dispose();if(media){if(media.removeEventListener)media.removeEventListener('change',motionChanged);else media.removeListener(motionChanged);}subtitles.dispose();clearRuntimes();holding=null;},
  };
}
