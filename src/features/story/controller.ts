import { confirmCraft } from '../../app/craft-commands';
import { createInteractionClip } from '../../story/interaction-clip';
import { createAnimationClock } from '../../app/animation-clock';
import { submitScopedSceneCommand } from '../../app/story-scene-commands';
import type { SceneCommand,SceneObservation } from '../../app/story-scene-commands';
import type { PageContext } from '../../app/view';
import type { StoreState } from '../../app/store';
import { assetCatalog } from '../../content/catalog';
import { definitionFor } from '../../content/reunion';
import { subtitlesForMode } from '../../content/story-contract';
import { moveRodTo,rodScreenPoint } from '../../domain/rod-input';
import type { RodId } from '../../domain/rod-input';
import { cueSeekTime } from '../../story/cue-seek';
import type { CueSeek } from '../../story/cue-seek';
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
type Resolution={elapsed:number;duration:number;ready:ReadyCommand;departure:CanvasFrame};
type Assistance={elapsed:number;base:Pose;stage:Pick<StageConfig,'lampX'|'puppetDistance'>;goal:NonNullable<ReturnType<typeof interactionGoal>>};
type Runtime={entry:ReturnType<typeof storyEntry>;scene:Director;scope:ReturnType<typeof createNodeScope>;
  stage:ReturnType<typeof canvasStage>;clock:ReturnType<typeof createAnimationClock>;shade:HTMLDivElement;
  controls:ReturnType<typeof mountStoryRodControls>|null;interaction:ReturnType<typeof createNodeInteraction>;
  sample:ReturnType<Director['sample']>;version:1|2|3|4;clip:ReturnType<typeof createInteractionClip>|null;elapsed:number;playing:boolean;ready:boolean;requested:boolean;mode:'full'|'guided';
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
  'call-light':'举起手中的灯，移动身躯与灯位，让白框内的灯火照进金色山缝。',
  'split-search':'山已打开。举起灯笼，调整身躯与灯位，把灯火送进金色区域，让尘幕散去。',
  'call-split':'身杆保持稳定，把持斧手抬到约70°并停半秒，再由你落回身侧。',
  'split-axe':'身杆保持稳定，把持斧手抬到约70°并停半秒，再由你落回身侧。',
  'reunion-reach':'慢慢牵右手靠近母亲。你停下，她会等你；握柄和下方滑块都能操作。',
};

