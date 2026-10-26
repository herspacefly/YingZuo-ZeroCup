import {test,expect} from './formal-fixture';
import type { Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { ProjectV1 } from '../../src/domain/types';
import fixtureJSON from '../fixtures/project-v1.json' with {type:'json'};
import future from '../fixtures/unknown-version.json' with {type:'json'};
const fixture=fixtureJSON as ProjectV1;
const spatial=(page:Page)=>page.locator('.spatial-stage').first();
const gpu=(page:Page)=>spatial(page).locator('canvas.three-stage');
const source=(page:Page)=>page.locator('.shadow-stage').first();
const saved=async(page:Page)=>expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
async function seed(page:Page,value:unknown=fixture){await page.goto('/study.html');await page.evaluate(async value=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
},value);}
async function stored(page:Page):Promise<ProjectV1>{return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const value=await new Promise<string>((resolve,reject)=>{const r=db.transaction('snapshots').objectStore('snapshots').get('draft');r.onsuccess=()=>resolve(r.result as string);r.onerror=()=>reject(r.error);});db.close();return JSON.parse(value);
});}
async function go(page:Page,path:string){await page.evaluate(path=>{location.hash='#'+path;},path);await expect(page.locator('#app-view')).toHaveAttribute('data-route',path.startsWith('/museum')?'/museum':path);}
async function open(page:Page){await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready');await spatial(page).locator('.spatial-toggle').click();await expect(spatial(page)).toHaveAttribute('data-state','ready');await expect(gpu(page)).toBeVisible();}
async function hash(page:Page){return source(page).evaluate((canvas:HTMLCanvasElement)=>{const data=canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data;let value=2166136261;for(const byte of data)value=Math.imul(value^byte,16777619);return value;});}
function invariant(actual:ProjectV1,expected:ProjectV1){expect(actual.story).toEqual(expected.story);expect(actual.appearance).toEqual(expected.appearance);expect(actual.stage).toEqual(expected.stage);expect(actual.pose).toEqual(expected.pose);expect(actual.performance).toEqual(expected.performance);}
async function clock(page:Page){await page.addInitScript(()=>{
  let now=0,id=0;const frames=new Map<number,FrameRequestCallback>(),late:FrameRequestCallback[]=[],resizes=new Set<EventListenerOrEventListenerObject>();
  Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};window.cancelAnimationFrame=id=>{const cb=frames.get(id);if(cb)late.push(cb);frames.delete(id);};
  Reflect.set(window,'__frame',(delta:number)=>{now+=delta;const batch=[...frames.values()];frames.clear();batch.forEach(cb=>cb(now));});Reflect.set(window,'__late',()=>late.splice(0).forEach(cb=>cb(now)));Object.defineProperty(window,'__rafCount',{get:()=>frames.size});
  const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window);window.addEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{if(type==='resize'&&(new Error().stack??'').includes('/assets/'))resizes.add(listener);add(type,listener,options);}) as typeof window.addEventListener;window.removeEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions)=>{if(type==='resize')resizes.delete(listener);remove(type,listener,options);}) as typeof window.removeEventListener;Object.defineProperty(window,'__resizeCount',{get:()=>resizes.size});
});}

