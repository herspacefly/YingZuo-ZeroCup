import { expect,test } from '@playwright/test';
import type { Download,Page } from '@playwright/test';
import type { ProjectV1 } from '../../src/domain/types';
import chenxiang from '../../src/content/puppets/chenxiang-v1.json' with {type:'json'};
import type { PuppetTemplate } from '../../src/content/asset-types';
import { projectedPoseBounds } from '../../src/domain/pose';
import fixture from '../fixtures/project-v1.json' with {type:'json'};
const ready=async(page:Page)=>{await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');await expect(page.locator('#practice-play')).toBeEnabled();};
const saved=async(page:Page)=>expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
async function seed(page:Page){await page.goto('/study.html');await page.evaluate(async project=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(project),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
},fixture);}
async function stored(page:Page):Promise<ProjectV1>{return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const value=await new Promise<string>((resolve,reject)=>{const r=db.transaction('snapshots').objectStore('snapshots').get('draft');r.onsuccess=()=>resolve(r.result as string);r.onerror=()=>reject(r.error);});db.close();return JSON.parse(value);
});}
async function frame(page:Page,delta:number){await page.evaluate(delta=>Reflect.get(window,'__frame')(delta),delta);}
async function fakeClock(page:Page){await page.addInitScript(()=>{
  let now=0,id=0,callbacks=new Map<number,FrameRequestCallback>();Object.defineProperty(performance,'now',{value:()=>now});
  window.requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};window.cancelAnimationFrame=key=>{callbacks.delete(key);};
  Reflect.set(window,'__frame',(delta:number)=>{now+=delta;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(callback=>callback(now));});Object.defineProperty(window,'__rafCount',{get:()=>callbacks.size});
});}
async function range(page:Page,id:string,value:string,change=true){await page.locator(id).evaluate((input:HTMLInputElement,{value,change})=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));if(change)input.dispatchEvent(new Event('change',{bubbles:true}));},{value,change});}
async function readDownload(download:Download){expect(await download.failure()).toBeNull();const stream=await download.createReadStream(),chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));return JSON.parse(Buffer.concat(chunks).toString('utf8')) as ProjectV1;}
async function go(page:Page,path:string){await page.evaluate(path=>{location.hash=`#${path}`;},path);await expect(page.locator('#app-view')).toHaveAttribute('data-route',path);}

test('all three real mouse grips change pose and reload saves the final editor without touching story',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await seed(page);await page.goto('/#/practice');await ready(page);
  const before=(await stored(page)).pose;
  for(const [rod,dx,dy]of [['body',24,-8],['leftHand',-16,-12],['rightHand',16,-12]] as const){
    const handle=page.locator(`[data-rod="${rod}"]`);await handle.scrollIntoViewIfNeeded();const box=(await handle.boundingBox())!;
    await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:4});await page.mouse.up();
    await expect(page.locator('#practice-runtime')).toHaveAttribute('data-state','paused');
  }
  await saved(page);const project=await stored(page);expect(project.pose).not.toEqual(before);expect(project.pose.joints.leftShoulder).not.toBe(0);expect(project.pose.joints.rightShoulder).not.toBe(0);
  expect(project.story).toEqual(fixture.story);expect(project.performance).toBeNull();expect(project.partialRecording).toBeNull();
  await page.reload();await ready(page);await expect(page.locator('#practice-runtime')).toHaveAttribute('data-state','paused');expect(Number(await page.locator('#practice-x').inputValue())).toBeCloseTo(project.pose.x,2);
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('quick input-only trailing save and native change keep the final range and facing on reload',async({page})=>{
  await page.goto('/#/practice');await ready(page);await range(page,'#practice-x','.52',false);await range(page,'#practice-x','.57',false);
  await expect.poll(async()=>(await stored(page)).pose.x).toBeCloseTo(.57,5);
  await range(page,'#practice-x','.59');await page.locator('#practice-facing').selectOption('-1');await saved(page);
  await page.reload();await ready(page);await expect(page.locator('#practice-x')).toHaveValue('.59'.replace(/^\./,'0.'));await expect(page.locator('#practice-facing')).toHaveValue('-1');
});

