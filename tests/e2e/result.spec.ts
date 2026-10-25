import {test,expect} from './formal-fixture';
import type { Download,Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { ProjectV1 } from '../../src/domain/types';
import fixtureJSON from '../fixtures/project-v1.json' with {type:'json'};
import future from '../fixtures/unknown-version.json' with {type:'json'};
import corrupt from '../fixtures/corrupt-project.json' with {type:'json'};
const fixture=fixtureJSON as ProjectV1;
const copy=<T>(value:T):T=>JSON.parse(JSON.stringify(value)) as T;
function completed(approach:'call-first'|'split-first'='call-first',nodeId:'curtain'|'completed'='completed'){
  const p=copy(fixture);p.appearance.patternId='flower-v1';p.stage.lampX=.8;p.pose.x=.1;
  p.story={...p.story!,nodeId,revision:16,approach,approachSource:'user',completedAt:'2026-10-18T00:00:00.000Z',assistedNodeIds:['road'],presetAppearanceUsed:false};return p;
}
const saved=async(page:Page)=>expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
const ready=async(page:Page)=>expect(page.locator('#result-png')).toBeEnabled();
async function seed(page:Page,value:unknown){await page.goto('/study.html');await page.evaluate(async value=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
},value);}
async function raw(page:Page){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const value=await new Promise<string>((resolve,reject)=>{const r=db.transaction('snapshots').objectStore('snapshots').get('draft');r.onsuccess=()=>resolve(r.result as string);r.onerror=()=>reject(r.error);});db.close();return value;});}
const stored=async(page:Page)=>JSON.parse(await raw(page)) as ProjectV1;
async function go(page:Page,path:string){await page.evaluate(path=>{location.hash='#'+path;},path);await expect(page.locator('#app-view')).toHaveAttribute('data-route',path);}
async function bytes(file:Download){expect(await file.failure()).toBeNull();const chunks:Buffer[]=[];for await(const chunk of await file.createReadStream())chunks.push(Buffer.from(chunk));return Buffer.concat(chunks);}
async function png(page:Page){const wait=page.waitForEvent('download');await page.locator('#result-png').click();return bytes(await wait);}
async function json(page:Page){const wait=page.waitForEvent('download');await page.locator('#result-json').click();return bytes(await wait);}
function invariant(actual:ProjectV1,expected:ProjectV1){expect(actual.story).toEqual(expected.story);expect(actual.appearance).toEqual(expected.appearance);expect(actual.pose).toEqual(expected.pose);expect(actual.stage).toEqual(expected.stage);expect(actual.museum).toEqual(expected.museum);expect(actual.performance).toEqual(expected.performance);}
async function clock(page:Page){await page.addInitScript(()=>{
  let now=0,id=0;const frames=new Map<number,FrameRequestCallback>(),late:FrameRequestCallback[]=[];
  Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};window.cancelAnimationFrame=id=>{const cb=frames.get(id);if(cb)late.push(cb);frames.delete(id);};
  Reflect.set(window,'__frame',(delta:number)=>{now+=delta;const batch=[...frames.values()];frames.clear();batch.forEach(cb=>cb(now));});Reflect.set(window,'__late',()=>late.splice(0).forEach(cb=>cb(now)));Object.defineProperty(window,'__rafCount',{get:()=>frames.size});
});}
const frame=async(page:Page,delta=100)=>page.evaluate(delta=>Reflect.get(window,'__frame')(delta),delta);
async function openReplay(page:Page){await page.locator('#result-replay').click();await expect(page.locator('#result-replay-player .canvas-stage-status')).toHaveAttribute('data-state','ready',{timeout:15000});}

