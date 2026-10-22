import { expect,test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { ProjectV1 } from '../../src/domain/types';
import fixture from '../fixtures/project-v1.json' with {type:'json'};

function at(nodeId:NonNullable<ProjectV1['story']>['nodeId'],mode:'full'|'guided'='full'):ProjectV1{
  const project=structuredClone(fixture) as ProjectV1,story=project.story!;
  story.nodeId=nodeId;story.mode=mode;story.revision=nodeId==='intro'?0:8;story.assistedNodeIds=[];
  if(['intro','craft','memory-wave','memory-separate','road','training','guardian','approach-choice'].includes(nodeId)){story.approach=null;story.approachSource=null;}
  if(['intro','craft'].includes(nodeId))story.castSnapshot=null;
  return project;
}
const first=(mode:'full'|'guided'='full')=>at('intro',mode);

const node=(page:Page)=>page.locator('#story-runtime');
const ready=async(page:Page)=>{await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');await expect(node(page)).toHaveAttribute('data-state','paused');};
async function seed(page:Page,project:ProjectV1){await page.goto('/study.html');await page.evaluate(async value=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
},project);}
async function stored(page:Page):Promise<ProjectV1>{return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const value=await new Promise<string>((resolve,reject)=>{const r=db.transaction('snapshots').objectStore('snapshots').get('draft');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return JSON.parse(value);
});}
async function fakeClock(page:Page){await page.addInitScript(()=>{
  let now=0,id=0;const callbacks=new Map<number,FrameRequestCallback>(),late:FrameRequestCallback[]=[];
  Object.defineProperty(performance,'now',{value:()=>now});
  window.requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};window.cancelAnimationFrame=key=>{const callback=callbacks.get(key);if(callback)late.push(callback);callbacks.delete(key);};
  Reflect.set(window,'__frame',(delta:number)=>{now+=delta;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(callback=>callback(now));});
  Reflect.set(window,'__late',()=>late.splice(0).forEach(callback=>callback(now)));Object.defineProperty(window,'__rafCount',{get:()=>callbacks.size});
  const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window),blur=new Set<EventListenerOrEventListenerObject>();
  window.addEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{if(type==='blur')blur.add(listener);add(type,listener,options);}) as typeof window.addEventListener;
  window.removeEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions)=>{if(type==='blur')blur.delete(listener);remove(type,listener,options);}) as typeof window.removeEventListener;
  Object.defineProperty(window,'__blurCount',{get:()=>blur.size});
});}
async function advance(page:Page,ms:number){await page.evaluate(async ms=>{while(ms>0){const delta=Math.min(ms,100);Reflect.get(window,'__frame')(delta);ms-=delta;await Promise.resolve();}},ms);}
async function go(page:Page,path:string){await page.evaluate(path=>{location.hash=`#${path}`;},path);await expect(page.locator('#app-view')).toHaveAttribute('data-route',path);}
async function failSave(page:Page){await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let fail=true,writes=0;IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(key==='draft'){writes++;if(fail){fail=false;throw new DOMException('Injected quota','QuotaExceededError');}}return put.call(this,value,key);};Object.defineProperty(window,'__writes',{get:()=>writes});});}
async function hash(page:Page){return page.locator('.shadow-stage').evaluate((canvas:HTMLCanvasElement)=>{const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let hash=0;for(let i=0;i<data.length;i++)hash=(Math.imul(hash,31)+data[i]!)|0;return hash;});}