test('four actual WebGL views share the same two-role Canvas and leave the performance untouched',async({page},info)=>{
  const modules:string[]=[];page.on('request',request=>{if(/\/assets\/renderer-/.test(request.url()))modules.push(request.url());});await seed(page);await page.goto('/#/craft');await saved(page);await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');expect(modules).toEqual([]);expect(await gpu(page).count()).toBe(0);const before=await hash(page);await open(page);
  expect(await gpu(page).evaluate((canvas:HTMLCanvasElement)=>!!canvas.getContext('webgl2'))).toBe(true);await expect(gpu(page)).toHaveAttribute('data-actors','chenxiang,mother');expect(modules.length).toBeGreaterThan(0);const images:Buffer[]=[];
  await mkdir('docs/evidence',{recursive:true});
  for(const view of ['front','workshop','backstage','exhibit']){
    await spatial(page).locator(`button[data-view="${view}"]`).click();await expect(gpu(page)).toHaveAttribute('data-view',view);await expect(spatial(page).locator(`button[data-view="${view}"]`)).toHaveAttribute('aria-pressed','true');images.push(await gpu(page).screenshot());expect(await hash(page)).toBe(before);
    if(view==='front'||view==='backstage')await spatial(page).screenshot({path:`docs/evidence/t06-${view}-${info.project.name.startsWith('mobile')?'mobile':'desktop'}.png`});
  }
  expect(new Set(images.map(value=>value.toString('base64'))).size).toBe(4);await expect(spatial(page).locator('.spatial-exhibit-link')).toHaveCount(7);await spatial(page).locator('.spatial-exhibit-link').first().click();await expect(page).toHaveURL(/#\/museum\/E01$/);await saved(page);invariant(await stored(page),fixture);
});

test('carving, colors and lamp changes update the real spatial resources from the same frame',async({page})=>{
  await seed(page);await page.goto('/#/craft');await open(page);await spatial(page).locator('button[data-view=backstage]').click();const first=await gpu(page).screenshot(),draws=await gpu(page).getAttribute('data-source-draws');await page.locator('#craft-cut-3').click();await expect.poll(()=>gpu(page).getAttribute('data-source-draws')).not.toBe(draws);await expect(spatial(page)).toHaveAttribute('data-state','ready');expect((await gpu(page).screenshot()).equals(first)).toBe(false);
  const carved=await gpu(page).screenshot(),carvedDraws=await gpu(page).getAttribute('data-source-draws');await page.locator('#craft-palette').selectOption('vermilion-v1');await expect.poll(()=>gpu(page).getAttribute('data-source-draws')).not.toBe(carvedDraws);await expect(spatial(page)).toHaveAttribute('data-state','ready');expect((await gpu(page).screenshot()).equals(carved)).toBe(false);
  await go(page,'/light');await open(page);await spatial(page).locator('button[data-view=backstage]').click();await page.locator('#light-lamp').evaluate((input:HTMLInputElement)=>{input.value='.6';input.dispatchEvent(new Event('input',{bubbles:true}));});await expect(gpu(page)).toHaveAttribute('data-lamp-x','0.6');await page.locator('#light-distance').evaluate((input:HTMLInputElement)=>{input.value='.4';input.dispatchEvent(new Event('input',{bubbles:true}));});await expect(gpu(page)).toHaveAttribute('data-puppet-distance','0.4');await saved(page);expect((await stored(page)).story).toEqual(fixture.story);
});

test('weak-device hints enforce the actual buffer and texture budget without removing controls',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(navigator,'deviceMemory',{value:1,configurable:true});Object.defineProperty(navigator,'hardwareConcurrency',{value:1,configurable:true});});await seed(page);await page.goto('/#/craft');await open(page);
  const sizes=await gpu(page).evaluate((canvas:HTMLCanvasElement)=>({width:canvas.width,texture:Number(canvas.dataset.textureWidth),dpr:Number(canvas.dataset.pixelRatio)}));expect(sizes.width).toBeLessThanOrEqual(512);expect(sizes.texture).toBeLessThanOrEqual(512);expect(sizes.dpr).toBeLessThanOrEqual(1);await expect(page.locator('#craft-pattern')).toBeEnabled();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('no WebGL interface keeps the complete 2D editor and never imports Three',async({page})=>{
  await page.addInitScript(()=>{Object.defineProperty(window,'WebGL2RenderingContext',{value:undefined,configurable:true});});const modules:string[]=[];page.on('request',r=>{if(/\/assets\/renderer-/.test(r.url()))modules.push(r.url());});await seed(page);await page.goto('/#/craft');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');await expect(spatial(page).locator('.spatial-toggle')).toBeDisabled();await page.locator('#craft-cut-3').click();await saved(page);expect((await stored(page)).appearance.carvedSegments[2]).toBe(true);expect(modules).toEqual([]);
});

test('renderer initialization failure returns to 2D and an explicit retry really initializes WebGL',async({page})=>{
  await page.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;Reflect.set(window,'__restoreGL',()=>{HTMLCanvasElement.prototype.getContext=get;});HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,id,...args){if(id==='webgl2')return null;return Reflect.apply(get,this,[id,...args]);} as typeof get;});await seed(page);await page.goto('/#/craft');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');const before=await hash(page);await spatial(page).locator('.spatial-toggle').click();await expect(spatial(page)).toHaveAttribute('data-state','error');await expect(spatial(page).locator('.spatial-status')).toContainText('二维');expect(await hash(page)).toBe(before);await page.evaluate(()=>Reflect.get(window,'__restoreGL')());await open(page);await saved(page);invariant(await stored(page),fixture);
});

