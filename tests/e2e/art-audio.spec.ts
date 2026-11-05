import {currentDuration,currentProject} from '../helpers/current-project';
import {test,expect} from './formal-fixture';
import type {Page} from '@playwright/test';
import type {ProjectV1,StoryNodeId} from '../../src/domain/types';
const runtime=(page:Page)=>page.locator('#story-runtime'),sound=(page:Page)=>page.locator('#story-sound-status');
const stats=(page:Page)=>page.evaluate(()=>Reflect.get(window,'__audioStats')() as {created:number;started:number;disconnected:number;closed:number;states:string[]});
const at=(nodeId:StoryNodeId):ProjectV1=>currentProject(nodeId);
async function seed(page:Page,value:ProjectV1){await page.goto('/study.html');await page.evaluate(async value=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();},value);}
async function prepare(page:Page,node:StoryNodeId='intro'){
  await instrument(page);await page.addInitScript(()=>Reflect.set(window,'__audioDelay',true));await seed(page,at(node));await page.goto('/#/story');
  await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready',{timeout:15000});await expect(runtime(page)).toHaveAttribute('data-state','playing');await page.locator('#story-pause').click();
  await page.locator('#story-runtime').click();await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__audioPending')())).toBeGreaterThan(0);
  await page.evaluate(()=>{Reflect.set(window,'__audioDelay',false);Reflect.get(window,'__releaseAudio')();});await expect(sound(page)).toHaveAttribute('data-state','enabled');await page.locator('#story-reset').click();
}
async function go(page:Page,path:string){await page.evaluate(path=>{location.hash='#'+path;},path);await expect(page.locator('#app-view')).toHaveAttribute('data-route',path);}
async function advance(page:Page,time:number){await page.evaluate(async time=>{while(time>0){const delta=Math.min(time,100);Reflect.get(window,'__frame')(delta);time-=delta;await Promise.resolve();}},time);}
async function instrument(page:Page){await page.addInitScript(()=>{
  let now=0,id=0;const frames=new Map<number,FrameRequestCallback>();Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};window.cancelAnimationFrame=id=>{frames.delete(id);};Reflect.set(window,'__frame',(delta:number)=>{now+=delta;const list=[...frames.values()];frames.clear();list.forEach(cb=>cb(now));});Reflect.set(window,'__rafs',()=>frames.size);
  const Native=window.AudioContext,contexts:AudioContext[]=[],releases:(()=>void)[]=[],closeRejects:((error:Error)=>void)[]=[];let created=0,started=0,disconnected=0,closed=0;
  function track<T extends AudioScheduledSourceNode>(source:T):T{const start=source.start.bind(source),disconnect=source.disconnect.bind(source);source.start=(when?:number)=>{started++;start(when);};source.disconnect=(()=>{disconnected++;disconnect();}) as typeof source.disconnect;return source;}
  class TrackedContext extends Native{
    constructor(options?:AudioContextOptions){super(options);created++;contexts.push(this);}
    override createOscillator(){return track(super.createOscillator());}
    override createBufferSource(){return track(super.createBufferSource());}
    override resume(){if(Reflect.get(window,'__audioReject'))return Promise.reject(Reflect.get(window,'__audioReject')==='blocked'?new DOMException('test gesture required','NotAllowedError'):new Error('test resume refusal'));const operation=super.resume();return Reflect.get(window,'__audioDelay')?operation.then(()=>new Promise<void>(resolve=>releases.push(resolve))):operation;}
    override close(){closed++;const operation=super.close();return Reflect.get(window,'__audioCloseDelay')?operation.then(()=>new Promise<void>((_resolve,reject)=>closeRejects.push(reject))):operation;}
  }
  Object.defineProperty(window,'AudioContext',{value:TrackedContext,configurable:true});Reflect.set(window,'__audioStats',()=>({created,started,disconnected,closed,states:contexts.map(ctx=>ctx.state)}));Reflect.set(window,'__audioPending',()=>releases.length);Reflect.set(window,'__audioClosing',()=>closeRejects.length);Reflect.set(window,'__releaseAudio',()=>releases.splice(0).forEach(resolve=>resolve()));Reflect.set(window,'__rejectOldClose',()=>closeRejects.splice(0).forEach(reject=>reject(new Error('late close refusal'))));
});}