for(const mode of ['full','guided'] as const)test(`${mode} intro has four timed shots and saves exactly once before craft`,async({page})=>{
  await fakeClock(page);await seed(page,first(mode));await page.goto('/#/story');await ready(page);
  await expect(node(page)).toHaveAttribute('data-elapsed','0');expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await expect(page.locator('#story-subtitles')).toContainText('一盏灯');await page.getByRole('button',{name:'展开本段完整台词'}).click();await expect(page.locator('#story-transcript p')).toHaveCount(4);
  await page.getByRole('button',{name:'收起本段完整台词'}).click();
  const duration=mode==='full'?18000:10000,ratio=duration/18000;
  await page.locator('#story-play').click();await advance(page,4500*ratio);await expect(page.locator('#story-shot')).toContainText('母子分离');
  await advance(page,4500*ratio);await expect(page.locator('#story-shot')).toContainText('操偶杆');await expect(page.locator('#story-subtitles')).toContainText('你来');
  if(mode==='full')await page.screenshot({path:`docs/evidence/2026-10-17-t16-director-${test.info().project.name.startsWith('desktop')?'desktop':'mobile'}.png`,fullPage:true});
  await advance(page,5000*ratio);await expect(page.locator('#story-shot')).toContainText('备好行装');
  expect((await stored(page)).story!.nodeId).toBe('intro');await advance(page,duration-14000*ratio);
  await expect(page.locator('#app-view')).toHaveAttribute('data-route','/craft');const saved=await stored(page);expect(saved.story).toMatchObject({nodeId:'craft',revision:1,mode});
  expect(saved.pose).toEqual(first(mode).pose);expect(saved.stage).toEqual(first(mode).stage);expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
});

test('pause, resume, long gap, blur, mode switch and reload never count stopped time',async({page})=>{
  await fakeClock(page);await seed(page,at('training'));await page.goto('/#/story');await ready(page);const token=await node(page).getAttribute('data-token');
  await page.locator('#story-play').click();await advance(page,500);await expect(page.locator('#story-mode')).toBeDisabled();await page.locator('#story-pause').click();
  await advance(page,5000);await expect(node(page)).toHaveAttribute('data-elapsed','500');await page.locator('#story-play').click();await advance(page,100);
  await page.evaluate(()=>Reflect.get(window,'__frame')(251));await expect(node(page)).toContainText('不补算');await expect(node(page)).toHaveAttribute('data-elapsed','600');
  await page.locator('#story-play').click();await advance(page,100);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(node(page)).toHaveAttribute('data-state','paused');
  await page.locator('#story-mode').selectOption('guided');await ready(page);await expect(node(page)).toHaveAttribute('data-elapsed','0');expect(await node(page).getAttribute('data-token')).not.toBe(token);
  await page.evaluate(()=>Reflect.get(window,'__late')());expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
  await page.locator('#story-play').click();await advance(page,100);await page.reload();await ready(page);await expect(node(page)).toHaveAttribute('data-elapsed','0');await expect(page.locator('#story-mode')).toHaveValue('guided');
  const project=await stored(page);expect(project.story!.castSnapshot).toEqual(at('training').story!.castSnapshot);expect(project.story!.nodeId).toBe('training');
});

test('skip is explicit only in intro and interaction, choice and quiet hold cannot auto finish',async({page})=>{
  await fakeClock(page);await seed(page,first());await page.goto('/#/story');await ready(page);await page.locator('#story-skip').click();await expect(page.locator('#app-view')).toHaveAttribute('data-route','/craft');
  expect((await stored(page)).story!.nodeId).toBe('craft');
  for(const id of ['road','approach-choice','reunion-hold'] as const){
    await seed(page,at(id));await page.goto('/#/story');await ready(page);await expect(page.locator('#story-skip')).toBeHidden();
    if(id==='reunion-hold'){await page.locator('#story-play').click();await advance(page,4000);await expect(node(page)).toHaveAttribute('data-elapsed','4000');}
    else if(id==='approach-choice')await expect(page.locator('#story-play')).toBeDisabled();
    else await page.locator('#story-play').click();
    await advance(page,20000);expect((await stored(page)).story!.nodeId).toBe(id);
    if(id==='reunion-hold')await expect(page.locator('#story-finish')).toHaveText('谢幕');else await expect(page.locator('#story-finish')).toBeHidden();
  }
});

