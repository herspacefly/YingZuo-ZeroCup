import {readFileSync} from 'node:fs';
import {test,expect} from './formal-fixture';
import type {Page} from '@playwright/test';
import type {ProjectV1,StoryNodeId} from '../../src/domain/types';
import definition from '../../src/content/stories/reunion-v5.json' with {type:'json'};
import fixture from '../fixtures/project-v1.json' with {type:'json'};
import {CHOICE_RUNS} from '../helpers/choice-cases';
import type {ChoiceRun} from '../helpers/choice-cases';

test.setTimeout(60000);
type Clip={src:string;speaker:string;text:string};
type Catalog={lines:Clip[];timings:Record<string,{full:number[];guided:number[]}>};
const catalog=()=>JSON.parse(readFileSync(new URL('../../src/content/voice-v5.json',import.meta.url),'utf8')) as Catalog;
type MediaState={src:string|null;paused:boolean;time:number;ready:number;volume:number;playingEvents:number};
const runtime=(p:Page)=>p.locator('#story-runtime');
const voiceStatus=(p:Page)=>p.locator('#story-voice-status');
const run=CHOICE_RUNS[1]!;
function choiceAt(id:StoryNodeId,choice:ChoiceRun=run,mode:'full'|'guided'='guided'):ProjectV1{
 const project=structuredClone(fixture) as ProjectV1,cast=project.story!.castSnapshot;
 Object.assign(project.story!,{definitionVersion:5,nodeId:'intro',revision:0,mode,approach:null,approachSource:null,ending:null,endingSource:null,choices:{journeyIntent:null,mountainPact:null,finalAction:null},castSnapshot:null,assistedNodeIds:[],completedAt:null});
 delete project.story!.skippedNodeIds;
 for(let n=0;project.story!.nodeId!==id&&n<38;n++){
  const s=project.story!,node=definition.nodes.find(node=>node.id===s.nodeId)!;
  if(s.nodeId==='craft')s.castSnapshot=cast;
  if(s.nodeId==='journey-choice')s.choices!.journeyIntent=choice.journeyIntent;
  if(s.nodeId==='mountain-pact-choice')s.choices!.mountainPact=choice.mountainPact;
  if(s.nodeId==='approach-choice'){s.approach=choice.approach;s.approachSource='user';}
  if(s.nodeId==='ending-choice'){s.choices!.finalAction=choice.finalAction;s.ending=choice.ending;s.endingSource='choices';}
  const edges=node.next as unknown as Record<string,StoryNodeId>;
  s.nodeId=edges.default??edges[s.nodeId==='ending-choice'?choice.ending:choice.approach]!;s.revision++;
  if(s.nodeId==='curtain')s.completedAt='2026-10-27T00:00:00.000Z';
 }
 if(project.story!.nodeId!==id)throw Error('Unreachable v5 fixture '+id);return project;
}
async function instrument(p:Page){await p.addInitScript(()=>{
 const Native=window.Audio,items:{media:HTMLAudioElement;playingEvents:number}[]=[];
 class TrackedAudio extends Native{
  constructor(src?:string){super(src);const item={media:this,playingEvents:0};items.push(item);this.addEventListener('playing',()=>item.playingEvents++);}
 }
 Object.defineProperty(window,'Audio',{configurable:true,value:TrackedAudio});
 Reflect.set(window,'__voiceMedia',()=>items.map(item=>({src:item.media.getAttribute('src'),paused:item.media.paused,time:item.media.currentTime,ready:item.media.readyState,volume:item.media.volume,playingEvents:item.playingEvents})));
});}
async function seed(p:Page,project:ProjectV1,route='/story'){
 await p.goto('/study.html');await p.evaluate(async value=>{
  const db=await new Promise<IDBDatabase>((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});
  await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();
 },project);await p.goto('/#'+route);
}
async function stored(p:Page){return p.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});
 const raw=await new Promise<string>((yes,no)=>{const q=db.transaction('snapshots').objectStore('snapshots').get('draft');q.onsuccess=()=>yes(q.result as string);q.onerror=()=>no(q.error);});db.close();return JSON.parse(raw) as ProjectV1;
});}
async function ready(p:Page,id:StoryNodeId){await expect(runtime(p)).toHaveAttribute('data-node',id);await expect(p.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready',{timeout:15000});}
const media=(p:Page)=>p.evaluate(()=>Reflect.get(window,'__voiceMedia')() as MediaState[]);
const voices=(p:Page)=>media(p).then(items=>items.filter(item=>item.src?.includes('/audio/voice-v5/')));
async function active(p:Page,src?:string){
 await expect.poll(async()=>{const rows=await voices(p);return rows.some(item=>(!src||item.src===src)&&!item.paused&&item.ready>=2&&item.time>.05&&item.playingEvents>0);}).toBe(true);
 return (await voices(p)).find(item=>(!src||item.src===src)&&!item.paused)!;
}
async function start(p:Page,id:StoryNodeId='intro'){
 await ready(p,id);await runtime(p).click();
 if(await runtime(p).getAttribute('data-state')==='paused')await p.locator('#story-play').click();
 await active(p);
}
async function go(p:Page,route:string){await p.evaluate(route=>{location.hash='#'+route;},route);await expect(p.locator('#app-view')).toHaveAttribute('data-route',route);}
async function fakeClock(p:Page){await p.addInitScript(()=>{
 let now=0,id=0;const frames=new Map<number,FrameRequestCallback>();Object.defineProperty(performance,'now',{value:()=>now});
 window.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};window.cancelAnimationFrame=id=>frames.delete(id);
 Reflect.set(window,'__voiceAdvance',async(ms:number)=>{while(ms>0){const delta=Math.min(ms,100);ms-=delta;now+=delta;const batch=[...frames.values()];frames.clear();batch.forEach(cb=>cb(now));await Promise.resolve();}});
});}

test('four cast voices load and play real MP3s with native media events',async({page})=>{
 await instrument(page);
 for(const [id,speakers]of [['guardian-parley',['chenxiang','guardian','narrator']],['memory-words',['mother']]] as const){
  await seed(page,choiceAt(id));await start(page,id);
  const node=definition.nodes.find(node=>node.id===id)!;
  for(const speaker of speakers){
   const index=node.guidedSubtitles!.findIndex(cue=>cue.speaker===speaker),cue=node.guidedSubtitles![index]!;
   await page.locator('.subtitle-directory button').nth(index).click();
   const clip=catalog().lines.find(line=>line.speaker===speaker&&line.text===cue.text)!;
   expect(clip).toBeTruthy();await active(page,clip.src);
  }
 }
});

test('pause, resume and subtitle seek follow the director without overlapping speech',async({page})=>{
 await instrument(page);await seed(page,choiceAt('memory-words'));await start(page,'memory-words');
 await page.locator('#story-pause').click();await expect(voiceStatus(page)).toHaveAttribute('data-playing','false');
 const before=(await voices(page)).find(item=>item.src)!.time;
 // This wait observes a native media clock, not a simulated animation delay.
 await page.waitForTimeout(250);expect(Math.abs((await voices(page)).find(item=>item.src)!.time-before)).toBeLessThan(.05);
 await page.locator('#story-play').click();await active(page);
 await page.locator('.subtitle-directory button').nth(1).click();
 const cue=definition.nodes.find(n=>n.id==='memory-words')!.guidedSubtitles![1]!;
 await active(page,catalog().lines.find(line=>line.speaker===cue.speaker&&line.text===cue.text)!.src);
 expect((await voices(page)).filter(item=>!item.paused)).toHaveLength(1);
});

test('voice and music intents are independent, survive routes, and default on after refresh',async({page})=>{
 await instrument(page);await seed(page,choiceAt('intro'));await start(page);
 await page.locator('#site-music-toggle').click();await expect(page.locator('#site-music-toggle')).toHaveAttribute('aria-pressed','false');await active(page);
 await page.locator('#story-voice-toggle').click();await expect(page.locator('#story-voice-toggle')).toHaveAttribute('aria-pressed','false');expect((await voices(page)).every(item=>item.paused)).toBe(true);
 await go(page,'/museum');await go(page,'/story');await ready(page,'intro');await expect(page.locator('#story-voice-toggle')).toHaveAttribute('aria-pressed','false');
 await page.reload();await ready(page,'intro');await expect(page.locator('#story-voice-toggle')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#site-music-toggle')).toHaveAttribute('aria-pressed','true');
});

test('blocked speech reports its state without frame retries and the retry button unlocks it',async({page})=>{
 await instrument(page);await page.addInitScript(()=>{
  const native=HTMLMediaElement.prototype.play;Reflect.set(window,'__rejectVoice',true);Reflect.set(window,'__voiceAttempts',0);
  HTMLMediaElement.prototype.play=function(){if(this.src.includes('/audio/voice-v5/')){Reflect.set(window,'__voiceAttempts',Number(Reflect.get(window,'__voiceAttempts'))+1);if(Reflect.get(window,'__rejectVoice'))return Promise.reject(new DOMException('Injected voice gesture refusal','NotAllowedError'));}return native.call(this);};
 });
 await seed(page,choiceAt('intro'));await ready(page,'intro');await expect(voiceStatus(page)).toHaveAttribute('data-state','blocked');
 const attempts=await page.evaluate(()=>Number(Reflect.get(window,'__voiceAttempts')));await page.waitForTimeout(250);expect(await page.evaluate(()=>Number(Reflect.get(window,'__voiceAttempts')))).toBe(attempts);
 await page.evaluate(()=>Reflect.set(window,'__rejectVoice',false));await page.locator('#story-voice-toggle').click();await active(page);await expect(page.locator('#story-voice-toggle')).toHaveAttribute('aria-pressed','true');
});

test('a failed speech resource reports failure and succeeds after explicit retry',async({page})=>{
 await instrument(page);let refuse=true;await page.route('**/audio/voice-v5/*.mp3',route=>refuse?route.abort('failed'):route.continue());
 await seed(page,choiceAt('intro'));await ready(page,'intro');await runtime(page).click();await expect(voiceStatus(page)).toHaveAttribute('data-state','error');
 refuse=false;await page.locator('#story-voice-toggle').click();await active(page);await expect(page.locator('#story-voice-toggle')).toHaveAttribute('aria-pressed','true');
});

test('blur, hidden documents and route exits stop speech and focus cannot revive it',async({page})=>{
 await instrument(page);await page.addInitScript(()=>{let hidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});Reflect.set(window,'__setVoiceHidden',(value:boolean)=>{hidden=value;document.dispatchEvent(new Event('visibilitychange'));});});
 await seed(page,choiceAt('intro'));await start(page);
 await page.evaluate(()=>dispatchEvent(new Event('blur')));await expect(runtime(page)).toHaveAttribute('data-state','paused');expect((await voices(page)).every(item=>item.paused)).toBe(true);
 await page.evaluate(()=>dispatchEvent(new Event('focus')));await expect(voiceStatus(page)).toHaveAttribute('data-playing','false');await expect(runtime(page)).toHaveAttribute('data-state','paused');
 await page.locator('#story-play').click();await active(page);await page.evaluate(()=>Reflect.get(window,'__setVoiceHidden')(true));await expect(voiceStatus(page)).toHaveAttribute('data-playing','false');
 await page.evaluate(()=>{Reflect.get(window,'__setVoiceHidden')(false);dispatchEvent(new Event('focus'));});await expect(runtime(page)).toHaveAttribute('data-state','paused');
 await page.locator('#story-play').click();await active(page);await go(page,'/museum');expect((await voices(page)).every(item=>item.paused)).toBe(true);
});