test('unfinished and protected records never manufacture a reunion or offer result downloads',async({page})=>{
  for(const p of [{...copy(fixture),story:null},fixture,future,corrupt]){
    await seed(page,p);await page.goto('/#/result');await expect(page.locator('#app-view h1')).toHaveText('这一场，还在路上。');
    await expect(page.locator('#result-png')).toBeHidden();await expect(page.locator('#result-json')).toBeHidden();await expect(page.locator('#result-replay')).toBeHidden();await expect(page.locator('#result-capture canvas')).toHaveCount(0);
    if(p===future||p===corrupt)expect(JSON.parse(await raw(page))).toEqual(p);else{await saved(page);expect((await stored(page)).story).toEqual((p as ProjectV1).story);}
  }
});

for(const approach of ['call-first','split-first'] as const)test(`${approach} exports a real frozen 1600x1200 PNG twice and an unchanged programme`,async({page},info)=>{
  const project=completed(approach,approach==='call-first'?'curtain':'completed');await seed(page,project);await page.goto('/#/result');await saved(page);await ready(page);
  await expect(page.locator('.programme-list')).toContainText(approach==='call-first'?'先举灯呼唤':'先挥斧开山');await expect(page.locator('.programme-list')).toContainText('张宇翔（SpaceFly）');
  await expect(page.locator('#result-id')).toHaveText('本场成果 · '+project.story!.runId+':reunion');
  const first=await png(page),second=await png(page);expect(first.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));expect(first.readUInt32BE(16)).toBe(1600);expect(first.readUInt32BE(20)).toBe(1200);expect(second.equals(first)).toBe(true);
  const pixels=await page.evaluate(async base64=>{const image=new Image();image.src='data:image/png;base64,'+base64;await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('PNG decoding failed'));});const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d')!;ctx.drawImage(image,0,0);const values=new Set<number>();const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;for(let i=0;i<data.length;i+=64)values.add(data[i]!<<16|data[i+1]!<<8|data[i+2]!);return values.size;},first.toString('base64'));expect(pixels).toBeGreaterThan(20);
  invariant(await stored(page),project);await expect(page.locator('#result-operation')).toContainText('已向浏览器请求下载 PNG');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(approach==='call-first'){await mkdir('docs/evidence',{recursive:true});await page.screenshot({path:`docs/evidence/t09-result-${info.project.name.startsWith('mobile')?'mobile':'desktop'}.png`,fullPage:true});}
});

for(const approach of ['call-first','split-first'] as const)test(`${approach} replay is paused, follows only the saved branch and cannot edit the performance`,async({page},info)=>{
  test.setTimeout(60000);await clock(page);const project=completed(approach);await seed(page,project);await page.goto('/#/result');await ready(page);await openReplay(page);
  await expect(page.locator('#replay-status')).toContainText('已暂停');expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
  const options=await page.locator('#replay-segment option').allTextContents();expect(options).toHaveLength(14);
  await page.locator('#replay-segment').selectOption('2');
  await expect(page.locator('#result-replay-player .canvas-stage-status')).toHaveAttribute('data-state','ready',{timeout:15000});await page.locator('#replay-play').click();await frame(page);await frame(page);await expect(page.locator('#replay-status')).toContainText('播放中');
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(page.locator('#replay-status')).toContainText('已暂停');expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
  await page.locator('#replay-play').click();await frame(page,300);await expect(page.locator('#replay-status')).toContainText('页面停顿较久');
  for(let index=0;index<options.length;index++){
    await page.locator('#replay-segment').selectOption(String(index));await expect(page.locator('#result-replay-player .canvas-stage-status')).toHaveAttribute('data-state','ready',{timeout:15000});await page.locator('#replay-play').click();await frame(page,200);await page.locator('#replay-pause').click();
  }
  await page.getByRole('button',{name:'展开本段完整台词',exact:true}).click();await expect(page.locator('#result-replay-player #story-transcript')).toBeVisible();
  await saved(page);invariant(await stored(page),project);
  await page.locator('#replay-reset').click();await expect(page.locator('#replay-status')).toContainText('片段 1/14');
  if(approach==='call-first')await page.screenshot({path:`docs/evidence/t09-replay-${info.project.name.startsWith('mobile')?'mobile':'desktop'}.png`,fullPage:true});
});

