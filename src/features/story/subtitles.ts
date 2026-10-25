import type { StoryNode } from '../../domain/story-types';
import type { CueSeek } from '../../story/cue-seek';
import { append, element, scope } from '../shared/dom';
const names={narrator:'旁白',chenxiang:'沉香',mother:'母亲',guardian:'二郎神'};
export interface SubtitleTransport {
  mode:'full'|'guided'; cues:StoryNode['subtitles']; elapsedMs:number; enabled:boolean; reason?:string;
}
/** Live captions announce cue changes; the separate local directory never steals focus. */
export function mountSubtitles(host:HTMLElement,onSeek?:(request:CueSeek)=>void,currentHost:HTMLElement=host){
  const life=scope(),current=element('div','current-subtitles'),toggle=element('button','button secondary','展开本段完整台词'),transcript=element('div','subtitle-transcript');
  const directory=element('nav','subtitle-directory'),help=element('p','quiet-note');directory.setAttribute('aria-label','当前片段台词定位');
  current.id='story-subtitles';current.setAttribute('aria-live','polite');current.setAttribute('aria-atomic','true');
  transcript.id='story-transcript';transcript.hidden=true;toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',transcript.id);currentHost.appendChild(current);append(host,help,directory,toggle,transcript);
  let signature='',token='',directoryKey='',transport:SubtitleTransport|undefined;
  const buttons:HTMLButtonElement[]=[];
  function fill(target:HTMLElement,cues:StoryNode['subtitles']){while(target.firstChild)target.removeChild(target.firstChild);for(const cue of cues){const line=element('p','',`${names[cue.speaker]}：${cue.text}`);line.setAttribute('data-speaker',cue.speaker);target.appendChild(line);}}
  life.on(toggle,'click',()=>{transcript.hidden=!transcript.hidden;toggle.setAttribute('aria-expanded',String(!transcript.hidden));toggle.textContent=transcript.hidden?'展开本段完整台词':'收起本段完整台词';});
  // One delegated handler is owned by this mount, even when switching fragments many times.
  life.on(directory,'click',event=>{let target=event.target as HTMLElement|null;while(target&&target!==directory&&target.tagName!=='BUTTON')target=target.parentElement;
    if(!target||!directory.contains(target)||(target as HTMLButtonElement).disabled||!transport?.enabled)return;
    onSeek?.({nodeToken:token,mode:transport.mode,cueIndex:Number(target.dataset.cueIndex)});
  });
  return {update(cues:StoryNode['subtitles'],all:StoryNode['subtitles'],nodeToken:string,nextTransport?:SubtitleTransport){
    const fallback=nextTransport?.cues.filter(cue=>cue.startMs<=nextTransport.elapsedMs).slice(-1)??[];
    const visible=cues.length?cues:fallback.length?fallback:(nextTransport?.cues.slice(0,1)??[]);
    const next=JSON.stringify(visible);if(next!==signature){signature=next;fill(current,visible);if(!visible.length)current.appendChild(element('p','subtitle-silence','静看这一幕，下一句正在路上。'));}if(nodeToken!==token){token=nodeToken;fill(transcript,all);}
    transport=nextTransport;directory.hidden=help.hidden=!onSeek||!transport;
    if(!onSeek||!transport)return;
    help.textContent=transport.enabled?`点击台词，定位当前片段。${transport.mode==='guided'?'以下为导览节选；完整原文可展开阅读。':'不会跳过操偶任务或改变剧情选择。'}`:transport.reason??'当前片段准备或保存期间，台词定位暂不可用。';
    const key=JSON.stringify([nodeToken,transport.mode,transport.cues]);
    if(key!==directoryKey){directoryKey=key;while(directory.firstChild)directory.removeChild(directory.firstChild);buttons.length=0;
      transport.cues.forEach((cue,index)=>{const button=element('button','subtitle-cue',`${names[cue.speaker]}：${cue.text}`);button.type='button';button.dataset.cueIndex=String(index);button.setAttribute('aria-label',`定位到第${index+1}句，${names[cue.speaker]}：${cue.text}`);directory.appendChild(button);buttons.push(button);});
    }
    buttons.forEach((button,index)=>{button.disabled=!transport!.enabled;const cue=transport!.cues[index]!,active=transport!.elapsedMs>=cue.startMs&&transport!.elapsedMs<cue.endMs;button.classList.toggle('is-current',active);if(active)button.setAttribute('aria-current','true');else button.removeAttribute('aria-current');});
  },dispose(){life.dispose();}};
}
