import {expect,test} from '@playwright/test';
import type {Download,Page} from '@playwright/test';
import type {ProjectV1} from '../../src/domain/types';
import fixtureJSON from '../fixtures/project-v1.json' with {type:'json'};
import future from '../fixtures/unknown-version.json' with {type:'json'};
import corrupt from '../fixtures/corrupt-project.json' with {type:'json'};
import content from '../../src/content/exhibits.json' with {type:'json'};
const fixture=fixtureJSON as ProjectV1;

const saved=async(page:Page)=>expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
const ready=async(page:Page)=>expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');
async function seed(page:Page,project:unknown){await page.goto('/study.html');await page.evaluate(async value=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
},project);}
async function raw(page:Page):Promise<string>{return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const value=await new Promise<string>((resolve,reject)=>{const r=db.transaction('snapshots').objectStore('snapshots').get('draft');r.onsuccess=()=>resolve(r.result as string);r.onerror=()=>reject(r.error);});db.close();return value;
});}
const stored=async(page:Page)=>JSON.parse(await raw(page)) as ProjectV1;
async function go(page:Page,path:string){await page.evaluate(path=>{location.hash=`#${path}`;},path);await expect(page.locator('#app-view')).toHaveAttribute('data-route',path.startsWith('/museum')?'/museum':path);await expect(page.locator('#app-view h1')).toBeVisible();if(path.startsWith('/museum/E'))await expect(page.locator('[aria-current=page][data-exhibit]')).toHaveAttribute('data-exhibit',path.slice(-3));}
async function range(page:Page,id:string,value:number){await page.locator(id).evaluate((input:HTMLInputElement,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);}
async function pixels(page:Page){return page.locator('.shadow-stage').evaluate((canvas:HTMLCanvasElement)=>{
  const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let hash=2166136261;for(const value of data)hash=Math.imul(hash^value,16777619);return hash;
});}
async function downloaded(file:Download){expect(await file.failure()).toBeNull();const chunks:Buffer[]=[];for await(const chunk of await file.createReadStream())chunks.push(Buffer.from(chunk));return JSON.parse(Buffer.concat(chunks).toString('utf8')) as ProjectV1;}
async function exportProject(page:Page){const button=page.locator('#export-project');if(!await button.isVisible())await page.getByRole('button',{name:/我的作品/}).click();const waiting=page.waitForEvent('download');await button.click();return downloaded(await waiting);}
function invariant(actual:ProjectV1,expected:ProjectV1){expect(actual.story).toEqual(expected.story);expect(actual.appearance).toEqual(expected.appearance);expect(actual.pose).toEqual(expected.pose);expect(actual.stage).toEqual(expected.stage);expect(actual.performance).toEqual(expected.performance);}
async function clock(page:Page){await page.addInitScript(()=>{
  let now=0,id=0;const frames=new Map<number,FrameRequestCallback>(),late:FrameRequestCallback[]=[],listeners=new Set<EventListenerOrEventListenerObject>();
  Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=callback=>{frames.set(++id,callback);return id;};window.cancelAnimationFrame=id=>{const callback=frames.get(id);if(callback)late.push(callback);frames.delete(id);};
  Reflect.set(window,'__frame',(delta:number)=>{now+=delta;const batch=[...frames.values()];frames.clear();batch.forEach(callback=>callback(now));});Reflect.set(window,'__late',()=>late.splice(0).forEach(callback=>callback(now)));Object.defineProperty(window,'__rafCount',{get:()=>frames.size});
  const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);
  window.addEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{if(type==='resize'&&(new Error().stack??'').includes('http://127.0.0.1:4173/assets/'))listeners.add(listener);add(type,listener,options);}) as typeof window.addEventListener;
  window.removeEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions)=>{if(type==='resize')listeners.delete(listener);remove(type,listener,options);}) as typeof window.removeEventListener;
  Object.defineProperty(window,'__resizeCount',{get:()=>listeners.size});
});}

