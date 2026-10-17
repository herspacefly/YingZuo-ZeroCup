import { createAnimationClock } from '../../app/animation-clock';
import { submitScopedSceneCommand } from '../../app/story-scene-commands';
import type { SceneObservation } from '../../app/story-scene-commands';
import type { PageContext } from '../../app/view';
import type { StoreState } from '../../app/store';
import { reunionDefinition } from '../../content/reunion';
import { subtitlesForMode } from '../../content/story-contract';
import { storyEntry } from '../../domain/story';
import type { ProjectV1 } from '../../domain/types';
import { createSceneDirector } from '../../story/director';
import { createNodeScope } from '../../story/node-scope';
import { introSkipCommand } from '../intro/events';
import { canvasStage } from '../shared/canvas-stage';
import { append, clear, element, link, scope } from '../shared/dom';
import { mountSubtitles } from './subtitles';

type Director=ReturnType<typeof createSceneDirector>;
type Runtime={entry:ReturnType<typeof storyEntry>;scene:Director;scope:ReturnType<typeof createNodeScope>;
  stage:ReturnType<typeof canvasStage>;clock:ReturnType<typeof createAnimationClock>;shade:HTMLDivElement;
  sample:ReturnType<Director['sample']>;elapsed:number;playing:boolean;ready:boolean;requested:boolean;mode:'full'|'guided'};
let generation=0;
const errorText=(error:unknown)=>error instanceof Error?error.message:String(error);