test('reduced motion changes still shots with synchronized text and no automatic start',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await fakeClock(page);await seed(page,first());await page.goto('/#/story');await ready(page);
  await expect(node(page)).toHaveAttribute('data-reduced-motion','true');expect(await page.locator('.story-scene-shade').evaluate(el=>getComputedStyle(el).opacity)).toBe('0');
  const before=await hash(page);await page.locator('#story-play').click();await advance(page,3000);expect(await hash(page)).toBe(before);
  await advance(page,1000);await expect(page.locator('#story-subtitles')).toContainText('把母亲带回家');await expect(page.locator('#story-shot')).toContainText('分离');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(node(page)).toHaveAttribute('data-state','paused');
  expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
});

test('failed automatic checkpoint retains the applied frame and exact candidate until explicit retry',async({page})=>{
  await fakeClock(page);const project=at('training');await seed(page,project);await page.goto('/#/story');await ready(page);await failSave(page);
  await page.locator('#story-play').click();await advance(page,12000);await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');
  await expect(node(page)).toHaveAttribute('data-node','training');await expect(node(page)).toHaveAttribute('data-elapsed','12000');expect((await stored(page)).story!.nodeId).toBe('training');
  const writes=await page.evaluate(()=>Reflect.get(window,'__writes'));await advance(page,50000);expect(await page.evaluate(()=>Reflect.get(window,'__writes'))).toBe(writes);
  await page.locator('#retry-save').click();await ready(page);await expect(node(page)).toHaveAttribute('data-node','guardian');expect((await stored(page)).story!.revision).toBe(project.story!.revision+1);
});

test('memory playback never retries storage without confirming the next scene',async({page})=>{
  await fakeClock(page);await seed(page,at('training'));await page.goto('/#/story');await ready(page);await failSave(page);
  await page.locator('#story-mode').selectOption('guided');await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');await page.locator('#continue-memory').click();await ready(page);
  await expect(page.locator('#save-state')).toHaveAttribute('data-state','memory');const writes=await page.evaluate(()=>Reflect.get(window,'__writes'));
  await page.locator('#story-play').click();await advance(page,7000);await expect(page.locator('#story-finish')).toBeVisible();expect(await page.evaluate(()=>Reflect.get(window,'__writes'))).toBe(writes);
  expect((await stored(page)).story!.nodeId).toBe('training');expect((await stored(page)).story!.mode).toBe('full');
  await page.locator('#story-finish').click();await ready(page);await expect(node(page)).toHaveAttribute('data-node','guardian');expect((await stored(page)).story!.mode).toBe('guided');
});

test('canceling a failed scene allows confirmation from the held final frame without replay',async({page})=>{
  await fakeClock(page);await seed(page,at('training'));await page.goto('/#/story');await ready(page);await failSave(page);
  await page.locator('#story-play').click();await advance(page,12000);await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');
  await page.locator('#cancel-pending').click();await expect(page.locator('#story-finish')).toBeVisible();await expect(node(page)).toHaveAttribute('data-elapsed','12000');
  await page.locator('#story-finish').click();await ready(page);await expect(node(page)).toHaveAttribute('data-node','guardian');
});

test('a normal route autosave never interrupts the playing scene',async({page})=>{
  await fakeClock(page);await seed(page,at('training'));await page.goto('/#/museum');await go(page,'/story');await ready(page);
  await page.locator('#story-play').click();await advance(page,100);await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
  await expect(node(page)).toHaveAttribute('data-state','playing');expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(1);
});

test('incoming resource error retains the previous canvas and subtitles and retry swaps only when ready',async({page})=>{
  let fail=true;await page.route(/\/assets\/(?:puppets\/guardian-v1\/head-color\.png|delivery\/guardian-v1-head-color\.webp)(?:\?|$)/,route=>fail?route.abort():route.continue());
  await fakeClock(page);await seed(page,at('training'));await page.goto('/#/story');await ready(page);await page.locator('#story-play').click();await advance(page,12000);
  await expect(node(page)).toHaveAttribute('data-node','guardian');await expect(node(page)).toHaveAttribute('data-state','error');await expect(page.locator('.shadow-stage')).toBeVisible();await expect(page.locator('.shadow-stage')).toHaveAttribute('data-actors','chenxiang');
  await expect(page.locator('#story-shot')).toContainText('得斧');const before=await hash(page),cues=await page.locator('#story-subtitles').textContent();await advance(page,5000);expect(await hash(page)).toBe(before);expect(await page.locator('#story-subtitles').textContent()).toBe(cues);
  fail=false;await page.locator('#story-retry').click();await ready(page);await expect(page.locator('.shadow-stage')).toHaveAttribute('data-actors','chenxiang,guardian');await expect(page.locator('.shadow-stage')).toHaveCount(1);
});