test('SAVE-03 JSON into a fresh browser preserves result identity, frozen PNG and replay decisions',async({page,browser})=>{
  test.setTimeout(90000);
  const project=completed('split-first');await seed(page,project);await page.goto('/#/result');await ready(page);const first=await png(page),file=await json(page);invariant(JSON.parse(file.toString('utf8')),project);
  const context=await browser.newContext({viewport:page.viewportSize()!});const other=await context.newPage();
  try{await other.goto('/');await saved(other);await other.getByRole('button',{name:/我的作品/}).click();await other.locator('#import-project').setInputFiles({name:'reunion.json',mimeType:'application/json',buffer:file});await expect.poll(async()=>(await stored(other)).story?.runId).toBe(project.story!.runId);await saved(other);await go(other,'/result');await ready(other);
    const imported=await stored(other);expect(imported.projectId).not.toBe(project.projectId);invariant(imported,project);await expect(other.locator('#result-id')).toHaveText('本场成果 · '+project.story!.runId+':reunion');expect((await png(other)).equals(first)).toBe(true);await openReplay(other);await expect(other.locator('#replay-status')).toContainText('已暂停');
  }finally{await context.close();}
});

test('reduced motion uses explicit still steps and clears every replay callback on ten route exits',async({page})=>{
  test.setTimeout(90000);await clock(page);await page.emulateMedia({reducedMotion:'reduce'});const project=completed();await seed(page,project);await page.goto('/#/result');await ready(page);await openReplay(page);
  await expect(page.locator('#replay-play')).toBeDisabled();await page.locator('#replay-step').click();await expect(page.locator('#replay-status')).toContainText('0.3 秒');expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
  await page.emulateMedia({reducedMotion:'no-preference'});
  for(let i=0;i<10;i++){
    if(i){await go(page,'/result');await ready(page);await openReplay(page);}
    await page.locator('#replay-play').click();await frame(page);await page.evaluate(()=>Reflect.set(window,'__oldCanvases',[...document.querySelectorAll<HTMLCanvasElement>('#result-capture canvas,#result-replay-player canvas')]));await go(page,'/museum');await page.evaluate(()=>Reflect.get(window,'__late')());await frame(page);
    expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);expect(await page.evaluate(()=>(Reflect.get(window,'__oldCanvases') as HTMLCanvasElement[]).every(canvas=>canvas.width===0&&canvas.height===0))).toBe(true);
  }
  await saved(page);invariant(await stored(page),project);
});

test('a missing required mask fails the image truthfully and retry loads the actual asset',async({page})=>{
  let fail=true;await page.route(/\/assets\/(?:puppets\/chenxiang-v1\/head-color\.png|delivery\/chenxiang-v1-head-color\.webp)(?:\?|$)/,route=>fail?route.abort():route.continue());await seed(page,completed());await page.goto('/#/result');
  await expect(page.locator('#result-operation')).toContainText('留影暂未就绪');await expect(page.locator('#result-png')).toBeDisabled();fail=false;await page.locator('#result-retry').click();await ready(page);expect((await png(page)).readUInt32BE(16)).toBe(1600);
});

test('PNG encoding rejection and browser refusal report failure, while JSON remains available',async({page})=>{
  await page.addInitScript(()=>{Reflect.set(window,'__toBlob',HTMLCanvasElement.prototype.toBlob);HTMLCanvasElement.prototype.toBlob=function(callback){callback(null);};});await seed(page,completed());await page.goto('/#/result');await ready(page);
  await page.locator('#result-png').click();await expect(page.locator('#result-operation')).toContainText('PNG 下载未完成');await expect(page.locator('#result-png')).toBeEnabled();expect(JSON.parse((await json(page)).toString('utf8')).story.completedAt).toBe('2026-10-18T00:00:00.000Z');
  await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=Reflect.get(window,'__toBlob');Reflect.set(navigator,'msSaveOrOpenBlob',()=>false);});await page.locator('#result-png').click();await expect(page.locator('#result-operation')).toContainText('浏览器拒绝');
});

