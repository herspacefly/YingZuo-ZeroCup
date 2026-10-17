import type { StoryNode } from '../../domain/story-types';
import { append, element, scope } from '../shared/dom';
const names={narrator:'旁白',chenxiang:'沉香',mother:'母亲',guardian:'二郎神'};
/** Update text only when a cue changes; frame ticks must not repeatedly announce the same line. */
export function mountSubtitles(host:HTMLElement){
  const life=scope(),current=element('div','current-subtitles'),toggle=element('button','button secondary','展开本段完整台词'),transcript=element('div','subtitle-transcript');
  current.id='story-subtitles';current.setAttribute('aria-live','polite');current.setAttribute('aria-atomic','true');
  transcript.id='story-transcript';transcript.hidden=true;toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',transcript.id);append(host,current,toggle,transcript);
  let signature='',token='';
  function fill(target:HTMLElement,cues:StoryNode['subtitles']){while(target.firstChild)target.removeChild(target.firstChild);for(const cue of cues){const line=element('p','',`${names[cue.speaker]}：${cue.text}`);line.setAttribute('data-speaker',cue.speaker);target.appendChild(line);}}
  life.on(toggle,'click',()=>{transcript.hidden=!transcript.hidden;toggle.setAttribute('aria-expanded',String(!transcript.hidden));toggle.textContent=transcript.hidden?'展开本段完整台词':'收起本段完整台词';});
  return {update(cues:StoryNode['subtitles'],all:StoryNode['subtitles'],nodeToken:string){const next=JSON.stringify(cues);if(next!==signature){signature=next;fill(current,cues);}if(nodeToken!==token){token=nodeToken;fill(transcript,all);}},
    dispose(){life.dispose();}};
}