test('actual context loss releases the old canvas, preserves 2D and allows a fresh context',async({page})=>{
  await seed(page);await page.goto('/#/craft');await open(page);const before=await hash(page);await gpu(page).evaluate((canvas:HTMLCanvasElement)=>{Reflect.set(window,'__oldGpu',canvas);const ext=canvas.getContext('webgl2')!.getExtension('WEBGL_lose_context');if(!ext)throw new Error('Missing context loss test extension');ext.loseContext();});await expect(spatial(page)).toHaveAttribute('data-state','error');expect(await gpu(page).count()).toBe(0);expect(await hash(page)).toBe(before);expect(await page.evaluate(()=>{const canvas=Reflect.get(window,'__oldGpu') as HTMLCanvasElement;return[canvas.width,canvas.height];})).toEqual([0,0]);await open(page);await expect(gpu(page)).toHaveAttribute('data-state','ready');
});

test('a failed dynamic chunk leaves 2D usable and a fresh request can retry the observation',async({page})=>{
  let fail=true,requests=0;await page.route('**/assets/renderer-*.js',route=>{requests++;return fail?route.abort():route.continue();});await seed(page);await page.goto('/#/craft');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');await spatial(page).locator('.spatial-toggle').click();await expect(spatial(page)).toHaveAttribute('data-state','error');await expect(spatial(page).locator('.spatial-status')).toContainText('请刷新页面再试');await expect(page.locator('#craft-pattern')).toBeEnabled();fail=false;await page.reload();await open(page);expect(requests).toBeGreaterThanOrEqual(2);
});

test('closing during a delayed module load prevents a late context and still permits reopening',async({page})=>{
  let release!:()=>void,requested=false;const hold=new Promise<void>(resolve=>{release=resolve;});await page.route('**/assets/renderer-*.js',async route=>{requested=true;await hold;await route.continue();});await seed(page);await page.goto('/#/craft');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');await spatial(page).locator('.spatial-toggle').click();await expect.poll(()=>requested).toBe(true);await spatial(page).locator('.spatial-close').click();release();await page.waitForTimeout(200);expect(await gpu(page).count()).toBe(0);await expect(spatial(page)).toHaveAttribute('data-state','closed');await open(page);
});

test('ten spatial exits release contexts and listeners without creating animation clocks',async({page})=>{
  test.setTimeout(60000);await clock(page);await seed(page);await page.goto('/#/craft');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');const baseline=await page.evaluate(()=>Reflect.get(window,'__resizeCount'));let geometries=0,textures=0;
  for(let i=0;i<10;i++){
    await open(page);const counts=await gpu(page).evaluate((canvas:HTMLCanvasElement)=>{Reflect.set(window,'__oldGpu',canvas);return[Number(canvas.dataset.geometries),Number(canvas.dataset.textures)];});if(!i){geometries=counts[0]!;textures=counts[1]!;}expect(counts).toEqual([geometries,textures]);await spatial(page).locator('.spatial-close').click();expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);expect(await page.evaluate(()=>Reflect.get(window,'__resizeCount'))).toBe(baseline);expect(await page.evaluate(()=>{const canvas=Reflect.get(window,'__oldGpu') as HTMLCanvasElement;return[canvas.width,canvas.height];})).toEqual([0,0]);
  }
  await open(page);await go(page,'/museum');await page.evaluate(()=>Reflect.get(window,'__late')());expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);await saved(page);invariant(await stored(page),fixture);
});

test('a playing story retains one clock while all camera changes stay outside story progress',async({page})=>{
  await clock(page);await seed(page);await page.goto('/#/story');await open(page);await page.locator('#story-play').click();expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(1);await page.evaluate(()=>Reflect.get(window,'__frame')(100));
  for(const view of ['backstage','workshop','exhibit','front']){await spatial(page).locator(`button[data-view=${view}]`).click();await page.evaluate(()=>Reflect.get(window,'__frame')(100));expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(1);}
  await page.locator('#story-pause').click();expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);await saved(page);invariant(await stored(page),fixture);
});

test('protected future records still allow spatial examples without writing the unknown draft',async({page})=>{
  await seed(page,future);await page.goto('/#/museum/E03');await open(page);await spatial(page).locator('button[data-view=backstage]').click();expect(await stored(page)).toEqual(future);
});

test('legacy product keeps every 2D control and never executes the Three chunk',async({page})=>{
  const modules:string[]=[];page.on('request',r=>{if(/\/assets\/renderer-/.test(r.url()))modules.push(r.url());});await page.route('http://127.0.0.1:4173/',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/\snomodule\b/g,'')});});await seed(page);await page.goto('/#/craft');await expect(page.locator('#app-runtime')).toHaveAttribute('data-entry','legacy');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');await expect(spatial(page).locator('.spatial-toggle')).toBeDisabled();expect(modules).toEqual([]);await page.locator('#craft-cut-3').click();await saved(page);
});