test('curtain reserves the original vocal recording until all spoken cues finish',async({page})=>{
 // Controlled director time proves track selection only; Audio itself remains native.
 await instrument(page);await fakeClock(page);await seed(page,choiceAt('curtain'));await start(page,'curtain');
 expect((await media(page)).some(item=>item.src?.endsWith('jingju-curtain.mp3')&&!item.paused)).toBe(false);
 const dialogueEnd=catalog().timings.curtain!.guided.reduce((sum,slot)=>sum+slot,0);
 await page.evaluate(ms=>Reflect.get(window,'__voiceAdvance')(ms),dialogueEnd+100);
 await expect.poll(async()=>(await media(page)).some(item=>item.src?.endsWith('jingju-curtain.mp3')&&!item.paused&&item.ready>=2&&item.time>.05)).toBe(true);
 expect((await voices(page)).every(item=>item.paused)).toBe(true);
});

test('result replay speaks the selected variant, seeks and closes without writing the completed run',async({page})=>{
 await instrument(page);const chosen=CHOICE_RUNS.find(r=>r.journeyIntent==='open-road'&&r.mountainPact==='self'&&r.approach==='split-first'&&r.finalAction==='fulfill')!;
 await seed(page,choiceAt('completed',chosen),'/result');await expect(page.locator('.reunion-artifact')).toHaveAttribute('data-state','ready',{timeout:15000});const before=await stored(page);
 await page.locator('#result-replay').click();await expect(page.locator('#result-replay-player .canvas-stage-status')).toHaveAttribute('data-state','ready');
 const mountainTitle=definition.nodes.find(n=>n.id==='mountain-listen')!.title;
 const option=page.locator('#replay-segment option').filter({hasText:mountainTitle});await page.locator('#replay-segment').selectOption((await option.getAttribute('value'))!);
 await expect(page.locator('#result-replay-player .canvas-stage-status')).toHaveAttribute('data-state','ready');
 await expect(page.locator('#result-replay-player .subtitle-directory')).toContainText('永久化山');await page.locator('#replay-play').click();await active(page);
 await page.locator('#replay-pause').click();await expect(page.locator('#replay-voice-status')).toHaveAttribute('data-playing','false');
 await page.locator('#result-replay-player .subtitle-directory button').nth(1).click();await page.locator('#replay-play').click();await active(page);
 await page.locator('#result-replay').click();expect((await voices(page)).every(item=>item.paused)).toBe(true);expect((await stored(page)).story).toEqual(before.story);
});