test('direct museum opens five sections and all eight sourced exhibits without starting a performance',async({page})=>{
  test.setTimeout(60000);await page.goto('/');await saved(page);await page.getByRole('link',{name:'不急着开演，先逛展馆 →',exact:true}).click();await saved(page);
  await expect(page.locator('.museum-section')).toHaveCount(5);await expect(page.locator('[data-exhibit]')).toHaveCount(8);expect((await stored(page)).museum.visitedExhibitIds).toEqual([]);
  await page.getByRole('button',{name:'一束光',exact:true}).focus();await page.keyboard.press('Enter');await expect(page.locator('#museum-section-2')).toBeFocused();await expect(page).toHaveURL(/#\/museum$/);
  await page.screenshot({path:`docs/evidence/t18-museum-${test.info().project.name.startsWith('desktop')?'desktop':'mobile'}.png`,fullPage:true});
  for(const exhibit of content.exhibits){
    await go(page,`/museum/${exhibit.id}`);await expect(page.locator('#app-view h1')).toHaveText(exhibit.title);await expect(page.locator('.page-lead')).toHaveText(exhibit.summary);
    await expect(page.locator('#exhibit-reading')).toBeHidden();await page.locator('#exhibit-reading-toggle').focus();await page.keyboard.press('Enter');await expect(page.locator('#exhibit-reading')).toBeVisible();await expect(page.locator('.exhibit-detail-copy')).toHaveText(exhibit.detail);
    for(const sourceId of exhibit.sourceIds)await expect(page.locator('#exhibit-reading .source-list')).toContainText(sourceId);
    if(exhibit.id==='E06'){await expect(page.locator('.museum-diagram')).toContainText('灯火');await expect(page.locator('.museum-diagram')).toContainText('不将京剧梗概称为皮影剧本');}
    if(exhibit.id==='E07')await expect(page.locator('.museum-diagram .museum-panel')).toHaveCount(3);
    if(exhibit.id==='E08'){await expect(page.locator('.museum-diagram')).toContainText('张宇翔（SpaceFly）');await expect(page.locator('.museum-programme')).toContainText('尚未开演');await expect(page.getByRole('link',{name:'查看本场节目单 →',exact:true})).toBeHidden();}
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  }
  await saved(page);const result=await stored(page);expect(result.story).toBeNull();expect([...result.museum.visitedExhibitIds].sort()).toEqual(content.exhibits.map(item=>item.id).sort());await page.reload();await saved(page);await expect(page.locator('#museum-visit')).toContainText('已随作品保存');
});

test('layers and real carving are reversible previews of the frozen cast without editing it',async({page})=>{
  await seed(page,fixture);await page.goto('/#/museum/E01');await ready(page);await saved(page);await expect(page.locator('#museum-personal')).toContainText('云纹 / 朱砂');
  await expect(page.locator('#museum-layer-diagram')).toHaveAttribute('data-expanded','false');await page.locator('#museum-layer-toggle').click();await expect(page.locator('#museum-layer-diagram')).toHaveAttribute('data-expanded','true');await expect(page.locator('.museum-demo-layer span').first()).toBeVisible();
  await page.locator('#museum-demo-reset').click();await expect(page.locator('#museum-layer-diagram')).toHaveAttribute('data-expanded','false');
  await go(page,'/museum/E02');await ready(page);const before=await pixels(page);await page.locator('#museum-carve-toggle').click();await expect(page.locator('#museum-carve-toggle')).toHaveAttribute('aria-pressed','true');expect(await pixels(page)).not.toBe(before);
  await page.locator('#museum-demo-reset').click();expect(await pixels(page)).toBe(before);await saved(page);invariant(await stored(page),fixture);
});

test('native keyboard joints and lamp controls change real geometry and the shared light diagram only',async({page})=>{
  await seed(page,fixture);await page.goto('/#/museum/E03');await ready(page);const neutral=await pixels(page);await expect(page.locator('.museum-demo-parts li')).toHaveCount(10);await expect.poll(()=>page.locator('.museum-demo-parts img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0))).toBe(true);
  await page.locator('#museum-shoulder').focus();await page.keyboard.press('End');expect(await pixels(page)).not.toBe(neutral);await page.locator('#museum-demo-reset').click();expect(await pixels(page)).toBe(neutral);
  await go(page,'/museum/E04');await ready(page);const centered=await pixels(page);await page.locator('#museum-distance').focus();await page.keyboard.press('End');await expect(page.locator('#museum-demo-reading')).toContainText('1.50');await expect(page.locator('#museum-reference-shadow-width')).toContainText('0.60');
  const ray=await page.locator('[data-light-ray]').first().getAttribute('y2');await page.locator('#museum-lamp').focus();await page.keyboard.press('Home');expect(await page.locator('[data-light-ray]').first().getAttribute('y2')).not.toBe(ray);expect(await pixels(page)).not.toBe(centered);
  await saved(page);await expect(page.locator('#museum-lamp')).toHaveValue('-0.8');await expect(page.locator('#museum-distance')).toHaveValue('0.4');await page.screenshot({path:`docs/evidence/t18-light-${test.info().project.name.startsWith('desktop')?'desktop':'mobile'}.png`,fullPage:true});
  await page.locator('#museum-demo-reset').click();await expect(page.locator('#museum-lamp')).toHaveValue('0');await expect(page.locator('#museum-distance')).toHaveValue('0.2');expect(await pixels(page)).toBe(centered);await saved(page);invariant(await stored(page),fixture);
});

test('collaboration uses the same wave in two explicit stills and never offers an unavailable audio track',async({page})=>{
  await seed(page,fixture);await page.goto('/#/museum/E05');await ready(page);const before=await pixels(page);await expect(page.locator('.museum-diagram .museum-panel')).toHaveCount(4);
  await page.locator('#museum-wave-toggle').click();expect(await pixels(page)).not.toBe(before);await expect(page.locator('#museum-wave-reading')).toContainText('右臂抬起');await expect(page.locator('audio')).toHaveCount(0);await page.locator('#museum-wave-toggle').click();expect(await pixels(page)).toBe(before);await saved(page);invariant(await stored(page),fixture);
});

test('E08 distinguishes actual in-progress, curtain and completed programmes while keeping the sole creator',async({page})=>{
  for(const nodeId of ['call-light','curtain','completed'] as const){const project=structuredClone(fixture) as ProjectV1;project.story!.nodeId=nodeId;if(nodeId!=='call-light')project.story!.completedAt='2026-10-17T08:00:00.000Z';
    await seed(page,project);await page.goto('/#/museum/E08');await ready(page);await saved(page);await expect(page.locator('.museum-diagram')).toContainText('张宇翔（SpaceFly）');await expect(page.locator('.museum-programme')).toContainText('云纹');await expect(page.locator('.museum-programme')).toContainText('先举灯呼唤');await expect(page.locator('.museum-programme')).toContainText('灯下记得');
    if(nodeId==='call-light')await expect(page.getByRole('link',{name:'查看本场节目单 →',exact:true})).toBeHidden();else {await expect(page.getByRole('link',{name:'查看本场节目单 →',exact:true})).toBeVisible();await expect(page.locator('.museum-programme')).toContainText(nodeId==='curtain'?'谢幕尚未结束':'已经看完');}
    invariant(await stored(page),project);
  }
});

for(const mode of ['full','guided'] as const)for(const approach of ['call-first','split-first'] as const)test(`${mode}/${approach} returns from exhibits to the same paused graphical checkpoint`,async({page})=>{
  const project=structuredClone(fixture) as ProjectV1;Object.assign(project.story!,{mode,approach,nodeId:approach==='call-first'?'call-light':'split-search'});
  await clock(page);await seed(page,project);await page.goto('/#/story');await ready(page);await page.locator('#story-play').click();await range(page,'#story-lamp',-.5);await page.locator('#story-pause').click();
  await go(page,'/museum/E04');await ready(page);await range(page,'#museum-lamp',.7);await range(page,'#museum-distance',.4);await go(page,'/museum/E06');await page.locator('.museum-path').getByRole('link',{name:'回到这一场 →',exact:true}).click();
  await ready(page);await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','paused');await expect(page.locator('#story-runtime')).toHaveAttribute('data-elapsed','0');await expect(page.locator('#story-runtime')).toHaveAttribute('data-node',project.story!.nodeId);await expect(page.locator('#story-lamp')).toHaveValue('0');await saved(page);invariant(await stored(page),project);
});

for(const [name,project,status]of [['future',future,'unsupported'],['corrupt',corrupt,'recovery']] as const)test(`${name} storage is untouched while full knowledge and sample experiments remain available`,async({page})=>{
  await seed(page,project);await page.goto('/#/museum/E02');await expect(page.locator('#save-state')).toHaveAttribute('data-state',status);await ready(page);await page.locator('#museum-carve-toggle').click();
  await go(page,'/museum/E04');await ready(page);await range(page,'#museum-distance',.4);await go(page,'/museum/E06');await page.locator('#exhibit-reading-toggle').click();await expect(page.locator('#exhibit-reading')).toBeVisible();await go(page,'/museum/E08');await ready(page);await expect(page.locator('.museum-diagram')).toContainText('SpaceFly');expect(await raw(page)).toBe(JSON.stringify(project));
});

test('failed visit saving stays honest and later previews or visits never retry writes implicitly',async({page})=>{
  await seed(page,fixture);await page.goto('/#/museum');await saved(page);await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let fail=true,writes=0;IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(key==='draft'){writes++;if(fail){fail=false;throw new DOMException('Injected visit quota','QuotaExceededError');}}return put.call(this,value,key);};Object.defineProperty(window,'__writes',{get:()=>writes});});
  await go(page,'/museum/E02');await ready(page);await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');await expect(page.locator('#museum-visit')).toContainText('未保存');expect((await stored(page)).museum.visitedExhibitIds).not.toContain('E02');
  await page.locator('#museum-carve-toggle').click();await go(page,'/museum/E03');await ready(page);await range(page,'#museum-elbow',.8);await page.waitForTimeout(800);expect(await page.evaluate(()=>Reflect.get(window,'__writes'))).toBe(1);
  const exported=await exportProject(page);expect(exported.museum.visitedExhibitIds).toEqual(expect.arrayContaining(['E02','E03']));invariant(exported,fixture);
  await page.locator('#retry-save').click();await saved(page);expect((await stored(page)).museum.visitedExhibitIds).toEqual(expect.arrayContaining(['E02','E03']));expect(await page.evaluate(()=>Reflect.get(window,'__writes'))).toBe(2);
});

