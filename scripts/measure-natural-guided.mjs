// Reproducible observation of the existing production site. No clock, rate,
// authored duration, subtitle position, app source, or saved progress is advanced.
import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const output=path.join(root,'docs/evidence/t38/natural-guided.json');
const origin=process.env.YINGZUO_PROBE_ORIGIN??'http://127.0.0.1:4173';
const hash=p=>createHash('sha256').update(readFileSync(path.join(root,p))).digest('hex');
const report={kind:'natural-clock-guided-v5',startedAt:new Date().toISOString(),origin,
 indexSha256:hash('dist/index.html'),voiceCatalogSha256:hash('src/content/voice-v5.json'),
 constraints:{nativeRaf:true,nativePerformanceNow:true,nativeAudio:true,playbackRate:1,subtitleSeeking:false,nodeSkipping:false,mode:'guided',reducedMotion:'reduce',humanListeningVerified:false},
 plannedChoices:{journeyIntent:'home',mountainPact:'shared',approach:'call-first',finalAction:'fulfill',ending:'home'},
 actions:[],nodes:[],runtimeTransitions:[],unexpectedPauses:[],pageErrors:[],requestFailures:[],result:'running'};
mkdirSync(path.dirname(output),{recursive:true});
function checkpoint(){writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
const elapsed=()=>Date.now()-start;
let browser,page,start=Date.now(),lastProgress=0,currentNode='',lastTransition='',lastElapsed=-1,lastMoving=Date.now();
const acted=new Set();let activeNode=null;
try{
 browser=await chromium.launch({headless:true});report.browserVersion=browser.version();
 const context=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce'});
 page=await context.newPage();page.setDefaultTimeout(6000);page.setDefaultNavigationTimeout(20000);
 page.on('pageerror',error=>report.pageErrors.push({wallMs:elapsed(),message:error.message}));
 page.on('requestfailed',request=>report.requestFailures.push({wallMs:elapsed(),url:request.url(),error:request.failure()?.errorText??'unknown'}));
 await page.addInitScript(()=>{
  // Observe native Audio instances without replacing play, media time or rate.
  const Native=window.Audio,items=[],events=[];
  class ObservedAudio extends Native{
   constructor(src){super(src);const record={id:items.length,media:this,source:src??'',maxTime:0,playingCount:0,endedCount:0,errorCount:0,rates:new Set()};items.push(record);
    for(const type of ['playing','ended','error','pause','waiting','loadedmetadata'])this.addEventListener(type,()=>{
     record.source=this.getAttribute('src')||this.currentSrc||record.source;record.maxTime=Math.max(record.maxTime,this.currentTime||0);record.rates.add(this.playbackRate);
     if(type==='playing')record.playingCount++;if(type==='ended')record.endedCount++;if(type==='error')record.errorCount++;
     events.push({nativeMs:performance.now(),type,mediaId:record.id,source:record.source,time:this.currentTime,rate:this.playbackRate,nodeId:document.querySelector('#story-runtime')?.getAttribute('data-node')??null,error:this.error?{code:this.error.code,message:this.error.message}:null});
    });
   }
  }
  Object.defineProperty(window,'Audio',{configurable:true,value:ObservedAudio});
  Reflect.set(window,'__naturalVoiceEvidence',()=>({nativeNow:performance.now(),timeOrigin:performance.timeOrigin,
   audio:items.map(record=>{record.source=record.media.getAttribute('src')||record.media.currentSrc||record.source;record.maxTime=Math.max(record.maxTime,record.media.currentTime||0);record.rates.add(record.media.playbackRate);return {id:record.id,source:record.source,currentSource:record.media.getAttribute('src'),paused:record.media.paused,time:record.media.currentTime,maxTime:record.maxTime,readyState:record.media.readyState,playingCount:record.playingCount,endedCount:record.endedCount,errorCount:record.errorCount,rates:[...record.rates]};}),events}));
  new MutationObserver(()=>document.querySelector('#guide-skip')?.click()).observe(document,{childList:true,subtree:true});
 });
 const project=JSON.parse(readFileSync(path.join(root,'tests/fixtures/project-v1.json'),'utf8'));
 Object.assign(project.story,{definitionVersion:5,nodeId:'intro',revision:0,mode:'guided',approach:null,approachSource:null,ending:null,endingSource:null,choices:{journeyIntent:null,mountainPact:null,finalAction:null},castSnapshot:null,assistedNodeIds:[],completedAt:null,runId:'natural-guided-'+Date.now()});
 delete project.story.skippedNodeIds;
 await page.goto(origin+'/study.html');
 await page.evaluate(async value=>{
  const db=await new Promise((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});
  await new Promise((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();
 },project);
 start=Date.now();report.performanceStartAt=new Date(start).toISOString();await page.goto(origin+'/#/story');await page.bringToFront();
 await page.waitForSelector('#story-runtime[data-node=intro]');
 await page.locator('#story-runtime').click();report.actions.push({wallMs:elapsed(),nodeId:'intro',id:'story-runtime',kind:'initial-user-audio-unlock'});
 checkpoint();
 while(elapsed()<15*60*1000){
  const snapshot=await page.evaluate(()=>{
   const runtime=document.querySelector('#story-runtime');
   const available=id=>{const button=document.getElementById(id);return !!button&&!button.hidden&&!!button.getClientRects().length&&!button.disabled;};
   return {nodeId:runtime?.getAttribute('data-node')??'',phase:runtime?.getAttribute('data-state')??'',elapsedMs:Number(runtime?.getAttribute('data-elapsed')??0),message:runtime?.textContent??'',voiceState:document.querySelector('#story-voice-status')?.getAttribute('data-state'),voicePlaying:document.querySelector('#story-voice-status')?.getAttribute('data-playing'),guiding:document.documentElement.getAttribute('data-guiding'),available:Object.fromEntries(['story-play','story-confirm-craft','story-choice-journey-home','story-choice-pact-shared','story-call-first','story-choice-final-fulfill','story-assist','story-finish','story-voice-toggle'].map(id=>[id,available(id)])),audio:Reflect.get(window,'__naturalVoiceEvidence')()};
  });
  report.latest={wallMs:elapsed(),nodeId:snapshot.nodeId,phase:snapshot.phase,elapsedMs:snapshot.elapsedMs,message:snapshot.message,voiceState:snapshot.voiceState,voicePlaying:snapshot.voicePlaying};report.media=snapshot.audio;
  if(snapshot.nodeId!==currentNode){
   if(activeNode){activeNode.endWallMs=elapsed();activeNode.observedDurationMs=activeNode.endWallMs-activeNode.startWallMs;}
   currentNode=snapshot.nodeId;activeNode={nodeId:currentNode,startWallMs:elapsed(),lastElapsedMs:snapshot.elapsedMs};report.nodes.push(activeNode);lastElapsed=snapshot.elapsedMs;lastMoving=Date.now();
   console.log(JSON.stringify({event:'node',wallSeconds:Math.round(elapsed()/1000),nodeId:currentNode}),null,0);checkpoint();
  }
  if(activeNode)activeNode.lastElapsedMs=snapshot.elapsedMs;
  const transition=JSON.stringify([snapshot.nodeId,snapshot.phase,snapshot.message]);
  if(transition!==lastTransition){report.runtimeTransitions.push({...report.latest});lastTransition=transition;}
  if(snapshot.elapsedMs!==lastElapsed){lastElapsed=snapshot.elapsedMs;lastMoving=Date.now();}
  if(snapshot.nodeId==='completed'){report.result='passed';break;}
  if(snapshot.phase==='error')throw Error('Runtime error: '+snapshot.message);
  const choices={'journey-choice':'story-choice-journey-home','mountain-pact-choice':'story-choice-pact-shared','approach-choice':'story-call-first','ending-choice':'story-choice-final-fulfill'};
  let id=null,kind=null;
  if(snapshot.nodeId==='craft'&&snapshot.available['story-confirm-craft']){id='story-confirm-craft';kind='craft-confirmation';}
  else if(choices[snapshot.nodeId]&&snapshot.available[choices[snapshot.nodeId]]){id=choices[snapshot.nodeId];kind='explicit-choice';}
  else if(snapshot.available['story-finish']){id='story-finish';kind='hold-confirmation';}
  else if(snapshot.available['story-assist']&&!acted.has(snapshot.nodeId+':assist')){id='story-assist';kind='normal-assistance';acted.add(snapshot.nodeId+':assist');}
  else if(snapshot.phase==='paused'&&snapshot.available['story-play']&&!snapshot.guiding){
   id='story-play';kind='explicit-resume';report.unexpectedPauses.push({...report.latest,reason:snapshot.message});
  }
  if(id){
   report.actions.push({wallMs:elapsed(),nodeId:snapshot.nodeId,elapsedMs:snapshot.elapsedMs,id,kind,message:snapshot.message});
   console.log(JSON.stringify({event:'action',wallSeconds:Math.round(elapsed()/1000),nodeId:snapshot.nodeId,id,kind}));
   await page.locator('#'+id).press('Enter');lastMoving=Date.now();checkpoint();
  }
  if(Date.now()-lastMoving>45000&&!['playing','loading'].includes(snapshot.phase))throw Error('No advancing time or available normal action for 45s: '+snapshot.nodeId+' '+snapshot.phase+' '+snapshot.message);
  if(elapsed()-lastProgress>=60000){lastProgress=elapsed();console.log(JSON.stringify({event:'progress',...report.latest,voicePlayingEvents:snapshot.audio.audio.reduce((n,item)=>n+(item.source.includes('/voice-v5/')?item.playingCount:0),0)}));checkpoint();}
  await page.waitForTimeout(300);
 }
 if(report.result!=='passed')throw Error('15-minute natural run limit reached');
 report.savedProject=await page.evaluate(async()=>{
  const db=await new Promise((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});
  const raw=await new Promise((yes,no)=>{const q=db.transaction('snapshots').objectStore('snapshots').get('draft');q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});db.close();return JSON.parse(raw);
 });
 const voice=report.media.audio.filter(item=>item.source.includes('/audio/voice-v5/')),song=report.media.audio.filter(item=>item.source.includes('jingju-curtain.mp3'));
 report.summary={wallMs:elapsed(),nodeCount:report.nodes.length,choiceCount:report.actions.filter(item=>item.kind==='explicit-choice').length,voiceMediaCount:voice.length,voicePlayingEvents:voice.reduce((n,item)=>n+item.playingCount,0),voiceEndedEvents:voice.reduce((n,item)=>n+item.endedCount,0),voiceCompletedMedia:voice.filter(item=>item.playingCount>0&&item.endedCount>0).length,voicePlayedMedia:voice.filter(item=>item.playingCount>0).length,voiceErrors:voice.reduce((n,item)=>n+item.errorCount,0),curtainVocalPlayingEvents:song.reduce((n,item)=>n+item.playingCount,0),curtainVocalMaxTime:Math.max(0,...song.map(item=>item.maxTime)),allPlaybackRatesOne:report.media.audio.every(item=>item.rates.every(rate=>rate===1)),unexpectedPauses:report.unexpectedPauses.length,ending:report.savedProject.story.ending,completedAt:report.savedProject.story.completedAt};
 if(report.summary.choiceCount!==4||report.savedProject.story.nodeId!=='completed'||!report.summary.voicePlayingEvents||!report.summary.curtainVocalPlayingEvents||!report.summary.allPlaybackRatesOne||report.summary.voiceCompletedMedia!==report.summary.voicePlayedMedia||report.summary.voiceErrors||report.pageErrors.length)throw Error('Natural run completed but evidence criteria failed: '+JSON.stringify(report.summary));
 console.log(JSON.stringify({event:'complete',result:report.result,...report.summary}));
}catch(error){report.result='failed';report.failure={wallMs:elapsed(),message:error instanceof Error?error.message:String(error),stack:error instanceof Error?error.stack:undefined};console.error(JSON.stringify({event:'failure',...report.failure}));process.exitCode=1;}
finally{
 if(activeNode&&!activeNode.endWallMs){activeNode.endWallMs=elapsed();activeNode.observedDurationMs=activeNode.endWallMs-activeNode.startWallMs;}
 report.finishedAt=new Date().toISOString();report.totalWallMs=elapsed();checkpoint();await browser?.close();
}