test('grip arrow keys use one clock, key release/blur stop motion and native range arrows still work',async({page})=>{
  await fakeClock(page);await page.goto('/#/practice');await ready(page);const grip=page.locator('[data-rod="body"]');await grip.focus();
  const before=Number(await page.locator('#practice-x').inputValue());await page.keyboard.down('ArrowRight');await frame(page,100);await expect(page.locator('#practice-runtime')).toHaveAttribute('data-state','moving');
  expect(Number(await page.locator('#practice-x').inputValue())).toBeGreaterThan(before);await page.keyboard.up('ArrowRight');expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
  await page.keyboard.down('ArrowRight');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const stopped=await page.locator('#practice-x').inputValue();await frame(page,100);expect(await page.locator('#practice-x').inputValue()).toBe(stopped);await page.keyboard.up('ArrowRight');
  await page.locator('#practice-x').focus();await page.keyboard.press('ArrowLeft');expect(Number(await page.locator('#practice-x').inputValue())).toBeLessThan(Number(stopped));expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
  await page.locator('#practice-rod').selectOption('rightHand');await expect(page.locator('#practice-rod')).toHaveValue('rightHand');
});

test('action selection, pause/resume, hidden page and long gaps retain time without catch-up',async({page})=>{
  await fakeClock(page);await page.goto('/#/practice');await ready(page);await page.locator('#practice-action').selectOption('walk-v1');await expect(page.locator('#practice-action')).toHaveValue('walk-v1');
  await page.locator('#practice-play').click();for(let i=0;i<5;i++)await frame(page,100);await expect(page.locator('#practice-runtime')).toHaveAttribute('data-elapsed','500');
  await page.locator('#practice-pause').click();await frame(page,5000);await expect(page.locator('#practice-runtime')).toHaveAttribute('data-elapsed','500');
  await page.locator('#practice-resume').click();await frame(page,100);await expect(page.locator('#practice-runtime')).toHaveAttribute('data-elapsed','600');
  await frame(page,251);await expect(page.locator('#practice-runtime')).toHaveAttribute('data-state','paused');await expect(page.locator('#practice-runtime')).toContainText('不补算');
  await page.locator('#practice-resume').click();await frame(page,100);await expect(page.locator('#practice-runtime')).toHaveAttribute('data-elapsed','700');
  await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.locator('#practice-runtime')).toHaveAttribute('data-state','paused');expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
});

test('all five actions step visibly, keep the axe within the curtain and do not start a story',async({page})=>{
  await fakeClock(page);await page.goto('/#/practice');await ready(page);
  for(const id of ['wave-v1','walk-v1','bow-v1','raise-axe-v1','reach-v1']){
    await page.locator('#practice-reset').click();await page.locator('#practice-action').selectOption(id);await ready(page);const draws=Number(await page.locator('.shadow-stage').getAttribute('data-draws'));
    await page.locator('#practice-step').click();await expect(page.locator('#practice-runtime')).toHaveAttribute('data-elapsed','250');expect(Number(await page.locator('.shadow-stage').getAttribute('data-draws'))).toBeGreaterThan(draws);
  }
  await saved(page);expect((await stored(page)).story).toBeNull();expect((await stored(page)).performance).toBeNull();
  await page.locator('#practice-action').selectOption('wave-v1');await range(page,'#practice-x','1');await page.locator('#practice-action').selectOption('raise-axe-v1');await ready(page);await saved(page);
  const selected=await stored(page),bounds=projectedPoseBounds(chenxiang as PuppetTemplate,selected.pose,selected.stage,['axe']);
  expect(bounds.minX).toBeGreaterThanOrEqual(-.960001);expect(bounds.maxX).toBeLessThanOrEqual(.960001);expect(bounds.minY).toBeGreaterThanOrEqual(-.710001);expect(bounds.maxY).toBeLessThanOrEqual(.710001);
  await page.locator('#practice-play').click();for(let i=0;i<30;i++)await frame(page,100);await expect(page.locator('#practice-runtime')).toHaveAttribute('data-state','paused');await saved(page);expect((await stored(page)).pose.scale).toBeGreaterThanOrEqual(.6);
});