test('memory continuation can visit and export without retrying unavailable storage',async({page})=>{
  await page.addInitScript(()=>{let access=0;Object.defineProperty(window,'indexedDB',{get(){access++;throw new DOMException('Denied museum storage','SecurityError');}});Object.defineProperty(window,'__dbAccess',{get:()=>access});});
  await page.goto('/#/story');await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');await page.locator('#story-start').click();await page.locator('#continue-memory').click();await expect(page.locator('#save-state')).toHaveAttribute('data-state','memory');const before=await page.evaluate(()=>Reflect.get(window,'__dbAccess'));
  await go(page,'/museum/E04');await ready(page);await range(page,'#museum-lamp',.5);await go(page,'/museum/E02');await ready(page);await page.locator('#museum-carve-toggle').click();await page.waitForTimeout(800);expect(await page.evaluate(()=>Reflect.get(window,'__dbAccess'))).toBe(before);const project=await exportProject(page);expect(project.story!.nodeId).toBe('intro');expect(project.museum.visitedExhibitIds).toEqual(['E04','E02']);expect(project.stage.lampX).toBe(0);
});

test('ten exhibit exits release canvases, inputs and every scene clock',async({page})=>{
  test.setTimeout(60000);await clock(page);await seed(page,fixture);await page.goto('/#/museum');await saved(page);const baseline=await page.evaluate(()=>Reflect.get(window,'__resizeCount'));
  for(let i=0;i<10;i++){await go(page,`/museum/${['E01','E02','E03','E04','E05','E08'][i%6]}`);await ready(page);await page.locator('.shadow-stage').evaluate(el=>Reflect.set(window,'__oldMuseumCanvas',el));await go(page,'/museum');
    expect(await page.evaluate(()=>{const canvas=Reflect.get(window,'__oldMuseumCanvas') as HTMLCanvasElement;return[canvas.width,canvas.height];})).toEqual([0,0]);expect(await page.evaluate(()=>Reflect.get(window,'__resizeCount'))).toBe(baseline);expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
  }
  await go(page,'/story');await ready(page);await page.locator('#story-play').click();await go(page,'/museum/E04');await ready(page);await page.evaluate(()=>{Reflect.get(window,'__late')();Reflect.get(window,'__frame')(5000);});await saved(page);expect((await stored(page)).story).toEqual(fixture.story);expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
});