test('late PNG encoding after exit cannot download or replace the new page',async({page})=>{
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.toBlob=function(callback){Reflect.set(window,'__encoded',()=>callback(new Blob(['late'],{type:'image/png'})));};Reflect.set(window,'__downloadCount',0);const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)Reflect.set(window,'__downloadCount',Reflect.get(window,'__downloadCount')+1);return click.call(this);};});
  await seed(page,completed());await page.goto('/#/result');await ready(page);await page.locator('#result-png').click();await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,'__encoded'))).toBe('function');await go(page,'/museum');await page.evaluate(()=>Reflect.get(window,'__encoded')());expect(await page.evaluate(()=>Reflect.get(window,'__downloadCount'))).toBe(0);await expect(page.locator('#app-view h1')).toContainText('一张皮，一束光，千年戏。');
});

test('Canvas failure keeps programme, JSON and replay transcript without reporting a successful image',async({page})=>{
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=(()=>null) as typeof HTMLCanvasElement.prototype.getContext;});await seed(page,completed());await page.goto('/#/result');await expect(page.locator('#result-operation')).toContainText('留影暂未就绪');await expect(page.locator('#result-png')).toBeDisabled();expect((await json(page)).length).toBeGreaterThan(100);await page.locator('#result-replay').click();await expect(page.locator('#replay-play')).toBeDisabled();await page.getByRole('button',{name:'展开本段完整台词',exact:true}).click();await expect(page.locator('#result-replay-player #story-transcript')).toBeVisible();
});

test('legacy PNG encoding fallback produces a real file and all download URLs are released',async({page})=>{
  await page.addInitScript(()=>{
    Object.defineProperty(HTMLCanvasElement.prototype,'toBlob',{value:undefined,configurable:true});
    Reflect.set(HTMLCanvasElement.prototype,'msToBlob',function(this:HTMLCanvasElement){const binary=atob(this.toDataURL('image/png').split(',')[1]!);return new Blob([Uint8Array.from(binary,char=>char.charCodeAt(0))],{type:'image/png'});});
    const urls=new Set<string>(),create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);URL.createObjectURL=blob=>{const url=create(blob);urls.add(url);return url;};URL.revokeObjectURL=url=>{urls.delete(url);revoke(url);};Object.defineProperty(window,'__urlCount',{get:()=>urls.size});
  });
  await seed(page,completed());await page.goto('/#/result');await ready(page);const image=await png(page);expect(image.readUInt32BE(16)).toBe(1600);expect(image.readUInt32BE(20)).toBe(1200);await go(page,'/museum');expect(await page.evaluate(()=>Reflect.get(window,'__urlCount'))).toBe(0);
});

test('failed autosaving still exports the actual reunited draft and replay never retries disk implicitly',async({page})=>{
  const project=completed();await seed(page,project);await page.goto('/#/museum');await saved(page);
  await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let writes=0;IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(key==='draft'){writes++;throw new DOMException('Result quota failure','QuotaExceededError');}return put.call(this,value,key);};Object.defineProperty(window,'__writes',{get:()=>writes});});
  await go(page,'/result');await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');await ready(page);await expect(page.locator('#result-save-note')).toContainText('未保存');invariant(JSON.parse((await json(page)).toString('utf8')),project);expect((await png(page)).readUInt32BE(16)).toBe(1600);await openReplay(page);await page.locator('#replay-next').click();await page.waitForTimeout(800);expect(await page.evaluate(()=>Reflect.get(window,'__writes'))).toBe(1);invariant(await stored(page),project);
  await go(page,'/story');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready',{timeout:15000});await page.locator('#story-mode').selectOption('guided');await expect(page.locator('#continue-memory')).toBeEnabled();await page.locator('#continue-memory').click();await expect(page.locator('#save-state')).toHaveAttribute('data-state','memory');const writes=await page.evaluate(()=>Reflect.get(window,'__writes'));
  await go(page,'/result');await ready(page);const memory=JSON.parse((await json(page)).toString('utf8')) as ProjectV1;expect(memory.story!.mode).toBe('guided');expect(memory.story!.completedAt).toBe(project.story!.completedAt);expect(memory.story!.runId).toBe(project.story!.runId);await openReplay(page);await page.locator('#replay-next').click();await page.waitForTimeout(800);expect(await page.evaluate(()=>Reflect.get(window,'__writes'))).toBe(writes);await expect(page.locator('#save-state')).toHaveAttribute('data-state','memory');
});