export function mountStoryController(stageSlot:HTMLElement,panel:HTMLElement,ctx:PageContext){
  const life=scope(),title=element('h2'),lead=element('p'),runtime=element('p','story-runtime'),shot=element('p','eyebrow'),cueHost=element('div','subtitles');
  const legacyNote=element('p','quiet-note','你正在继续先前的团圆剧本。五终章新剧本可从制偶页归档重开。');legacyNote.hidden=true;legacyNote.appendChild(link(' 去制偶页 →','#/craft'));
  runtime.id='story-runtime';runtime.setAttribute('role','status');shot.id='story-shot';
  const subtitles=mountSubtitles(cueHost,seek),start=element('button','button primary','确认开始这一场'),skip=element('button','button secondary','先为他备好行装');
  const play=element('button','button primary','继续片段'),pause=element('button','button secondary','暂停'),reset=element('button','button secondary','重开片段（暂停）');
  const nextNode=element('button','button secondary story-next-node','下一片段');nextNode.id='story-next-node';
  const retry=element('button','button secondary','重试当前片段'),finish=element('button','button primary','确认进入下一段'),assist=element('button','button secondary','帮我演过这一段');
  const showcaseSkip=element('button','button secondary','跳过定场放映'),showcaseAgain=element('button','button secondary','再看一次'),confirm=element('button','button primary','确认这身行装，进入第一幕');
  showcaseSkip.id='showcase-skip';showcaseAgain.id='showcase-again';confirm.id='story-confirm-craft';
  const mode=element('select'),modeLabel=element('label','','演出节奏（暂停时可切换）'),transport=element('div','story-transport');
  const soundToggle=element('button','button secondary','关闭舞台音效'),soundStatus=element('p','quiet-note'),soundPanel=element('div','stage-sound-controls');
  soundToggle.id='story-sound-toggle';soundToggle.type='button';soundStatus.id='story-sound-status';soundStatus.setAttribute('role','status');
  soundToggle.setAttribute('aria-describedby',soundStatus.id);append(soundPanel,soundToggle,soundStatus);
  let soundState:StageSoundStatus['state']='muted',soundDisposed=false;
  const reportSound=(update:StageSoundStatus)=>{
    if(soundDisposed)return;soundState=update.state;soundStatus.textContent=['blocked','error','unavailable'].includes(update.state)?update.message:'';soundStatus.setAttribute('data-state',update.state);
    const enabled=ctx.audio?.effectsEnabled()??update.state==='enabled';
    soundToggle.textContent=enabled?'关闭舞台音效':'开启舞台音效';
    soundToggle.setAttribute('aria-pressed',String(enabled));soundToggle.disabled=['unavailable','disposed'].includes(update.state);
  };
  const sound=ctx.audio?.effects??createStageSound(reportSound);
  const unsubscribeSound=ctx.audio?sound.subscribe(reportSound):()=>{};
  function updateSound(sample:StageSoundSample){const next={...sample,definitionVersion:live?.version??state?.project?.story?.definitionVersion};sound.update(next);ctx.musicSample?.(next);}
  for(const [value,label]of [['full','完整演出'],['guided','节选导览']]){const option=element('option','',label);option.value=value!;mode.appendChild(option);}
  const craft=link('去备行装 →','#/craft'),result=link('带走本场节目单 →','#/result'),note=element('p','quiet-note'),inputHost=element('div'),choices=element('div','story-choices');
  const call=element('button','button primary','先举灯呼唤'),split=element('button','button primary','先挥斧开山');
  call.id='story-call-first';split.id='story-split-first';append(choices,call,split);
  for(const [node,id]of [[start,'start'],[skip,'skip'],[play,'play'],[pause,'pause'],[reset,'reset'],[retry,'retry'],[finish,'finish'],[assist,'assist'],[mode,'mode']] as const)node.id=`story-${id}`;
  inputHost.className='story-inputs';note.id='story-help';modeLabel.appendChild(mode);append(transport,play,pause,reset,nextNode,showcaseSkip,showcaseAgain);
  append(panel,runtime,title,lead,legacyNote,shot,cueHost,start,skip,craft,confirm,choices,modeLabel,transport,soundPanel,finish,assist,note,inputHost,retry,result,link('先去展馆走走 →','#/museum'));
  let live:Runtime|null=null,display:Runtime|null=null,state:StoreState|null=null,key='',identity='',disposed=false,mountError='',holding:CanvasFrame|null=null;
  let message='已恢复，暂停接续。';
  const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');let reduced=media?.matches??false;
  function blocked(){return disposed||!state?.project||state.hasPending||ctx.isBusy()||['loading','closed','conflict','recovery','unsupported'].includes(state.status);}
  function current(rt:Runtime){return !disposed&&rt===live&&rt.scope.isCurrent(rt.entry.token);}
  function interactive(rt:Runtime){return rt.entry.node.kind==='interaction'&&rt.entry.node.id!=='craft';}
  function canPlay(rt:Runtime){return current(rt)&&!blocked()&&rt.ready&&!rt.completed&&!rt.requested&&(interactive(rt)||(['cinematic','curtain',...(rt.version>=3?['choice']:[])].includes(rt.entry.node.kind)&&!rt.sample.ended));}
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
    if(display!==rt){display?.stage.dispose();clear(stageSlot);stageSlot.appendChild(rt.stage.figure);rt.stage.figure.appendChild(inputHost);display=rt;rt.stage.resize();}
    message='已恢复，暂停接续。';renderDisplayed();renderUI();
  }
  function renderDisplayed(){
    if(!display)return;const rt=display;title.textContent=rt.entry.node.title;lead.textContent=rt.entry.node.lead;shot.textContent=rt.sample.shotLabel;
    rt.shade.style.opacity=String(1-rt.sample.lightLevel);renderSubtitles(rt);
  }
  function renderSubtitles(rt:Runtime){
    const enabled=current(rt)&&!blocked()&&state?.status!=='saving'&&rt.ready&&!rt.requested&&!rt.resolution&&!rt.completed&&rt.entry.node.id!=='craft'&&rt.entry.node.kind!=='terminal';
    subtitles.update(rt.sample.cues,rt.version>=3?rt.entry.node.subtitles:subtitlesForMode(rt.entry.node,rt.mode),rt.entry.token,
      {mode:rt.mode,cues:subtitlesForMode(rt.entry.node,rt.mode),elapsedMs:rt.elapsed,enabled,
        reason:rt.resolution?'这一段已达标，定场放映期间不能定位台词。':rt.completed?'本段达标证据已确认，请先保存进入下一段。':'幕面准备、造型确认或保存期间，台词定位暂不可用。'});
  }
  function seek(request:CueSeek){
    const rt=live;if(!rt||!current(rt))return;
    const time=cueSeekTime(request,{nodeToken:rt.entry.token,mode:rt.mode,node:rt.entry.node,ready:rt.ready,
      blocked:blocked()||state?.status==='saving'||rt.requested,resolving:!!rt.resolution,completed:!!rt.completed});
    if(time===null)return;
    const wasPlaying=rt.playing;rt.playing=false;rt.clock.stop();rt.controls?.release();
    rt.interaction.reset();rt.reading=null;rt.operated=false;rt.handOperated=false;rt.assistance=null;holding=null;
    rt.pose=clone(rt.entry.node.entryPoses.chenxiang!);rt.light={lampX:rt.entry.node.entryStage.lampX,puppetDistance:rt.entry.node.entryStage.puppetDistance};rt.elapsed=time;
    const soundSample:StageSoundSample&{definitionVersion:Runtime['version']}={definitionVersion:rt.version,nodeId:rt.entry.node.id,mode:rt.mode,elapsedMs:time,playing:false};
    const seeker=sound as typeof sound&{seek?:(sample:StageSoundSample)=>void};
    if(seeker.seek)seeker.seek(soundSample);else sound.update(soundSample);
    ctx.musicSample?.(soundSample);safeSample(rt);
    // Sampling itself must never observe a task, offer a command or persist the transport position.
    rt.playing=wasPlaying&&rt.ready&&!blocked();message=rt.playing?'已定位当前台词，按原节奏继续；操偶动作重新计时。':'已定位当前台词，暂停查看；操偶动作重新计时。';
    updateSound({...soundSample,playing:rt.playing});renderUI();if(rt.playing)rt.clock.start();
  }
  function submit(rt:Runtime,ready:ReadyCommand){
    if(!current(rt)||blocked()||rt.requested)return;
    rt.completed=ready;rt.requested=true;stop(rt,'正在保存这一刻，保存后再切幕…');
    void ctx.durable(()=>submitScopedSceneCommand(ctx.store,rt.scope,ready.command,ready.facts),
      rt.entry.node.id==='intro'&&rt.version<3?{path:'/craft',exhibitId:null}:undefined);
  }
  function offer(rt:Runtime,ready:ReadyCommand){
    rt.completed=ready;stop(rt,'这一段已完成。');
    if(['memory','error'].includes(ctx.store.getState().status))message='这一段已演完；确认进入下一段时，将尝试保存检查点。';else submit(rt,ready);
    renderUI();
  }
  function sample(rt:Runtime){
    if(rt.clip&&(rt.resolution||rt.completed)){
      rt.sample=rt.clip.showcase(rt.resolution?.elapsed??Infinity,reduced);
      // Dim the frozen user composition first; only reset behind the curtain at 300ms.
      if(rt.resolution&&rt.resolution.elapsed<300&&!reduced){rt.sample.frame=clone(rt.resolution.departure);rt.sample.frame.showRods=false;if(rt.sample.frame.spatial)rt.sample.frame.spatial.light=rt.sample.lightLevel;}
    }
    else {
    rt.sample=rt.scene.sample(rt.elapsed,interactive(rt)?{chenxiangPose:rt.pose,stage:rt.light}:undefined,reduced);
    const progress=rt.resolution?rt.resolution.elapsed/rt.resolution.duration:0;
    const t=reduced?(progress>=1?1:progress>=.5?.5:0):smooth(progress),kind=rt.entry.node.completion.kind;
    rt.sample.frame=stagePlayFrame(rt.entry.node,rt.sample.frame,{opening:kind==='axe'?t:0,reveal:rt.resolution?1:(rt.reading?.coverage??0)/.35,
      reaction:rt.entry.node.id==='memory-wave'?t:0,guardianExit:rt.entry.node.id==='guardian'?t:0,holding});
    if(interactive(rt))rt.sample.frame.showRods=rt.version<3||rt.elapsed>=rt.scene.durationMs;
    }
    rt.stage.update(rt.sample.frame);if(display===rt)renderDisplayed();
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
    if(kind==='reach'&&!rt.clip){
      const hands=interactionHandPoints(rt.sample.frame),actor=rt.sample.frame.actors.find(item=>item.actorId==='chenxiang');
      if(hands&&actor){const dx=hands.mother.x-hands.chenxiang.x,dy=hands.mother.y-hands.chenxiang.y,distance=Math.hypot(dx,dy),weight=distance?Math.min(1,.04/distance):0;
        const fit=moveRodTo(template,actor.pose,rt.sample.frame.stage,'rightHand',{x:hands.chenxiang.x+dx*weight,y:hands.chenxiang.y+dy*weight});
        const moved=rodScreenPoint(template,fit.pose,rt.sample.frame.stage,'rightHand');
        if(fit.fits&&Math.hypot(moved.x-hands.chenxiang.x,moved.y-hands.chenxiang.y)<=.04+1e-8){rt.pose=fit.pose;sample(rt);}}
      holding=clone(rt.sample.frame);
    }
    rt.resolution={elapsed:0,duration:rt.clip?.durationMs??(kind==='axe'?4000:kind==='wave'?2000:kind==='reach'?700:1500),ready:{command,facts:observed},departure:clone(rt.sample.frame)};
    if(kind==='axe'||kind==='light'||kind==='reach')updateSound({nodeId:rt.entry.node.id,mode:rt.mode,elapsedMs:rt.elapsed,playing:rt.playing&&rt.ready,event:kind==='axe'?'mountain-open':kind==='light'?'light-found':'hands-meet'});
    rt.controls?.release();if(rt.clip){message='达标已确认。收杆定场后，为你放映这一段的编排动作。';safeSample(rt);renderUI();return;}message=kind==='wave'?'她看见了你的手，灯下的回应仍像从前。':kind==='axe'?'斧已落下，山片正在打开。':kind==='light'?'灯火穿过遮挡，她在回应你。':kind==='reach'?'这一回，握住。':'让这一瞬的动作留在幕上。';renderUI();
  }
  function tick(rt:Runtime,delta:number){
    if(!current(rt)||blocked()||!rt.ready){stop(rt,'当前操作已暂停。');return false;}
    rt.elapsed+=delta;
    if(rt.resolution){rt.resolution.elapsed+=delta;sample(rt);if(rt.resolution.elapsed>=rt.resolution.duration){finishResolution(rt);return false;}renderUI();return true;}
    if(interactive(rt)){
      if(rt.version>=3&&rt.elapsed<rt.scene.durationMs){sample(rt);message='先听这一段故事；对白结束后，握柄会出现，再由你接过影偶。';renderUI();return true;}
      if(rt.version>=3&&rt.elapsed-delta<rt.scene.durationMs)message='对白说完了。现在接过影偶，完成下面的动作。';
      if(rt.assistance)assistanceFrame(rt,delta);else rt.controls?.tick(delta);
      sample(rt);rt.reading=rt.interaction.observe(rt.sample.frame,rt.elapsed,false,rt.operated&&(rt.entry.node.completion.kind!=='reach'||rt.handOperated||!!rt.assistance));
      if(rt.reading.evidence&&(!rt.assistance||rt.assistance.elapsed>=3200))beginResolution(rt,rt.reading);
      else if(rt.assistance&&rt.assistance.elapsed>10000){stop(rt,'这次协助动作未能满足当前条件，请重开片段后重试或手动调整。');return false;}
      renderUI();return true;
    }
    sample(rt);
    if(rt.sample.ended){
      if(rt.entry.node.kind==='choice'){stop(rt,'对白已说完，这一幕的去向由你决定。');return false;}
      const observed=facts(rt);
      if(rt.sample.automatic)offer(rt,{command:{...rt.entry.guard,action:'COMPLETE_SCENE',source:'script'},facts:observed});
      else if(rt.entry.node.completion.kind==='scene'&&rt.entry.node.completion.activation==='user'){rt.completed={command:{...rt.entry.guard,action:'COMPLETE_SCENE',source:'user'},facts:observed};stop(rt,'让这一刻安静停留。准备好了，再由你进入下一段。');}
      else stop(rt,'片段已播完。');
      return false;
    }
    renderUI();return true;
  }
  function mount(project:ProjectV1){
    const spatialPreference=identity===`${project.projectId}:${project.story!.runId}`?display?.stage.spatialPreference():undefined;
    if(live){closeScope(live);if(live!==display)live.stage.dispose();}live=null;mountError='';
    const nextIdentity=`${project.projectId}:${project.story!.runId}`;
    if(identity!==nextIdentity||!['reunion-hold','curtain','completed'].includes(project.story!.nodeId))holding=null;
    identity=nextIdentity;
    try{
      const entry=storyEntry(project,definitionFor(project.story),++generation),scene=createSceneDirector(project,entry),initialSample=scene.sample(0,undefined,reduced);
      sound.reset(entry.node.id);ctx.musicSample?.({nodeId:entry.node.id,mode:project.story!.mode,definitionVersion:project.story!.definitionVersion,elapsedMs:0,playing:false});
      const stage=canvasStage('先听这一段，再接过操偶。'),nodeScope=createNodeScope(entry.token,error=>ctx.notify(`片段清理失败：${errorText(error)}`));
      stage.restoreSpatial(spatialPreference);
      const shade=element('div','story-scene-shade');shade.setAttribute('aria-hidden','true');stage.screen.appendChild(shade);
      const rt:Runtime={entry,scene,version:project.story!.definitionVersion,clip:project.story!.definitionVersion>=3&&entry.node.kind==='interaction'&&entry.node.id!=='craft'?createInteractionClip(entry.node,scene):null,scope:nodeScope,stage,shade,sample:initialSample,elapsed:0,playing:false,ready:false,requested:false,mode:project.story!.mode,clock:null!,controls:null,
        interaction:createNodeInteraction(entry.node),pose:clone(entry.node.entryPoses.chenxiang!),light:{lampX:entry.node.entryStage.lampX,puppetDistance:entry.node.entryStage.puppetDistance},operated:false,handOperated:false,reading:null,assistance:null,resolution:null,completed:null};
      rt.clock=createAnimationClock({request:callback=>window.requestAnimationFrame(callback),cancel:id=>window.cancelAnimationFrame(id),now:()=>performance.now()},delta=>tick(rt,delta),
        fault=>stop(rt,fault.reason==='gap'?'页面停顿较久，已暂停；继续时不补算这段时间。':`片段已停止：${errorText(fault.error)}`),stage.frameObserver);
      live=rt;message='已恢复，暂停接续。';nodeScope.own(()=>rt.clock.dispose());
      nodeScope.listen(window,'blur',()=>{if(rt.playing)stop(rt,'已切换窗口，片段暂停。');});
      nodeScope.listen(document,'visibilitychange',()=>{if(document.hidden&&rt.playing)stop(rt,'页面已隐藏，片段暂停。');});
      nodeScope.own(stage.subscribe(status=>{
        if(!current(rt))return;if(status.state==='ready'){if(!rt.ready)show(rt);}
        else {rt.ready=false;if(rt.playing)stop(rt);message=status.state==='error'?`当前片段准备失败：${status.message}`:display&&display!==rt?'正在准备下一段，保留上一幕画面与台词。':'正在准备当前片段…';}renderUI();
      }));
      if(interactive(rt)){
        rt.controls=mountStoryRodControls(inputHost,stage,{
          read(){if(!current(rt))return null;if(rt.clip&&(rt.elapsed<rt.scene.durationMs||rt.resolution||rt.completed))return {frame:rt.sample.frame,enabled:false,rods:[],lights:false,target:null,region:null};const completion=entry.node.completion;
            const rods:readonly RodId[]=project.story!.definitionVersion!==1?['body','leftHand','rightHand']:completion.kind==='wave'?['rightHand']:['body','rightHand'];
            const hands=completion.kind==='reach'?interactionHandPoints(rt.sample.frame):null;
            const target=hands?{minX:hands.mother.x-.07,maxX:hands.mother.x+.07,minY:hands.mother.y-.07,maxY:hands.mother.y+.07}:
              'target'in completion?normalizedTargetBounds(completion.target):null;
            return {frame:rt.sample.frame,enabled:!blocked()&&rt.ready&&rt.playing&&(rt.version<3||rt.elapsed>=rt.scene.durationMs)&&!rt.assistance&&!rt.resolution&&!rt.completed,rods,
              lights:completion.kind==='light',target,
              region:hands?{minX:hands.chenxiang.x-.03,maxX:hands.chenxiang.x+.03,minY:hands.chenxiang.y-.03,maxY:hands.chenxiang.y+.03}:
                ['wave','road','block','light'].includes(completion.kind)?projectedInteractionRegion(rt.sample.frame,completion.kind as 'wave'|'road'|'block'|'light',completion.kind==='light'?completion.region:undefined):null};},
          change(pose,source){if(!current(rt)||blocked()||!rt.playing||rt.assistance||rt.resolution)return;runtime.setAttribute('data-input-revision',String(Number(runtime.getAttribute('data-input-revision')??0)+1));
            if(Math.abs(pose.joints.rightShoulder-rt.pose.joints.rightShoulder)>1e-8||Math.abs(pose.joints.rightElbow-rt.pose.joints.rightElbow)>1e-8)rt.handOperated=true;
            rt.pose=clone(pose);if(source!=='leftFoot'&&source!=='rightFoot')rt.operated=true;safeSample(rt);renderUI();},
          light(lampX,puppetDistance){if(!current(rt)||blocked()||!rt.playing||rt.assistance||rt.resolution)return;rt.light={lampX,puppetDistance};rt.operated=true;safeSample(rt);renderUI();},
          wake(){if(rt.playing&&current(rt)&&!blocked())rt.clock.start();},report(text){message=text;renderUI();},
        });nodeScope.own(()=>rt.controls?.dispose());
      }
      if(ctx.guide==='puppetry'&&interactive(rt)){rt.elapsed=rt.scene.durationMs;rt.playing=true;}
      if(!display){display=rt;stageSlot.appendChild(stage.figure);stage.figure.appendChild(inputHost);renderDisplayed();}sample(rt);
    }catch(error){if(live){closeScope(live);if(live!==display)live.stage.dispose();live=null;}mountError=errorText(error);message=`片段未能准备：${mountError}`;ctx.notify(message);renderUI();}
  }
  function renderUI(){
    if(disposed)return;const rt=live,node=rt?.entry.node,hasStory=!!state?.project?.story;
    legacyNote.hidden=!state?.project?.story||state.project.story.definitionVersion>=3;legacyNote.textContent='你正在接续先前版本的演出，仍按当时的台词与编排继续。';
    const destination=node?.next&&'default'in node.next?definitionFor(state?.project?.story).nodes.find(n=>n.id===(node.next as {default:string}).default):null;nextNode.hidden=!hasStory||node?.kind==='terminal';nextNode.disabled=blocked()||!rt?.ready||!!rt.resolution||!!rt.completed||!destination||node?.id==='craft';nextNode.textContent=node?.kind==='choice'?'请先选择去向':node?.id==='craft'?'请先确认这身行装':destination?'跳过本段，进入《'+destination.title+'》':'下一片段';
    start.hidden=hasStory;start.disabled=blocked();skip.hidden=node?.id!=='intro';skip.disabled=blocked()||!rt?.ready;
    craft.hidden=node?.id!=='craft'||display!==rt;confirm.hidden=craft.hidden||(rt?.version??0)<3;confirm.disabled=blocked()||!rt?.ready||!!rt.requested;result.hidden=!['curtain','completed'].includes(node?.id??'');modeLabel.hidden=!rt;transport.hidden=!rt||(node?.kind==='choice'&&(rt?.version??0)<3)||node?.kind==='terminal'||node?.id==='craft';
    const endings=definitionFor(state?.project?.story).endings;
    choices.hidden=node?.kind!=='choice';call.hidden=split.hidden=node?.id!=='approach-choice';for(const [id,button] of endingButtons){const label=endings?.find(end=>end.id===id)?.choiceLabel;if(label&&button.textContent!==label)button.textContent=label;button.hidden=node?.id!=='ending-choice';button.disabled=blocked()||!rt?.ready||!!rt.requested||((rt?.version??0)>=3&&rt.elapsed<rt.scene.durationMs);}call.disabled=split.disabled=blocked()||!rt?.ready||!!rt.requested||((rt?.version??0)>=3&&rt.elapsed<rt.scene.durationMs);
    play.disabled=!rt||!canPlay(rt)||rt.playing;pause.disabled=!rt?.playing;reset.disabled=!rt||blocked();
    soundToggle.disabled=!rt||blocked()||['unavailable','disposed'].includes(soundState);
    showcaseSkip.hidden=showcaseAgain.hidden=!rt?.resolution||!rt.clip;showcaseSkip.disabled=showcaseAgain.disabled=blocked();
    play.textContent=rt?.resolution&&rt.clip?'继续定场放映':rt&&rt.version>=3&&rt.elapsed<rt.scene.durationMs&&interactive(rt)?'听这一段故事':node?.id==='intro'&&rt?.elapsed===0?'点亮幕灯，开始序幕':rt&&interactive(rt)?'继续操偶':'继续片段';
    mode.disabled=!rt||blocked()||rt.playing||!!rt.resolution||!!rt.completed||!rt.ready||!rt.entry.node.allowedActions.includes('SET_MODE');if(rt)mode.value=rt.mode;
    retry.hidden=!mountError&&rt?.stage.getStatus().state!=='error';retry.disabled=blocked();
    finish.hidden=!rt?.completed||rt.requested;finish.disabled=blocked()||!rt?.ready;finish.textContent=node?.id==='reunion-hold'&&state?.project?.story?.definitionVersion===1?'谢幕':node?.id.endsWith('-hold')?'读终章后记':'确认进入下一段';
    assist.hidden=!rt||!interactive(rt)||!!rt.completed;assist.disabled=blocked()||!rt?.ready||!!rt?.resolution||!!rt?.assistance||((rt?.version??0)>=3&&rt.elapsed<rt.scene.durationMs);
    const phase=mountError||rt?.stage.getStatus().state==='error'?'error':blocked()?'saving':rt&&!rt.ready?'loading':rt?.playing?'playing':'paused';
    runtime.setAttribute('data-showcase',rt?.resolution&&rt.clip?'playing':rt?.completed&&rt.clip?'complete':'none');runtime.setAttribute('data-showcase-elapsed',String(Math.round(rt?.resolution?.elapsed??0)));runtime.setAttribute('data-state',phase);runtime.setAttribute('data-elapsed',String(Math.round(rt?.elapsed??0)));runtime.setAttribute('data-node',node?.id??'');
    runtime.setAttribute('data-token',rt?.entry.token??'');runtime.setAttribute('data-reduced-motion',String(reduced));runtime.setAttribute('data-coverage',String(rt?.reading?.coverage??0));
    runtime.setAttribute('data-held',String(rt?.reading?.heldMs??0));runtime.setAttribute('data-interaction',rt?.reading?.phase??'waiting');runtime.setAttribute('data-distance',String(rt?.reading?.distanceRatio??1));
    runtime.textContent=state?.hasPending?'检查点尚未保存；画面保留在当前段。请在作品工具中重试、取消或选择仅在本页继续。':message;
    note.textContent=!rt?'确认开演后，才会为本场留下独立的演出身份；直接打开页面不会替你开始。':node?.id==='craft'?'确认已经准备好的造型，便为本场冻结行装；也可回到制偶页调整。':
      node?.kind==='choice'?(rt.version>=3&&rt.elapsed<rt.scene.durationMs?'先听这段对白；说完以后，再亲自选择这一场的去向。':'请亲自选择这一场的去向。操作失误和使用协助不会替你决定结局。'):
      rt.version>=3&&interactive(rt)&&rt.elapsed<rt.scene.durationMs?'先听这一段故事，随后会展开握柄与操偶控件。也可展开本段完整台词阅读。':
      rt.resolution&&rt.clip?'这一段已达标，握柄已收起。可暂停、跳过放映或从头再看；放映结束后只保存一次。':interactive(rt)?`${tips[node!.id]??(node!.completion.kind==='axe'?'抬起右手，稳住半秒，再亲手落斧。':node!.completion.kind==='light'?'举起灯笼，移动身躯与灯位，让灯火照进金色区域。':'用方向键移身，走进金色区域后停留。')} 金色是目标区域，白线是当前观察范围。暂停不累计动作时间；刷新会从本段开头的静止画面重新开始。`:
      `尚未播放时是本段开头的静止画面；继续片段后，字幕与场面一起走。${reduced?'已启用减少动态。':''}声音可选，静音也保留全部字幕与操作。`;
    if(display)renderSubtitles(display);
    if(!hasStory){title.textContent='还没有开始这一场';lead.textContent=note.textContent;shot.textContent='';subtitles.update([],[],'empty');}rt?.controls?.render();
  }
  function finishResolution(rt:Runtime){
    if(!rt.resolution)return;const ready=rt.resolution.ready;
    if(rt.clip){const frame=rt.clip.endFrame();const actor=frame.actors.find(item=>item.actorId==='chenxiang');if(actor)rt.pose=clone(actor.pose);rt.light={lampX:frame.stage.lampX,puppetDistance:frame.stage.puppetDistance};if(rt.entry.node.completion.kind==='reach')holding=clone(frame);}
    rt.resolution=null;rt.completed=ready;if(rt.clip)safeSample(rt);offer(rt,ready);
  }
  life.on(showcaseSkip,'click',()=>{if(live?.resolution&&live.clip&&!blocked())finishResolution(live);});
  life.on(showcaseAgain,'click',()=>{const rt=live;if(!rt?.resolution||!rt.clip||blocked())return;rt.resolution.elapsed=0;safeSample(rt);message='从收杆定场处，再看一次。';renderUI();});
  life.on(confirm,'click',()=>{const rt=live;if(!rt||blocked()||!rt.ready||rt.entry.node.id!=='craft'||rt.requested)return;void ctx.durable(()=>confirmCraft(ctx.store,{runId:rt.entry.guard.runId,mode:rt.mode,presetAppearanceUsed:false,guard:rt.entry.guard,now:new Date().toISOString()}));});
  life.on(nextNode,'click',()=>{const rt=live;if(!rt||blocked()||!rt.ready||rt.requested||rt.resolution||rt.completed||rt.entry.node.kind==='choice'||rt.entry.node.id==='craft')return;stop(rt,'正在进入下一片段。');submit(rt,{command:{...rt.entry.guard,action:'SKIP_NODE',source:'user'},facts:facts(rt)});});
  life.on(start,'click',()=>ctx.start('full'));
  life.on(soundToggle,'click',()=>{if(ctx.audio?.effectsEnabled()??soundState==='enabled')sound.mute();else void sound.enable();});
  life.on(play,'click',()=>{const rt=live;if(!rt||!canPlay(rt))return;rt.playing=true;message=rt.resolution&&rt.clip?'正在放映这一段的编排动作。':interactive(rt)?'这一段在等你的手。':reduced?'正在播放静态分镜与字幕。':'正在播放当前片段。';updateSound({nodeId:rt.entry.node.id,mode:rt.mode,elapsedMs:rt.elapsed,playing:true});renderUI();rt.clock.start();});
  life.on(pause,'click',()=>{if(live)stop(live,'片段已暂停；继续时从此处接续，连续动作重新计时。');});
  life.on(reset,'click',()=>{if(!blocked()&&state?.project?.story)mount(state.project);});
  life.on(retry,'click',()=>{if(blocked())return;if(mountError&&state?.project?.story)mount(state.project);else live?.stage.retry();});
  life.on(skip,'click',()=>{const rt=live;if(!rt||blocked()||!rt.ready||rt.entry.node.id!=='intro')return;submit(rt,{command:introSkipCommand(rt.entry.guard),facts:facts(rt)});});
  life.on(mode,'change',()=>{const selected=mode.value as 'full'|'guided',rt=live;if(!rt||blocked()||rt.playing||!!rt.resolution||!!rt.completed||!rt.ready)return;
    void ctx.durable(()=>submitScopedSceneCommand(ctx.store,rt.scope,{...rt.entry.guard,action:'SET_MODE',mode:selected},facts(rt)));});
  life.on(finish,'click',()=>{const rt=live;if(rt?.completed)submit(rt,{command:rt.completed.command,facts:{...rt.completed.facts,now:new Date().toISOString()}});});
  const endingButtons=new Map<string,HTMLButtonElement>();
  for(const end of definitionFor(null).endings!){const button=element('button','button secondary',end.choiceLabel);button.type='button';button.id='story-ending-'+end.id;choices.appendChild(button);endingButtons.set(end.id,button);life.on(button,'click',()=>{const rt=live;if(!rt||blocked()||!rt.ready||rt.entry.node.id!=='ending-choice')return;submit(rt,{command:{...rt.entry.guard,action:'CHOOSE_ENDING',ending:end.id},facts:facts(rt)});});}
  for(const [button,approach]of [[call,'call-first'],[split,'split-first']] as const)life.on(button,'click',()=>{
    const rt=live;if(!rt||blocked()||!rt.ready||rt.entry.node.kind!=='choice')return;
    submit(rt,{command:{...rt.entry.guard,action:'CHOOSE',approach},facts:facts(rt)});
  });
  life.on(assist,'click',()=>{
    const rt=live;if(!rt||blocked()||!rt.ready||!interactive(rt)||rt.assistance||rt.resolution||rt.completed||(rt.version>=3&&rt.elapsed<rt.scene.durationMs))return;
    const goal=interactionGoal(rt.entry.node,rt.sample.frame);if(!goal){message='当前几何条件无法演出这段协助动作，请重开片段后重试。';renderUI();return;}
    rt.interaction.reset();rt.assistance={elapsed:0,base:clone(rt.pose),stage:{...rt.light},goal};rt.playing=true;message='与你协作演这一段；完成后节目单会记录本段协助。';updateSound({nodeId:rt.entry.node.id,mode:rt.mode,elapsedMs:rt.elapsed,playing:true});renderUI();rt.clock.start();
  });
  const motionChanged=()=>{reduced=media?.matches??false;if(live){stop(live,'动态偏好已变化，当前片段暂停。');safeSample(live);}renderUI();};
  if(media){if(media.addEventListener)media.addEventListener('change',motionChanged);else media.addListener(motionChanged);}
  return {
    suspendForGuide(){const rt=live,wasPlaying=rt?.playing;if(rt){rt.playing=false;rt.clock.stop();rt.controls?.release();updateSound({nodeId:rt.entry.node.id,mode:rt.mode,elapsedMs:rt.elapsed,playing:false});}return ()=>{if(rt&&current(rt)&&wasPlaying&&!blocked()){rt.playing=true;rt.clock.start();renderUI();}};},
    update(next:StoreState){
      const hadPending=state?.hasPending;state=next;const project=next.project,story=project?.story,nextKey=story?`${project!.projectId}:${story.runId}:${story.revision}:${story.nodeId}`:'';
      if(hadPending&&!next.hasPending&&nextKey===key&&live?.requested){live.requested=false;message='已取消未保存的切幕，保留当前片段；可重新确认或重开。';}
      if(nextKey!==key){key=nextKey;if(project&&story)mount(project);else {holding=null;identity='';clearRuntimes();}}
      if(live&&blocked()&&live.playing)stop(live,'正在处理作品，片段已暂停。');renderUI();
    },
    dispose(){if(disposed)return;disposed=true;soundDisposed=true;unsubscribeSound();if(!ctx.audio)sound.dispose();life.dispose();if(media){if(media.removeEventListener)media.removeEventListener('change',motionChanged);else media.removeListener(motionChanged);}subtitles.dispose();clearRuntimes();holding=null;},
  };
}