test('ten route exits, reset and late callbacks leave one clock and release all scene listeners',async({page})=>{
  test.setTimeout(90000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await fakeClock(page);await seed(page,at('training'));await page.goto('/#/museum');
  const baseline=await page.evaluate(()=>Reflect.get(window,'__blurCount'));
  for(let i=0;i<10;i++){
    await go(page,'/story');await ready(page);await page.locator('#story-play').click();await advance(page,100);expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(1);
    await page.locator('#story-pause').click();await page.locator('#story-reset').click();await ready(page);await page.locator('#story-play').click();await go(page,'/museum');
    await page.evaluate(()=>Reflect.get(window,'__late')());expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);expect(await page.evaluate(()=>Reflect.get(window,'__blurCount'))).toBe(baseline);await expect(page.locator('.shadow-stage')).toHaveCount(0);
  }
  expect((await stored(page)).story!.nodeId).toBe('training');expect(errors).toEqual([]);
});

test('a late incoming texture after route exit cannot restore the old canvas or advance again',async({page})=>{
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let entered!:()=>void;const requested=new Promise<void>(resolve=>{entered=resolve;});
  await page.route(/\/assets\/(?:puppets\/guardian-v1\/head-color\.png|delivery\/guardian-v1-head-color\.webp)(?:\?|$)/,async route=>{entered();await held;await route.continue().catch(()=>{});});
  await fakeClock(page);await seed(page,at('training'));await page.goto('/#/story');await ready(page);const old=await page.locator('.shadow-stage').elementHandle();
  await page.locator('#story-play').click();await advance(page,12000);await requested;await expect(node(page)).toHaveAttribute('data-state','loading');
  await go(page,'/museum');release();await page.evaluate(()=>Reflect.get(window,'__late')());await expect(page.locator('.shadow-stage')).toHaveCount(0);
  expect(await old!.evaluate((canvas:HTMLCanvasElement)=>({connected:canvas.isConnected,width:canvas.width}))).toEqual({connected:false,width:0});
  await go(page,'/story');await ready(page);await expect(node(page)).toHaveAttribute('data-node','guardian');expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
});

test('legacy entry plays the director in Chromium smoke coverage',async({page})=>{
  await page.route('http://127.0.0.1:4173/',async route=>{const response=await route.fetch();const html=(await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/\snomodule\b/g,'');await route.fulfill({response,body:html});});
  await fakeClock(page);await seed(page,first());await page.goto('/#/story');await ready(page);await expect(page.locator('#app-runtime')).toHaveAttribute('data-entry','legacy');
  await page.locator('#story-play').click();await advance(page,9000);await expect(page.locator('#story-shot')).toContainText('操偶杆');await expect(page.locator('#story-subtitles')).toContainText('你来');
});

test('Canvas failure still exposes the current story and its complete transcript',async({page})=>{
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=(()=>null) as typeof HTMLCanvasElement.prototype.getContext;});
  await seed(page,first());await page.goto('/#/story');await expect(node(page)).toHaveAttribute('data-state','error');await expect(page.locator('#app-view h2')).toContainText('灯');
  await page.getByRole('button',{name:'展开本段完整台词'}).click();await expect(page.locator('#story-transcript p')).toHaveCount(4);await expect(page.locator('#story-play')).toBeDisabled();await expect(page.locator('#story-retry')).toBeVisible();
});
