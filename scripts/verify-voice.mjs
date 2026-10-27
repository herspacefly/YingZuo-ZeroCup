import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { arrangeVoiceNode, voiceCuesForNode } from '../src/content/voice-arrangement.ts';
import { presentChoiceDialogue } from '../src/content/choice-dialogue.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const catalog=read('src/content/voice-v5.json'),definition=read('src/content/stories/reunion-v5.json');
const errors=[],check=(ok,message)=>{if(!ok)errors.push(message);};
const ids=new Set();let scheduleChecks=0;
for(const line of catalog.lines){
 check(!ids.has(line.id),`duplicate ${line.id}`);ids.add(line.id);
 check(line.voice===catalog.voices[line.speaker]?.voice,`wrong voice ${line.id}`);
 check(line.src===`/audio/voice-v5/${line.id}.mp3`&&/^[a-f0-9]{24}$/.test(line.id),`unsafe path ${line.id}`);
 const p=path.join(root,'public',line.src);check(fs.existsSync(p),`missing ${line.id}`);if(!fs.existsSync(p))continue;
 const bytes=fs.readFileSync(p);check(bytes.length===line.bytes&&digest(bytes)===line.sha256,`stale bytes ${line.id}`);
 check(Number.isFinite(line.durationMs)&&line.durationMs>0,`invalid duration ${line.id}`);
 if(process.argv.includes('--decode')){
  try{execFileSync('ffmpeg',['-v','error','-i',p,'-f','null','-'],{stdio:'pipe',timeout:30000});}catch{errors.push(`decode failure ${line.id}`);}
 }
}
for(const journeyIntent of ['home','open-road'])for(const mountainPact of ['shared','self'])for(const approach of ['call-first','split-first'])for(const finalAction of ['wait','fulfill']){
 const story={definitionVersion:5,choices:{journeyIntent,mountainPact,finalAction},approach};
 for(const original of definition.nodes)for(const mode of ['full','guided']){
  const node=arrangeVoiceNode(presentChoiceDialogue(original,story),5),cues=voiceCuesForNode(node,mode,5),duration=node[mode==='full'?'fullTiming':'guidedTiming'].targetMs;
  const raw=mode==='full'?node.subtitles:node.guidedSubtitles??node.subtitles;
  check(cues.length===raw.length,`missing cue ${node.id}/${mode}`);
  check(JSON.stringify(arrangeVoiceNode(JSON.parse(JSON.stringify(node)),5))===JSON.stringify(node),`non-idempotent ${node.id}/${mode}`);
  cues.forEach((cue,i)=>{check(ids.has(cue.clip.id),`unknown clip ${node.id}/${mode}/${i}`);check(cue.endMs<=duration+.001&&cue.startMs+cue.clip.durationMs<=cue.endMs+.001,`clip overrun ${node.id}/${mode}/${i}`);if(i)check(cue.startMs>=cues[i-1].endMs-.001,`overlap ${node.id}/${mode}/${i}`);});
  scheduleChecks++;
 }
}
const report={schemaVersion:1,clips:catalog.lines.length,bytes:catalog.lines.reduce((sum,l)=>sum+l.bytes,0),audioDurationMs:catalog.lines.reduce((sum,l)=>sum+l.durationMs,0),scheduleChecks,choiceCombinations:16,modes:2,decodedThisRun:process.argv.includes('--decode'),catalogSha256:digest(fs.readFileSync(path.join(root,'src/content/voice-v5.json'))),errors};
const flag=process.argv.indexOf('--report');if(flag>=0){const dest=path.resolve(root,process.argv[flag+1]);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));if(errors.length)process.exitCode=1;