export function mountStoryController(stageSlot:HTMLElement,panel:HTMLElement,ctx:PageContext){
  const life=scope(),title=element('h2'),lead=element('p'),runtime=element('p','story-runtime'),shot=element('p','eyebrow'),cueHost=element('div','subtitles');
  runtime.id='story-runtime';runtime.setAttribute('role','status');shot.id='story-shot';
  const subtitles=mountSubtitles(cueHost),start=element('button','button primary','确认开始这一场'),skip=element('button','button secondary','先为他备好行装');
  const play=element('button','button primary','继续片段'),pause=element('button','button secondary','暂停'),reset=element('button','button secondary','重开片段（暂停）');
  const retry=element('button','button secondary','重试当前片段'),finish=element('button','button primary','确认进入下一段');
  const mode=element('select'),modeLabel=element('label','','演出节奏（暂停时可切换）'),transport=element('div','story-transport');
  for(const [value,label]of [['full','完整演出'],['guided','三分钟导览']]){const option=element('option','',label);option.value=value!;mode.appendChild(option);}
  const craft=link('去备行装 →','#/craft'),note=element('p','pending-note');
  for(const [node,id]of [[start,'start'],[skip,'skip'],[play,'play'],[pause,'pause'],[reset,'reset'],[retry,'retry'],[finish,'finish'],[mode,'mode']] as const)node.id=`story-${id}`;
  modeLabel.appendChild(mode);append(transport,play,pause,reset);append(panel,runtime,title,lead,shot,cueHost,start,skip,craft,modeLabel,transport,finish,retry,note,link('先去展馆走走 →','#/museum'));
  let live:Runtime|null=null,display:Runtime|null=null,state:StoreState|null=null,key='',disposed=false,mountError='';
  let message='已恢复，暂停接续。';
  const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  let reduced=media?.matches??false;
  function blocked(){return disposed||!state?.project||state.hasPending||ctx.isBusy()||['loading','closed','conflict','recovery','unsupported'].includes(state.status);}
  function current(rt:Runtime){return !disposed&&rt===live&&rt.scope.isCurrent(rt.entry.token);}
  function canPlay(rt:Runtime){return current(rt)&&!blocked()&&rt.ready&&['cinematic','curtain'].includes(rt.entry.node.kind)&&!rt.sample.ended;}
  function stop(rt:Runtime,text?:string){rt.playing=false;rt.clock.stop();if(text)message=text;renderUI();}
  function closeScope(rt:Runtime){rt.playing=false;try{rt.scope.dispose();}catch(error){ctx.notify(`片段已退出，清理报告失败：${errorText(error)}`);}}
  function clearRuntimes(){
    if(live){closeScope(live);if(live!==display)live.stage.dispose();}
    display?.stage.dispose();live=display=null;clear(stageSlot);
  }
  function show(rt:Runtime){
    if(!current(rt))return;
    rt.ready=true;
    if(display!==rt){display?.stage.dispose();clear(stageSlot);stageSlot.appendChild(rt.stage.figure);display=rt;rt.stage.resize();}
    message='已恢复，暂停接续。';renderDisplayed();renderUI();
  }
  function renderDisplayed(){
    if(!display)return;
    const rt=display;title.textContent=rt.entry.node.title;lead.textContent=rt.entry.node.lead;shot.textContent=rt.sample.shotLabel;
    rt.shade.style.opacity=String(1-rt.sample.lightLevel);
    subtitles.update(rt.sample.cues,subtitlesForMode(rt.entry.node,rt.mode),rt.entry.token);
  }
  function observation(rt:Runtime,paused=!rt.playing):SceneObservation{return {token:rt.entry.token,paused,elapsedMs:rt.elapsed,now:new Date().toISOString()};}
  function complete(rt:Runtime,observed:SceneObservation){
    if(!current(rt)||blocked()||rt.requested||!rt.sample.ended||!rt.sample.automatic)return;
    rt.requested=true;stop(rt,'片段已播完，正在保存检查点…');
    void ctx.durable(()=>submitScopedSceneCommand(ctx.store,rt.scope,{...rt.entry.guard,action:'COMPLETE_SCENE',source:'script'},observed),
      rt.entry.node.id==='intro'?{path:'/craft',exhibitId:null}:undefined);
  }
  function sample(rt:Runtime){
    rt.sample=rt.scene.sample(rt.elapsed,undefined,reduced);rt.elapsed=rt.sample.elapsedMs;
    rt.stage.update(rt.sample.frame);if(display===rt)renderDisplayed();
  }
  function mount(project:ProjectV1){
    if(live){closeScope(live);if(live!==display)live.stage.dispose();}
    live=null;mountError='';
    try{
      const entry=storyEntry(project,reunionDefinition,++generation),scene=createSceneDirector(project,entry),initialSample=scene.sample(0,undefined,reduced);
      const stage=canvasStage('当前短节点 · 角色使用本场冻结造型，切幕前先准备资源。'),nodeScope=createNodeScope(entry.token,error=>ctx.notify(`片段清理失败：${errorText(error)}`));
      const shade=element('div','story-scene-shade');shade.setAttribute('aria-hidden','true');stage.screen.appendChild(shade);
      const rt:Runtime={entry,scene,scope:nodeScope,stage,shade,sample:initialSample,elapsed:0,playing:false,ready:false,requested:false,mode:project.story!.mode,clock:null!};
      rt.clock=createAnimationClock({request:callback=>window.requestAnimationFrame(callback),cancel:id=>window.cancelAnimationFrame(id),now:()=>performance.now()},delta=>{
        if(!current(rt)||blocked()||!rt.ready){stop(rt,'当前操作已暂停。');return false;}
        rt.elapsed+=delta;sample(rt);
        if(rt.sample.ended){
          // The running observation must be captured before stop/durable pauses the UI.
          const observed=observation(rt,false);stop(rt,rt.sample.automatic?'片段已播完。':'片段已播完，等待下一步操作。');
          if(rt.sample.automatic){
            if(['memory','error'].includes(ctx.store.getState().status))message='片段已播完；确认进入下一段时，将尝试保存检查点。';
            else complete(rt,observed);
          }
          renderUI();return false;
        }
        renderUI();return true;
      },fault=>stop(rt,fault.reason==='gap'?'页面停顿较久，已暂停；继续时不补算这段时间。':`片段已停止：${errorText(fault.error)}`));
      live=rt;message='已恢复，暂停接续。';
      nodeScope.own(()=>rt.clock.dispose());
      nodeScope.listen(window,'blur',()=>{if(rt.playing)stop(rt,'已切换窗口，片段暂停。');});
      nodeScope.listen(document,'visibilitychange',()=>{if(document.hidden&&rt.playing)stop(rt,'页面已隐藏，片段暂停。');});
      nodeScope.own(stage.subscribe(status=>{
        if(!current(rt))return;
        if(status.state==='ready'){if(!rt.ready)show(rt);}
        else {rt.ready=false;if(rt.playing)stop(rt);message=status.state==='error'?`当前片段准备失败：${status.message}`:display&&display!==rt?'正在准备下一段，保留上一幕画面与台词。':'正在准备当前片段…';}
        renderUI();
      }));
      if(!display){display=rt;stageSlot.appendChild(stage.figure);renderDisplayed();}
      sample(rt);
    }catch(error){mountError=errorText(error);message=`片段未能准备：${mountError}`;ctx.notify(message);renderUI();}
  }
  function renderUI(){
    if(disposed)return;
    const rt=live,node=rt?.entry.node,hasStory=!!state?.project?.story,waiting=!!rt&&!rt.ready;
    start.hidden=hasStory;start.disabled=blocked();skip.hidden=node?.id!=='intro';skip.disabled=blocked()||!rt?.ready;
    craft.hidden=node?.id!=='craft'||display!==rt;modeLabel.hidden=!rt;transport.hidden=!rt;
    play.disabled=!rt||!canPlay(rt)||rt.playing;pause.disabled=!rt?.playing;reset.disabled=!rt||blocked();
    play.textContent=node?.id==='intro'&&rt?.elapsed===0?'点亮幕灯，开始序幕':'继续片段';
    mode.disabled=!rt||blocked()||rt.playing||!rt.ready;if(rt)mode.value=rt.mode;
    retry.hidden=!mountError&&rt?.stage.getStatus().state!=='error';retry.disabled=blocked();
    finish.hidden=!rt||!rt.sample.automatic||!rt.sample.ended||rt.requested;finish.disabled=blocked()||!rt?.ready;
    const phase=mountError||rt?.stage.getStatus().state==='error'?'error':blocked()?'saving':waiting?'loading':rt?.playing?'playing':'paused';
    runtime.setAttribute('data-state',phase);runtime.setAttribute('data-elapsed',String(Math.round(rt?.elapsed??0)));
    runtime.setAttribute('data-node',node?.id??'');runtime.setAttribute('data-token',rt?.entry.token??'');runtime.setAttribute('data-reduced-motion',String(reduced));
    runtime.textContent=state?.hasPending?'检查点尚未保存；画面保留在当前段。请在作品工具中重试、取消或选择仅在本页继续。':message;
    note.textContent=!rt?'确认开演后，才会为本场留下独立的演出身份；直接打开页面不会替你开始。':
      node?.kind==='interaction'||node?.kind==='choice'?`当前停在本段开头的静止画面。${node.id==='craft'?'从“去备行装”继续制作并确认本场造型。':'剧情操偶与路线操作仍在接入。'}`:
      `尚未播放时是本段开头的静止画面；继续片段后，字幕与场面一起走。${reduced?'已启用减少动态，使用静态分镜。':''}当前为静音演出。`;
    if(!hasStory){title.textContent='还没有开始这一场';lead.textContent=note.textContent;shot.textContent='';subtitles.update([],[],'empty');}
  }
  life.on(start,'click',()=>ctx.start('full'));
  life.on(play,'click',()=>{const rt=live;if(!rt||!canPlay(rt))return;rt.playing=true;message=reduced?'正在播放静态分镜与字幕。':'正在播放当前片段。';renderUI();rt.clock.start();});
  life.on(pause,'click',()=>{if(live)stop(live,'片段已暂停；继续时从此处接续。');});
  life.on(reset,'click',()=>{if(!blocked()&&state?.project?.story)mount(state.project);});
  life.on(retry,'click',()=>{if(blocked())return;if(mountError&&state?.project?.story)mount(state.project);else live?.stage.retry();});
  life.on(skip,'click',()=>{
    const rt=live;if(!rt||blocked()||!rt.ready||rt.entry.node.id!=='intro')return;stop(rt,'正在保存序幕检查点…');
    void ctx.durable(()=>submitScopedSceneCommand(ctx.store,rt.scope,introSkipCommand(rt.entry.guard),observation(rt,true)),{path:'/craft',exhibitId:null});
  });
  life.on(mode,'change',()=>{
    const selected=mode.value as 'full'|'guided',rt=live;if(!rt||blocked()||rt.playing||!rt.ready)return;
    void ctx.durable(()=>submitScopedSceneCommand(ctx.store,rt.scope,{...rt.entry.guard,action:'SET_MODE',mode:selected},observation(rt,true)));
  });
  life.on(finish,'click',()=>{if(live)complete(live,observation(live,false));});
  const motionChanged=()=>{reduced=media?.matches??false;if(live){stop(live,'动态偏好已变化，当前片段暂停。');sample(live);}renderUI();};
  if(media){if(media.addEventListener)media.addEventListener('change',motionChanged);else media.addListener(motionChanged);}
  return {
    update(next:StoreState){
      const hadPending=state?.hasPending;state=next;const project=next.project,story=project?.story,nextKey=story?`${project!.projectId}:${story.runId}:${story.revision}:${story.nodeId}`:'';
      if(hadPending&&!next.hasPending&&nextKey===key&&live?.requested){live.requested=false;message='已取消未保存的切幕，保留片段末尾；可重新确认进入下一段。';}
      if(nextKey!==key){key=nextKey;if(project&&story)mount(project);else clearRuntimes();}
      if(live&&blocked()&&live.playing)stop(live,'正在处理作品，片段已暂停。');renderUI();
    },
    dispose(){if(disposed)return;disposed=true;life.dispose();if(media){if(media.removeEventListener)media.removeEventListener('change',motionChanged);else media.removeListener(motionChanged);}subtitles.dispose();clearRuntimes();},
  };
}