test('reduced motion uses explicit 250ms steps and never launches a loop',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await fakeClock(page);await page.goto('/#/practice');await ready(page);await page.locator('#practice-play').click();
  await expect(page.locator('#practice-runtime')).toContainText('减少动态');expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
  await page.locator('#practice-step').click();await expect(page.locator('#practice-runtime')).toHaveAttribute('data-elapsed','250');await expect(page.locator('#practice-resume')).toBeDisabled();
});

test('actual touch drag cancels cleanly and fallback touch handles unrelated identifiers and multiple ends',async({page,context})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto('/#/practice');await ready(page);const grip=page.locator('[data-rod="body"]');await grip.scrollIntoViewIfNeeded();let box=(await grip.boundingBox())!;
  const cdp=await context.newCDPSession(page),x=box.x+24,y=box.y+24,before=Number(await page.locator('#practice-x').inputValue());
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+25,y:y-5}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  expect(Number(await page.locator('#practice-x').inputValue())).toBeGreaterThan(before);await expect(page.locator('#practice-runtime')).toHaveAttribute('data-state','paused');await cdp.detach();
  await page.addInitScript(()=>Object.defineProperty(window,'PointerEvent',{value:undefined,configurable:true}));await page.reload();await ready(page);box=(await grip.boundingBox())!;
  const dispatch=async(type:string,target:'handle'|'window',points:{identifier:number;clientX:number;clientY:number}[])=>page.evaluate(({type,target,points})=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,'changedTouches',{value:points});(target==='handle'?document.querySelector('[data-rod="body"]')!:window).dispatchEvent(event);},{type,target,points});
  const point={identifier:7,clientX:box.x+24,clientY:box.y+24};await dispatch('touchstart','handle',[point]);const old=await page.locator('#practice-x').inputValue();await dispatch('touchmove','window',[{...point,identifier:9,clientX:point.clientX+40}]);expect(await page.locator('#practice-x').inputValue()).toBe(old);
  await dispatch('touchmove','window',[{...point,clientX:point.clientX+20}]);expect(await page.locator('#practice-x').inputValue()).not.toBe(old);
  await dispatch('touchcancel','window',[point,{...point,identifier:9}]);await expect(page.locator('#practice-runtime')).toHaveAttribute('data-state','paused');expect(errors).toEqual([]);
});

test('import during an action archives the latest old pose and never overwrites the new project',async({page})=>{
  await fakeClock(page);await page.goto('/#/practice');await ready(page);await page.locator('#practice-action').selectOption('walk-v1');await page.locator('#practice-play').click();await frame(page,100);const latest=Number(await page.locator('#practice-x').inputValue());
  await page.getByRole('button',{name:/我的作品/}).click();await page.getByLabel('导入作品 JSON').setInputFiles({name:'project.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});await expect(page.locator('#app-view')).toHaveAttribute('data-route','/');await saved(page);
  const imported=await stored(page);expect(imported.pose).toEqual(fixture.pose);expect(imported.story).toEqual(fixture.story);await frame(page,100);expect((await stored(page)).pose).toEqual(fixture.pose);expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
  const previous=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>resolve(r.result);});const result=await new Promise<string>(resolve=>{const r=db.transaction('snapshots').objectStore('snapshots').get('previous-project');r.onsuccess=()=>resolve(r.result as string);});db.close();return JSON.parse(result);});expect(previous.pose.x).toBeCloseTo(latest,2);
});