test('default-on sound plays once, pause/reset/mute and document exit release native audio',async({page})=>{
  await prepare(page);await expect(sound(page)).toHaveAttribute('data-state','enabled');expect((await stats(page)).states).toEqual(['running']);expect(await page.evaluate(()=>Reflect.get(window,'__rafs')())).toBe(0);
  await page.locator('#story-play').click();await advance(page,100);expect((await stats(page)).started).toBe(1);expect(await page.evaluate(()=>Reflect.get(window,'__rafs')())).toBe(1);await page.locator('#story-pause').click();expect((await stats(page)).disconnected).toBe(1);await page.locator('#story-play').click();await advance(page,100);expect((await stats(page)).started).toBe(1);
  await page.locator('#story-reset').click();await expect(runtime(page)).toHaveAttribute('data-state','paused');await page.locator('#story-play').click();await advance(page,100);expect((await stats(page)).started).toBe(2);await page.locator('#story-sound-toggle').click();await expect(sound(page)).toHaveAttribute('data-state','muted');expect((await stats(page)).states).toEqual(['closed']);await page.locator('#story-sound-toggle').click();await expect(sound(page)).toHaveAttribute('data-state','enabled');await go(page,'/craft');expect((await stats(page)).states).toEqual(['closed','running']);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));expect((await stats(page)).states).toEqual(['closed','closed']);
});
for(const failure of ['blocked','error'])test(`${failure} effects recover with the first real click and can then be muted`,async({page})=>{
  await instrument(page);await page.addInitScript(failure=>Reflect.set(window,'__audioReject',failure),failure);
  await page.addInitScript(()=>{Reflect.set(window,'__mediaBlocked',true);const play=HTMLMediaElement.prototype.play;HTMLMediaElement.prototype.play=function(){return Reflect.get(window,'__mediaBlocked')?Promise.reject(new DOMException('test media gesture required','NotAllowedError')):play.call(this);};});
  await seed(page,at('intro'));await page.goto('/#/story');await expect(sound(page)).toHaveAttribute('data-state',failure);
  const toggle=page.locator('#story-sound-toggle');await expect(toggle).toHaveText('重试舞台音效');await expect(toggle).toHaveAttribute('aria-pressed','true');
  await page.evaluate(()=>{Reflect.set(window,'__audioReject',false);Reflect.set(window,'__mediaBlocked',false);});await toggle.click();await expect(sound(page)).toHaveAttribute('data-state','enabled');
  await expect(page.locator('#story-voice-status')).toHaveAttribute('data-playing','true');await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','enabled');
  await expect(toggle).toHaveText('关闭舞台音效');await expect(toggle).toHaveAttribute('aria-pressed','true');expect((await stats(page)).created).toBe(2);
  await toggle.click();await expect(sound(page)).toHaveAttribute('data-state','muted');await expect(toggle).toHaveAttribute('aria-pressed','false');
  await expect(page.locator('#story-voice-toggle')).toHaveAttribute('aria-pressed','true');await expect(page.locator('#site-music-toggle')).toHaveAttribute('aria-pressed','true');
});
for(const node of ['call-split','split-axe'] as const)test(`${node} emits the actual mountain sound only when the axe resolves`,async({page})=>{
  await prepare(page,node);await expect(sound(page)).toHaveAttribute('data-state','enabled');await page.locator('#story-play').click();await advance(page,currentDuration(node));await page.locator('#story-assist').click();await advance(page,2200);expect((await stats(page)).started).toBe(0);await advance(page,1100);expect((await stats(page)).started).toBe(2);await expect(runtime(page)).toHaveAttribute('data-node',node);await page.locator('#story-pause').click();expect((await stats(page)).disconnected).toBe(2);await page.locator('#story-play').click();await advance(page,100);expect((await stats(page)).started).toBe(2);
});
test('reunion keeps the first two seconds silent and uses the new layered design',async({page})=>{
  await prepare(page,'reunion-hold');await expect(sound(page)).toHaveAttribute('data-state','enabled');await page.locator('#story-play').click();await advance(page,1900);expect((await stats(page)).started).toBe(0);await advance(page,700);expect((await stats(page)).started).toBe(1);await page.locator('#story-pause').click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('missing audio capability leaves every scene control and subtitle available',async({page})=>{
  await instrument(page);await page.addInitScript(()=>Object.defineProperty(window,'AudioContext',{value:undefined,configurable:true}));await seed(page,at('intro'));await page.goto('/#/story');await expect(runtime(page)).toHaveAttribute('data-state','playing');await page.locator('#story-pause').click();await expect(sound(page)).toHaveAttribute('data-state','unavailable');await expect(page.locator('#story-sound-toggle')).toBeDisabled();await page.locator('#story-play').click();await advance(page,100);await expect(runtime(page)).toHaveAttribute('data-elapsed','100');expect((await stats(page)).created).toBe(0);
});
test('a real context resume refusal is reported and explicit retry creates a working device',async({page})=>{
  await prepare(page);await page.locator('#story-sound-toggle').click();await page.evaluate(()=>Reflect.set(window,'__audioReject',true));await page.locator('#story-sound-toggle').click();await expect(sound(page)).toHaveAttribute('data-state','error');await expect(sound(page)).toContainText('静音');expect((await stats(page)).states).toEqual(['closed','closed']);await page.evaluate(()=>Reflect.set(window,'__audioReject',false));await page.locator('#story-runtime').click();await expect(sound(page)).toHaveAttribute('data-state','enabled');expect((await stats(page)).states).toEqual(['closed','closed','running']);
});
test('a pending native resume survives a route exit without reviving the old scene',async({page})=>{
  await prepare(page);await page.locator('#story-sound-toggle').click();await page.evaluate(()=>Reflect.set(window,'__audioDelay',true));await page.locator('#story-sound-toggle').click();await go(page,'/museum');await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__audioPending')())).toBeGreaterThan(0);await page.evaluate(()=>Reflect.get(window,'__releaseAudio')());expect((await stats(page)).started).toBe(0);await go(page,'/story');await expect(sound(page)).toHaveAttribute('data-state','enabled');expect((await stats(page)).created).toBe(2);await expect(runtime(page)).toHaveAttribute('data-state','playing');expect((await stats(page)).started).toBeLessThanOrEqual(1);
});
test('an old native close rejection cannot hide the fresh device mute control',async({page})=>{
  await prepare(page);await expect(sound(page)).toHaveAttribute('data-state','enabled');await page.evaluate(()=>Reflect.set(window,'__audioCloseDelay',true));await page.locator('#story-sound-toggle').click();await expect(sound(page)).toHaveAttribute('data-state','muted');await page.locator('#story-sound-toggle').click();await expect(sound(page)).toHaveAttribute('data-state','enabled');await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__audioClosing')())).toBeGreaterThan(0);await page.evaluate(()=>{Reflect.set(window,'__audioCloseDelay',false);Reflect.get(window,'__rejectOldClose')();});await expect(sound(page)).toContainText('上一音频设备');await expect(sound(page)).toHaveAttribute('data-state','enabled');await expect(page.locator('#story-sound-toggle')).toHaveAttribute('aria-pressed','true');await page.locator('#story-sound-toggle').click();await expect(sound(page)).toHaveAttribute('data-state','muted');expect((await stats(page)).states).toEqual(['closed','closed']);
});
test('ten story exits reuse one document audio context and retain a manual mute',async({page})=>{
  test.setTimeout(90000);await prepare(page);for(let i=0;i<10;i++){if(i){await go(page,'/story');await expect(runtime(page)).toHaveAttribute('data-state','playing',{timeout:15000});await page.locator('#story-pause').click();}await expect(runtime(page)).toHaveAttribute('data-state','paused',{timeout:15000});await expect(sound(page)).toHaveAttribute('data-state','enabled');await go(page,'/museum');}expect((await stats(page)).created).toBe(1);expect((await stats(page)).closed).toBe(0);expect(await page.evaluate(()=>Reflect.get(window,'__rafs')())).toBe(0);
  await go(page,'/story');await page.locator('#story-sound-toggle').click();await go(page,'/museum');await go(page,'/story');await expect(sound(page)).toHaveAttribute('data-state','muted');expect((await stats(page)).states).toEqual(['closed']);
});
