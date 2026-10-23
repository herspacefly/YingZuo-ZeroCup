import './style.css';
import { ProjectStore } from '../../app/store';
import type { StoreState,SaveResult } from '../../app/store';
import { newIdentifier } from '../../app/identity';
import { startStory,submitStoryCommand } from '../../app/story-commands';
import { definitionFor } from '../../content/reunion';
import { reunionSummary,storyEntry,storyGuard } from '../../domain/story';
import type { StoryCommand,StoryNode,StoryPayload } from '../../domain/story-types';
import { ProjectStorage } from '../../persistence/storage';
import { downloadJSON,exportProjectJSON } from '../../persistence/project-file';

const el=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const button=(id:string,disabled:boolean)=>{el<HTMLButtonElement>(id).disabled=disabled;};
const status=el('story-status'),operation=el('story-operation'),mode=el<HTMLSelectElement>('story-mode');
status.dataset.entry=import.meta.env.LEGACY?'legacy':'modern';
let store:ProjectStore|null=null,disposed=false,paused=true,elapsed=0,lastTime=0,generation=0,key='',node:StoryNode|null=null;
let clock:ReturnType<typeof setTimeout>|undefined,downloadCleanup=()=>undefined as void;
const endingButtons=definitionFor(null).endings!.map(end=>{const b=document.createElement('button');b.textContent=end.choiceLabel;b.id='text-ending-'+end.id;b.hidden=true;el('story-choose-split').parentElement!.appendChild(b);return {b,end};});
const cleanups:(()=>void)[]=[];
function on(target:EventTarget,event:string,listener:EventListener){target.addEventListener(event,listener);cleanups.push(()=>target.removeEventListener(event,listener));}
function stopClock(){clearTimeout(clock);clock=undefined;paused=true;}
function pause(){stopClock();if(store)render(store.getState());}
function render(state:StoreState) {
  if(disposed)return;
  const project=state.project,story=project?.story;
  const nextKey=project?`${project.projectId}/${story?.runId??'none'}/${story?.revision??0}/${story?.nodeId??'none'}`:'';
  if(nextKey!==key){
    stopClock();elapsed=0;generation++;key=nextKey;
    node=project&&story?storyEntry(project,definitionFor(project.story),generation).node:null;
  }
  status.dataset.state=state.status;status.textContent=state.message;
  const protectedState=!project || ['conflict','unsupported','recovery','loading','closed'].includes(state.status);
  const blocked=protectedState||state.hasPending||state.status==='saving';
  mode.disabled=blocked||!paused||!!node&&!node.allowedActions.includes('SET_MODE');if(story)mode.value=story.mode;
  button('story-start',blocked||!!story);button('story-play',blocked||!node||!paused||(node.kind==='terminal'||(node.kind==='choice'&&story?.definitionVersion!==3))||node.id==='craft');button('story-pause',paused||blocked);
  button('story-skip',blocked||node?.id!=='intro');
  el('story-node').dataset.node=node?.id??'none';el('node-act').textContent=node?`${node.act?`第${node.act}幕`:'序与制偶'} · ${node.id}`:'尚未开演';
  el('node-title').textContent=node?.title??'为这一场留一个起点。';el('node-lead').textContent=node?.lead??'开始后，进度将通过正式事务存档保存。刷新从当前短节点起点暂停接续。';
  el('node-clock').textContent=`${paused?'暂停':'播放中'} · ${(elapsed/1000).toFixed(1)} 秒（仅当前短节点）`;
  const subtitles=el('node-subtitles');subtitles.textContent='';
  for(const cue of node?.subtitles??[]){const p=document.createElement('p');p.textContent=`${{narrator:'旁白',chenxiang:'沉香',mother:'母亲',guardian:'二郎神'}[cue.speaker]}：${cue.text}`;subtitles.appendChild(p);}
  el('cast-summary').textContent=story?.castSnapshot?`本场冻结：${story.castSnapshot.appearance.patternId} / ${story.castSnapshot.appearance.paletteId}；已记录协助 ${story.assistedNodeIds.length} 段。`:'开演确认前，尚未冻结本场造型。';
  for(const id of ['story-craft','story-preset','story-assist','story-choose-call','story-choose-split','story-complete']){el(id).hidden=true;button(id,true);}
  const timing=story?.mode==='guided'?node?.guidedTiming:node?.fullTiming,waiting=story?.definitionVersion===3&&elapsed<(timing?.minDurationMs??0);
  const endings=definitionFor(story).endings;
  for(const {b,end} of endingButtons){const label=endings?.find(item=>item.id===end.id)?.choiceLabel;if(label&&b.textContent!==label)b.textContent=label;b.hidden=node?.id!=='ending-choice';b.disabled=blocked||!!waiting;}
  if(node){
    if(node.id==='craft')for(const id of ['story-craft','story-preset']){el(id).hidden=false;button(id,blocked||!!waiting);}
    else if(node.kind==='interaction'){el('story-assist').hidden=false;button('story-assist',blocked||paused||!!waiting);}
    else if(node.id==='approach-choice')for(const id of ['story-choose-call','story-choose-split']){el(id).hidden=false;button(id,blocked||!!waiting);}
    else if(node.kind==='cinematic'||node.kind==='curtain'){
      el('story-complete').hidden=false;
      const timing=story?.mode==='guided'?node.guidedTiming:node.fullTiming;
      button('story-complete',blocked||paused||elapsed<timing.minDurationMs);
      el('story-complete').textContent=node.id==='reunion-hold'&&story?.definitionVersion===1?'谢幕':node.id.endsWith('-hold')?'读终章后记':node.id==='curtain'?'文字协助完成谢幕':'确认片段结束';
    }
  }
  const result=project?reunionSummary(project):null;
  el('result-summary').textContent=result?`同一份演出成果：${result.id}；完成时间 ${result.completedAt}；路线 ${result.approach==='call-first'?'先举灯呼唤':'先挥斧开山'}。${story?.nodeId==='curtain'?'终章已保存，谢幕尚未结束。':'本场已谢幕。'}`:'';
  button('story-export',!store?.getExportProject());button('story-retry',state.status==='saving'||(!state.hasPending&&!['error','memory','unsaved'].includes(state.status)));
  button('story-cancel',state.status==='saving'||!state.hasPending);button('story-memory',state.status==='saving'||state.pendingKind!=='save');button('story-new',blocked);
}
async function run(job:()=>Promise<unknown>){
  try{const result=await job();if(disposed)return;if(result&&typeof result==='object'&&'ok'in result&&!(result as SaveResult).ok)operation.textContent=(result as SaveResult&{ok:false}).error.message;else operation.textContent='';}
  catch(error){if(!disposed)operation.textContent=`操作未完成：${error instanceof Error?error.message:String(error)}`;}
}
function play(){
  if(!store||!node)return;paused=false;lastTime=performance.now();render(store.getState());
  const tick=()=>{
    if(disposed||paused)return;
    const now=performance.now(),gap=now-lastTime;lastTime=now;
    if(gap>250){pause();operation.textContent='页面发生较长停顿，已暂停这一小段，请明确继续。';return;}
    elapsed+=Math.max(gap,0);render(store!.getState());clock=setTimeout(tick,100);
  };
  clock=setTimeout(tick,100);
}
function send(payload:StoryPayload){
  const story=store?.getState().project?.story;if(!story)return;
  const context={paused,elapsedMs:elapsed,now:new Date().toISOString()};
  const command:StoryCommand={...storyGuard(story),...payload};
  stopClock();void run(()=>submitStoryCommand(store!,command,context));
}
async function mount(){
  try {
    const writerId=newIdentifier('writer');let factory:IDBFactory|undefined;try{factory=window.indexedDB;}catch{factory=undefined;}
    const storage=new ProjectStorage(factory,{writerId,now:()=>new Date().toISOString()});
    const opened=await ProjectStore.open(storage,{writerId,createId:()=>newIdentifier('project'),now:()=>new Date().toISOString()});
    if(disposed){opened.dispose();return;}store=opened;cleanups.push(store.subscribe(render));
    on(el('story-start'),'click',()=>{const runId=newIdentifier('run');void run(()=>startStory(store!,runId,mode.value as 'full'|'guided'));});
    on(el('story-play'),'click',play);on(el('story-pause'),'click',pause);
    on(el('story-skip'),'click',()=>send({action:'COMPLETE_SCENE',source:'user',skipped:true}));
    on(el('story-craft'),'click',()=>send({action:'COMPLETE_INTERACTION',source:'user',evidence:{kind:'craft',presetAppearanceUsed:false}}));
    on(el('story-preset'),'click',()=>send({action:'COMPLETE_INTERACTION',source:'user',evidence:{kind:'craft',presetAppearanceUsed:true}}));
    on(el('story-assist'),'click',()=>send({action:'COMPLETE_INTERACTION',source:'assistance'}));
    on(el('story-choose-call'),'click',()=>send({action:'CHOOSE',approach:'call-first'}));
    on(el('story-choose-split'),'click',()=>send({action:'CHOOSE',approach:'split-first'}));
    for(const {b,end} of endingButtons)on(b,'click',()=>send({action:'CHOOSE_ENDING',ending:end.id}));
    on(el('story-complete'),'click',()=>send({action:'COMPLETE_SCENE',source:node?.completion.kind==='scene'&&node.completion.activation==='user'?'user':node?.id==='curtain'?'assistance':'script'}));
    on(mode,'change',()=>{if(store?.getState().project?.story)send({action:'SET_MODE',mode:mode.value as 'full'|'guided'});});
    on(el('story-retry'),'click',()=>{void run(()=>store!.retryPending());});
    on(el('story-cancel'),'click',()=>{void run(()=>store!.cancelPending());});
    on(el('story-memory'),'click',()=>{void run(()=>store!.continuePendingUnsaved());});
    on(el('story-new'),'click',()=>{pause();void run(()=>store!.newProject(undefined,el<HTMLInputElement>('archive-ack').checked));});
    on(el('story-export'),'click',()=>{try{downloadCleanup();downloadCleanup=downloadJSON(exportProjectJSON(store!.getExportProject()!),'yingzuo-story-project.json');operation.textContent='已向浏览器发起项目下载请求，请检查下载结果。';}catch(error){operation.textContent=`导出失败：${error instanceof Error?error.message:String(error)}`;}});
    on(document,'visibilitychange',()=>{if(document.hidden)pause();});on(window,'blur',pause);
  } catch(error){status.dataset.state='error';status.textContent=`无法初始化文字排演：${error instanceof Error?error.message:String(error)}`;}
}
function dispose(){disposed=true;stopClock();downloadCleanup();cleanups.splice(0).forEach(cleanup=>cleanup());store?.dispose();}
const onShow=(event:PageTransitionEvent)=>{if(event.persisted)window.location.reload();};
window.addEventListener('pagehide',dispose);window.addEventListener('pageshow',onShow);
if(import.meta.hot)import.meta.hot.dispose(()=>{dispose();window.removeEventListener('pagehide',dispose);window.removeEventListener('pageshow',onShow);});
void mount();