test('restored v1 through v4 do not request new v5 speech assets',async({page})=>{
 await instrument(page);const requests:string[]=[];page.on('request',request=>{if(request.url().includes('/audio/voice-v5/'))requests.push(request.url());});
 for(const version of [1,2,3,4]){
  const project=structuredClone(fixture) as ProjectV1;Object.assign(project.story!,{definitionVersion:version,nodeId:'memory-separate',approach:null,approachSource:null,assistedNodeIds:[],completedAt:null});
  if(version!==1)Object.assign(project.story!,{ending:null,endingSource:null});await seed(page,project);await ready(page,'memory-separate');await runtime(page).click();
  await expect(page.locator('#story-voice-toggle')).toBeHidden();expect((await stored(page)).story!.definitionVersion).toBe(version);
 }
 expect(requests).toEqual([]);
});

// The existing choice-theatre matrix covers every four-decision path in both
// modes. These native-media checks add each ending's actual spoken source.
for(const mode of ['full','guided'] as const)test(`${mode}: all five ending epilogues play their matching local speech`,async({page})=>{
 test.setTimeout(120000);await instrument(page);
 for(const ending of ['home','light','road','waiting','sacrifice'] as const){
  const chosen=CHOICE_RUNS.find(candidate=>candidate.ending===ending)!;
  const id=`ending-${ending}-epilogue` as StoryNodeId;
  await seed(page,choiceAt(id,chosen,mode));await start(page,id);
  const node=definition.nodes.find(candidate=>candidate.id===id)!;
  const cue=(mode==='full'?node.subtitles:node.guidedSubtitles!)[0]!;
  const clip=catalog().lines.find(line=>line.speaker===cue.speaker&&line.text===cue.text)!;
  expect(clip).toBeTruthy();await active(page,clip.src);
  await expect(voiceStatus(page)).toHaveAttribute('data-playing','true');
  expect((await stored(page)).story).toMatchObject({definitionVersion:5,mode,ending,choices:{journeyIntent:chosen.journeyIntent,mountainPact:chosen.mountainPact,finalAction:chosen.finalAction}});
 }
});
