import type { StageAudioSession } from '../../audio/stage-session';
import { append,element,scope,removeNode } from './dom';

/** One visible transport, one document-level preference; no browser voice dependency. */
export function mountVoiceControls(host:HTMLElement,audio:StageAudioSession|undefined,id:string){
  const life=scope(),panel=element('div','stage-sound-controls'),button=element('button','button secondary'),status=element('p','quiet-note');
  button.id=`${id}-voice-toggle`;button.type='button';status.id=`${id}-voice-status`;status.setAttribute('role','status');button.setAttribute('aria-describedby',status.id);
  append(panel,button,status);host.appendChild(panel);
  const unsubscribe=audio?.voice.subscribe(value=>{
    const retry=['blocked','error'].includes(value.state);
    button.textContent=retry?'重试中文配音':audio.voiceEnabled()?'关闭中文配音':'开启中文配音';
    button.setAttribute('aria-pressed',String(audio.voiceEnabled()));button.disabled=['unavailable','disposed'].includes(value.state);
    status.textContent=retry||value.state==='unavailable'?value.message:'';status.dataset.state=value.state;status.dataset.playing=String(value.playing);
  })??(()=>{});
  if(!audio){button.disabled=true;button.textContent='中文配音不可用';}
  life.on(button,'click',()=>{audio?.toggleVoice();audio?.unlock();});
  return {element:panel,setVisible(value:boolean){panel.hidden=!value;},dispose(){life.dispose();unsubscribe();removeNode(panel);}};
}