test('save failure keeps the final pose exportable and automatic input never retries disk writes',async({page})=>{
  await page.goto('/#/practice');await ready(page);await saved(page);await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let writes=0;IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(key==='draft'){writes++;throw new DOMException('Injected quota','QuotaExceededError');}return put.call(this,value,key);};Object.defineProperty(window,'__writes',{get:()=>writes});});
  await range(page,'#practice-x','.58');await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');const count=await page.evaluate(()=>Reflect.get(window,'__writes'));
  await range(page,'#practice-x','.61');await page.locator('#practice-facing').selectOption('-1');await page.waitForTimeout(650);expect(await page.evaluate(()=>Reflect.get(window,'__writes'))).toBe(count);
  const downloading=page.waitForEvent('download');await page.locator('#export-project').click();const candidate=await readDownload(await downloading);expect(candidate.pose.x).toBeCloseTo(.61,5);expect(candidate.pose.facing).toBe(-1);
  expect((await stored(page)).pose.x).not.toBe(.61);
});

test('memory-only progress stays memory after practice until an explicit save',async({page})=>{
  await page.goto('/');await saved(page);await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let fail=true;IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(fail&&key==='draft'){fail=false;throw new DOMException('Injected quota','QuotaExceededError');}return put.call(this,value,key);};});
  await page.getByRole('button',{name:'节选导览',exact:true}).click();await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');await page.locator('#continue-memory').click();await expect(page.locator('#save-state')).toHaveAttribute('data-state','memory');
  await go(page,'/practice');await ready(page);await range(page,'#practice-x','.57');await page.getByRole('button',{name:'向右',exact:true}).click();await go(page,'/museum');await page.waitForTimeout(650);await expect(page.locator('#save-state')).toHaveAttribute('data-state','memory');
  await go(page,'/practice');await ready(page);await page.locator('#practice-save').click();await saved(page);expect((await stored(page)).story?.nodeId).toBe('intro');
});

test('Canvas failure disables input and ten playing remounts clear every practice callback',async({page})=>{
  await fakeClock(page);await page.addInitScript(()=>{
    const active=new Map<string,Set<EventListenerOrEventListenerObject>>();for(const [prefix,target] of [['w',window],['d',document]] as const){const add=target.addEventListener.bind(target),remove=target.removeEventListener.bind(target);
      // Count application listeners by their bundle origin, excluding Playwright's late hit-target hooks.
      target.addEventListener=((name:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{if((new Error().stack??'').includes('http://127.0.0.1:4173/assets/')){const key=prefix+name;if(!active.has(key))active.set(key,new Set());active.get(key)!.add(listener);}add(name,listener,options);}) as typeof target.addEventListener;
      target.removeEventListener=((name:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions)=>{active.get(prefix+name)?.delete(listener);remove(name,listener,options);}) as typeof target.removeEventListener;}
    Reflect.set(window,'__listenerDetails',()=>[...active].filter(([name])=>/resize|pointer|mouse|touch|blur|keyup|visibility/.test(name)).map(([name,items])=>({name,items:[...items].map(item=>String(item).slice(0,150))})));
    Reflect.set(window,'__listeners',()=>[...active].filter(([name])=>/resize|pointer|mouse|touch|blur|keyup|visibility/.test(name)).reduce((sum,[,items])=>sum+items.size,0));
  });
  await page.goto('/');await saved(page);const baseline=await page.evaluate(()=>Reflect.get(window,'__listeners')());
  for(let i=0;i<10;i++){await go(page,'/practice');await ready(page);expect(await page.evaluate(()=>Reflect.get(window,'__listeners')())).toBeGreaterThan(baseline);const old=await page.locator('.shadow-stage').elementHandle();await page.locator('#practice-play').click();await frame(page,16);await go(page,'/museum');expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);expect(await old!.evaluate((canvas:HTMLCanvasElement)=>({connected:canvas.isConnected,width:canvas.width}))).toEqual({connected:false,width:0});}
  expect(await page.evaluate(()=>Reflect.get(window,'__listeners')()),JSON.stringify(await page.evaluate(()=>Reflect.get(window,'__listenerDetails')()))).toBe(baseline);
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=(()=>null) as typeof HTMLCanvasElement.prototype.getContext;});await page.goto('/#/practice');await page.reload();await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','error');await expect(page.locator('#practice-play')).toBeDisabled();await expect(page.locator('.rod-overlay')).toBeHidden();
});