test('late required images after result exit cannot resurrect the capture or its download action',async({page})=>{
  let release!:()=>void;const hold=new Promise<void>(resolve=>{release=resolve;});let requested=false;
  await page.route(/\/assets\/(?:puppets\/chenxiang-v1\/head-color\.png|delivery\/chenxiang-v1-head-color\.webp)(?:\?|$)/,async route=>{requested=true;await hold;await route.continue();});await seed(page,completed());await page.goto('/#/result');await expect.poll(()=>requested).toBe(true);await expect(page.locator('#result-png')).toBeDisabled();await page.locator('#result-capture canvas.reunion-artifact').evaluate(canvas=>Reflect.set(window,'__oldImage',canvas));await go(page,'/museum');release();await page.waitForTimeout(200);await expect(page.locator('#result-capture')).toHaveCount(0);expect(await page.evaluate(()=>{const canvas=Reflect.get(window,'__oldImage') as HTMLCanvasElement;return[canvas.width,canvas.height];})).toEqual([0,0]);
});

test('a PNG finishing during a pending file import cannot download the previous project',async({page})=>{
  await page.addInitScript(()=>{
    const read=FileReader.prototype.readAsText;FileReader.prototype.readAsText=function(file,encoding){Reflect.set(window,'__finishImport',()=>read.call(this,file,encoding));};
    HTMLCanvasElement.prototype.toBlob=function(callback){Reflect.set(window,'__encoded',()=>callback(new Blob(['held PNG'],{type:'image/png'})));};
    Reflect.set(window,'__downloadCount',0);const click=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){if(this.download)Reflect.set(window,'__downloadCount',Reflect.get(window,'__downloadCount')+1);return click.call(this);};
  });
  await seed(page,completed());await page.goto('/#/result');await ready(page);await page.locator('#result-png').click();await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,'__encoded'))).toBe('function');
  const imported=completed('split-first');imported.story!.runId='imported-reunion-run';await page.getByRole('button',{name:/我的作品/}).click();await page.locator('#import-project').setInputFiles({name:'new-run.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});await expect.poll(()=>page.evaluate(()=>typeof Reflect.get(window,'__finishImport'))).toBe('function');
  await page.evaluate(()=>Reflect.get(window,'__encoded')());await expect(page.locator('#result-operation')).toContainText('作品正在导入或处理');expect(await page.evaluate(()=>Reflect.get(window,'__downloadCount'))).toBe(0);
  await page.evaluate(()=>Reflect.get(window,'__finishImport')());await expect.poll(async()=>(await stored(page)).story?.runId).toBe(imported.story!.runId);await saved(page);await go(page,'/result');await ready(page);await expect(page.locator('#result-id')).toHaveText('本场成果 · imported-reunion-run:reunion');
});

test('legacy product exports PNG and plays a read-only frozen scene through the same modules',async({page})=>{
  await clock(page);await page.route('http://127.0.0.1:4173/',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/\snomodule\b/g,'')});});await seed(page,completed());await page.goto('/#/result');await ready(page);await expect(page.locator('#app-runtime')).toHaveAttribute('data-entry','legacy');expect((await png(page)).readUInt32BE(20)).toBe(1200);await openReplay(page);await page.locator('#replay-play').click();await frame(page);await expect(page.locator('#replay-status')).toContainText('播放中');
});