test('importing a different frozen cast clears the old temporary experiment and detached inputs',async({page})=>{
  await seed(page,fixture);await page.goto('/#/museum/E04');await ready(page);await saved(page);await range(page,'#museum-lamp',.7);await range(page,'#museum-distance',.4);
  const oldCanvas=await page.locator('.shadow-stage').elementHandle(),oldInput=await page.locator('#museum-lamp').elementHandle();
  const imported=structuredClone(fixture);imported.story!.runId='fixture-run-2';imported.story!.castSnapshot!.appearance.patternId='flower-v1';imported.story!.castSnapshot!.sharedMotif='flower-v1';
  await page.getByRole('button',{name:/我的作品/}).click();await page.locator('#import-project').setInputFiles({name:'another-cast.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});await saved(page);await expect(page.locator('#app-view')).toHaveAttribute('data-route','/');
  await go(page,'/museum/E04');await ready(page);await expect(page.locator('#museum-personal')).toContainText('花纹');await expect(page.locator('#museum-lamp')).toHaveValue('0');await expect(page.locator('#museum-distance')).toHaveValue('0.2');
  expect(await oldCanvas!.evaluate((canvas:HTMLCanvasElement)=>[canvas.isConnected,canvas.width,canvas.height])).toEqual([false,0,0]);await oldInput!.evaluate((input:HTMLInputElement)=>{input.value='-.6';input.dispatchEvent(new Event('input',{bubbles:true}));});await expect(page.locator('#museum-lamp')).toHaveValue('0');await saved(page);const current=await stored(page);expect(current.story).toEqual(imported.story);expect(current.projectId).not.toBe(fixture.projectId);expect(current.stage).toEqual(fixture.stage);
});

test('failed exhibit images retry for real and late images cannot restore an exited stage',async({page})=>{
  let mode:'missing'|'ready'|'held'='missing',release!:()=>void,entered!:()=>void;
  const held=new Promise<void>(resolve=>{release=resolve;}),requested=new Promise<void>(resolve=>{entered=resolve;});
  await page.route(/\/assets\/(?:puppets\/chenxiang-v1\/head-color\.png|delivery\/chenxiang-v1-head-color\.webp)(?:\?|$)/,async route=>{if(mode==='missing'){await route.abort();return;}if(mode==='held'){entered();await held;}try{await route.continue();}catch(error){if(!page.isClosed())throw error;}});
  await seed(page,fixture);await page.goto('/#/museum/E02');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','error');await page.locator('#exhibit-reading-toggle').click();await expect(page.locator('#exhibit-reading')).toBeVisible();
  mode='ready';await page.getByRole('button',{name:'重试幕面',exact:true}).click();await ready(page);
  mode='held';await page.reload({waitUntil:'domcontentloaded'});await requested;const old=await page.locator('.shadow-stage').elementHandle();await go(page,'/museum/E06');release();await expect(page.locator('.shadow-stage')).toHaveCount(0);expect(await old!.evaluate((canvas:HTMLCanvasElement)=>[canvas.isConnected,canvas.width,canvas.height])).toEqual([false,0,0]);await saved(page);expect((await stored(page)).story).toEqual(fixture.story);
});

test('Canvas failure keeps all exhibit text, sources and navigation usable',async({page})=>{
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=function(){return null;} as typeof HTMLCanvasElement.prototype.getContext;});await page.goto('/#/museum/E04');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','error');await page.locator('#exhibit-reading-toggle').click();await expect(page.locator('#exhibit-reading')).toContainText('简化几何');await expect(page.locator('#museum-light-diagram')).toBeVisible();await go(page,'/museum/E07');await expect(page.locator('.museum-panel')).toHaveCount(3);
});

test('legacy product reads full exhibits and uses the same carving and lamp geometry in Chromium',async({page})=>{
  await page.route('http://127.0.0.1:4173/',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/\snomodule\b/g,'')});});
  await seed(page,fixture);await page.goto('/#/museum/E02');await ready(page);await expect(page.locator('#app-runtime')).toHaveAttribute('data-entry','legacy');const before=await pixels(page);await page.locator('#museum-carve-toggle').click();expect(await pixels(page)).not.toBe(before);await go(page,'/museum/E04');await ready(page);await page.locator('#museum-distance').focus();await page.keyboard.press('End');await expect(page.locator('#museum-reference-shadow-width')).toContainText('0.60');await go(page,'/museum/E06');await page.locator('#exhibit-reading-toggle').click();await expect(page.locator('.source-list')).toContainText('C5');await saved(page);invariant(await stored(page),fixture);
});
