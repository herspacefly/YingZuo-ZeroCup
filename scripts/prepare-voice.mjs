import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { presentChoiceDialogue } from '../src/content/choice-dialogue.ts';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const sha=s=>crypto.createHash('sha256').update(s).digest('hex');
const definition=read('src/content/stories/reunion-v5.json');
const voices={narrator:{voice:'zh-CN-YunyangNeural',rate:'-8%',pitch:'+0Hz'},chenxiang:{voice:'zh-CN-YunxiaNeural',rate:'-5%',pitch:'+0Hz'},mother:{voice:'zh-CN-XiaoxiaoNeural',rate:'-8%',pitch:'+0Hz'},guardian:{voice:'zh-CN-YunjianNeural',rate:'-5%',pitch:'+0Hz'}};
const variants=node=>['mountain-listen','ending-choice'].includes(node.id)?['home','open-road'].flatMap(journeyIntent=>['shared','self'].flatMap(mountainPact=>['call-first','split-first'].map(approach=>presentChoiceDialogue(node,{definitionVersion:5,choices:{journeyIntent,mountainPact,finalAction:null},approach})))):[node];
const lines=new Map();
function identity(cue){return sha(JSON.stringify([cue.speaker,cue.text,voices[cue.speaker]])).slice(0,24);}
for(const node of definition.nodes)for(const variant of variants(node))for(const cue of [...variant.subtitles,...(variant.guidedSubtitles??[])]){
 const id=identity(cue);lines.set(id,{id,speaker:cue.speaker,text:cue.text,...voices[cue.speaker],src:`/audio/voice-v5/${id}.mp3`});
}
// Put one real line from each cast member first, so --samples validates all four.
const ordered=[...lines.values()];const samples=Object.keys(voices).map(s=>ordered.find(l=>l.speaker===s));
const requests=[...samples,...ordered.filter(l=>!samples.includes(l))];
fs.mkdirSync(path.join(root,'.preflight'),{recursive:true});
fs.writeFileSync(path.join(root,'.preflight/t38-voice-request.json'),JSON.stringify({schemaVersion:1,engine:'edge-tts',engineVersion:'7.3.1',voices,lines:requests},null,2)+'\n');
if(!process.argv.includes('--compile')){console.log(`Prepared ${requests.length} distinct v5 lines; first four are cast samples.`);process.exit(0);}
const results=read('.preflight/t38-voice-results.json');
for(const line of requests){const result=results[line.id];if(!result||result.text!==line.text||result.voice!==line.voice||!(result.durationMs>0)||sha(fs.readFileSync(path.join(root,'public',line.src)))!==result.sha256)throw Error(`Missing/stale audio ${line.id}`);}
const timings={};
for(const node of definition.nodes){
 const modes={};
 for(const mode of ['full','guided']){
  const base=mode==='full'?node.subtitles:node.guidedSubtitles??node.subtitles;
  const scale=mode==='full'?1:node.guidedTiming.targetMs/node.fullTiming.targetMs;
  modes[mode]=base.map((cue,i)=>{
   const durations=variants(node).map(v=>results[identity((mode==='full'?v.subtitles:v.guidedSubtitles??v.subtitles)[i])].durationMs);
   return Math.ceil(Math.max((cue.endMs-cue.startMs)*scale,...durations.map(d=>d+400)));
  });
 }
 timings[node.id]=modes;
}
const catalog={schemaVersion:1,definitionVersion:5,engine:'edge-tts',engineVersion:'7.3.1',voices,lines:requests.map(l=>({...l,durationMs:results[l.id].durationMs,sha256:results[l.id].sha256,bytes:results[l.id].bytes})),timings};
fs.writeFileSync(path.join(root,'src/content/voice-v5.json'),JSON.stringify(catalog,null,2)+'\n');
console.log(`Compiled ${requests.length} verified clips, ${Object.keys(timings).length} node schedules.`);
