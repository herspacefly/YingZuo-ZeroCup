import { createAnimationClock } from '../../app/animation-clock';
import type { ProjectV1 } from '../../domain/types';
import { createReunionReplay } from '../../story/replay';
import { canvasStage } from '../shared/canvas-stage';
import { append,element,scope } from '../shared/dom';
import { mountSubtitles } from '../story/subtitles';

/** Read-only player. It owns one clock and has no Store or story-command reference. */
export function mountReunionReplay(host:HTMLElement,project:ProjectV1){
  const life=scope(),replay=createReunionReplay(project),root=element('section','result-replay');root.id='result-replay-player';
  const title=element('h2','','按本场编排再演'),intro=element('p','quiet-note','沿用这场冻结的影偶与已选路线，操作片段由程序演出。这里不复刻当时的鼠标轨迹，原场的进度与完成时间保持不变。');
  const stage=canvasStage('本场编排重演 · 程序动作与原创皮影风格设计稿。'),panel=element('div','control-panel'),layout=element('div','workspace');
  const chooseLabel=element('label','','重演片段'),choose=element('select');choose.id='replay-segment';chooseLabel.appendChild(choose);
  replay.segments.forEach((item,index)=>{const option=element('option','',`${String(index+1).padStart(2,'0')} · ${item.title}`);option.value=String(index);choose.appendChild(option);});
  const status=element('p','selection-summary');status.id='replay-status';status.setAttribute('role','status');
  const shot=element('p','eyebrow'),cueHost=element('div'),subtitles=mountSubtitles(cueHost),transport=element('div','transport');
  const play=element('button','button primary','播放编排'),pause=element('button','button secondary','暂停重演'),reset=element('button','button secondary','从头重演（暂停）');
  const previous=element('button','button secondary','上一片段'),next=element('button','button secondary','下一片段'),step=element('button','button secondary','前进 250 毫秒');
  for(const [button,id]of [[play,'play'],[pause,'pause'],[reset,'reset'],[previous,'previous'],[next,'next'],[step,'step']] as const){button.type='button';button.id=`replay-${id}`;transport.appendChild(button);}
  const motionNote=element('p','quiet-note');append(panel,chooseLabel,status,shot,cueHost,transport,motionNote);append(layout,stage.figure,panel);append(root,title,intro,layout);host.appendChild(root);
  let disposed=false,index=0,elapsed=0,playing=false,blocked=false,ready=false,message='已就绪后可播放；默认暂停。';
  const media=window.matchMedia?.('(prefers-reduced-motion: reduce)');let reduced=media?.matches??false;
  const clock=createAnimationClock({request:cb=>requestAnimationFrame(cb),cancel:id=>cancelAnimationFrame(id),now:()=>performance.now()},delta=>{
    if(disposed||blocked||!ready||!playing)return false;advance(delta);return playing;
  },fault=>{stop(fault.reason==='gap'?'页面停顿较久，已暂停重演。':`重演暂停：${fault.error instanceof Error?fault.error.message:String(fault.error)}`);});
  function controls(){
    if(disposed)return;const end=index===replay.segments.length-1&&elapsed>=replay.segments[index]!.durationMs;
    play.disabled=blocked||!ready||playing||end||reduced;pause.disabled=!playing;
    previous.disabled=blocked||index===0;next.disabled=blocked||index===replay.segments.length-1;choose.disabled=blocked;
    reset.disabled=blocked;step.hidden=!reduced;step.disabled=blocked||!ready||end;
    motionNote.textContent=reduced?'已启用减少动态：使用“前进 250 毫秒”逐步看静止分镜，也可切换片段。':'可随时暂停或切换片段；离开本页会停止重演。';
    status.textContent=`片段 ${index+1}/${replay.segments.length} · ${(elapsed/1000).toFixed(1)} 秒 · ${playing?'播放中':'已暂停'}。${message}`;
  }
  function stop(text?:string){playing=false;clock.stop();if(text)message=text;controls();}
  function draw(){
    if(disposed)return;
    try{const sample=replay.sample(index,elapsed,reduced);stage.update(sample.frame);shot.textContent=sample.shotLabel;stage.screen.style.opacity=String(sample.lightLevel);subtitles.update(sample.cues,sample.allCues,String(index));controls();}
    catch(error){stop(`无法显示这段编排：${error instanceof Error?error.message:String(error)}`);}
  }
  function select(value:number){stop('切换片段，暂停查看。');index=value;elapsed=0;choose.value=String(index);draw();}
  function advance(delta:number){
    elapsed=Math.min(elapsed+delta,replay.segments[index]!.durationMs);
    if(elapsed>=replay.segments[index]!.durationMs){
      if(index<replay.segments.length-1){index++;elapsed=0;choose.value=String(index);message='按已选路线接续下一段。';}
      else stop('本场编排已重演完；原场记录保持不变。');
    }
    draw();
  }
  const unsubscribe=stage.subscribe(status=>{
    ready=status.state==='ready';
    if(!ready)stop(status.state==='error'?'幕面准备失败，可用“重试幕面”重新载入。':'正在准备下一段幕面，请就绪后继续播放。');
    else{if(message==='正在准备下一段幕面，请就绪后继续播放。'||message==='幕面准备失败，可用“重试幕面”重新载入。')message='幕面已就绪，暂停查看。';controls();}
  });
  life.on(play,'click',()=>{if(play.disabled||disposed)return;playing=true;message='';clock.start();controls();});
  life.on(pause,'click',()=>stop('由你暂停。'));
  life.on(reset,'click',()=>select(0));life.on(previous,'click',()=>{if(index>0&&!blocked)select(index-1);});life.on(next,'click',()=>{if(index<replay.segments.length-1&&!blocked)select(index+1);});
  life.on(choose,'change',()=>{const value=Number(choose.value);if(!blocked&&Number.isInteger(value)&&value>=0&&value<replay.segments.length)select(value);});
  life.on(step,'click',()=>{if(!step.disabled&&!disposed){message='逐步查看。';advance(250);}});
  life.on(window,'blur',()=>stop('窗口失去焦点，已暂停重演。'));life.on(document,'visibilitychange',()=>{if(document.hidden)stop('页面已隐藏，重演暂停。');});
  const motion=()=>{reduced=media?.matches??false;stop('动态偏好改变，暂停查看。');draw();};
  if(media?.addEventListener)media.addEventListener('change',motion);else media?.addListener?.(motion);
  draw();
  return {setBlocked(value:boolean){blocked=value;if(value)stop('请先处理当前作品操作。');else controls();},dispose(){if(disposed)return;disposed=true;clock.dispose();unsubscribe();life.dispose();subtitles.dispose();if(media?.removeEventListener)media.removeEventListener('change',motion);else media?.removeListener?.(motion);stage.dispose();if(root.parentNode)root.parentNode.removeChild(root);}};
}
