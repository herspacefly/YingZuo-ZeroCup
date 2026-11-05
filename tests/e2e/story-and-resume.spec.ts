import {test,expect} from './formal-fixture';
import type {Page} from '@playwright/test';
import type {ProjectV1,StoryNodeId} from '../../src/domain/types';
import {currentProject,currentDuration} from '../helpers/current-project';
const runtime=(page:Page)=>page.locator('#story-runtime');
async function clock(page:Page){await page.addInitScript(()=>{
 let now=0,serial=0;const jobs=new Map<number,FrameRequestCallback>(),late:FrameRequestCallback[]=[];
 Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=callback=>{jobs.set(++serial,callback);return serial;};
 window.cancelAnimationFrame=id=>{const callback=jobs.get(id);if(callback)late.push(callback);jobs.delete(id);};
 Reflect.set(window,'__resumeFrame',(delta:number)=>{now+=delta;const batch=[...jobs.values()];jobs.clear();batch.forEach(callback=>callback(now));});
 Reflect.set(window,'__resumeLate',()=>late.splice(0).forEach(callback=>callback(now)));Reflect.set(window,'__resumeJobs',()=>jobs.size);
});}
async function advance(page:Page,ms:number){await page.evaluate(async remaining=>{while(remaining>0){const delta=Math.min(100,remaining);remaining-=delta;Reflect.get(window,'__resumeFrame')(delta);await Promise.resolve();}},ms);}
async function seed(page:Page,id:StoryNodeId){await page.goto('/study.html');await page.evaluate(async project=>{
 const db=await new Promise<IDBDatabase>((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});
 await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(project),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();
},currentProject(id));}
async function stored(page:Page):Promise<ProjectV1>{return page.evaluate(async()=>{
 const db=await new Promise<IDBDatabase>(yes=>{const q=indexedDB.open('yingzuo-v1',1);q.onsuccess=()=>yes(q.result);});const raw=await new Promise<string>(yes=>{const q=db.transaction('snapshots').objectStore('snapshots').get('draft');q.onsuccess=()=>yes(q.result as string);});db.close();return JSON.parse(raw);
});}
async function ready(page:Page,id:StoryNodeId){
 await expect(runtime(page)).toHaveAttribute('data-node',id);await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready');
 if(await page.locator('#story-voice-toggle').getAttribute('aria-pressed')==='true')await page.locator('#story-voice-toggle').click();
 if(await runtime(page).getAttribute('data-state')==='playing')await page.locator('#story-pause').click();
 await expect(runtime(page)).toHaveAttribute('data-state','paused');
}
test('a failed ending epilogue exports and retries the same completed candidate',async({page})=>{
 await clock(page);await seed(page,'ending-home-epilogue');await page.goto('/#/story');await ready(page,'ending-home-epilogue');
 const before=await stored(page);await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;let fail=true;IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(fail&&key==='draft'){fail=false;throw new DOMException('Injected ending save','QuotaExceededError');}return original.call(this,value,key);};});
 await page.locator('#story-play').click();await advance(page,currentDuration('ending-home-epilogue')+100);await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');
 expect((await stored(page)).story).toEqual(before.story);
 const tools=page.locator('#open-project-tools');if(await tools.getAttribute('aria-expanded')==='false')await tools.click();
 await expect(page.locator('#export-project')).toBeVisible();await expect(page.locator('#export-project')).toBeEnabled();
 const wait=page.waitForEvent('download');await page.locator('#export-project').click();const file=await wait,chunks:Buffer[]=[];for await(const chunk of await file.createReadStream())chunks.push(Buffer.from(chunk));const candidate=JSON.parse(Buffer.concat(chunks).toString('utf8')) as ProjectV1;
 expect(candidate.story).toMatchObject({nodeId:'curtain',ending:'home'});expect(candidate.story!.completedAt).toBeTruthy();
 await page.locator('#retry-save').click();await ready(page,'curtain');expect((await stored(page)).story).toEqual(candidate.story);await page.reload();await ready(page,'curtain');expect((await stored(page)).story).toEqual(candidate.story);
});
test('touch cancellation and focus loss release the active body without editing the saved pose',async({page,context,isMobile})=>{
 await clock(page);await seed(page,'road');await page.goto('/#/story');await ready(page,'road');await page.locator('#story-play').click();await advance(page,currentDuration('road')+100);
 const before=await stored(page),grip=page.locator('button[data-story-rod="body"]');await grip.scrollIntoViewIfNeeded();const box=(await grip.boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2;
 const cdp=await context.newCDPSession(page),start=Number(await page.locator('#story-rod-x').inputValue());if(!isMobile)await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 await test.info().attach('touch-hit-target',{contentType:'application/json',body:Buffer.from(JSON.stringify(await page.evaluate(({x,y})=>({x,y,hit:document.elementFromPoint(x,y)?.outerHTML,viewport:{width:innerWidth,height:innerHeight}}),{x,y})))});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await expect(grip).toHaveAttribute('aria-pressed','true');await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+20,y:y-5}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
 await expect.poll(async()=>Number(await page.locator('#story-rod-x').inputValue())).toBeGreaterThan(start);expect((await stored(page)).pose).toEqual(before.pose);
 const ended=await page.locator('#story-rod-x').inputValue();await page.evaluate(()=>dispatchEvent(new Event('blur')));await advance(page,1000);await expect(runtime(page)).toHaveAttribute('data-state','paused');await expect(page.locator('#story-rod-x')).toHaveValue(ended);expect((await stored(page)).story).toEqual(before.story);
});
test('ten playing exits dispose their source Canvas and ignore late animation callbacks',async({page})=>{
 test.setTimeout(90000);await clock(page);await seed(page,'memory-words');await page.goto('/#/museum');
 for(let n=0;n<10;n++){
  await page.evaluate(()=>{location.hash='#/story';});await ready(page,'memory-words');const old=await page.locator('canvas.shadow-stage').elementHandle();
  await page.locator('#story-play').click();await advance(page,100);await page.evaluate(()=>{location.hash='#/museum';});await expect(page.locator('#app-view')).toHaveAttribute('data-route','/museum');await page.evaluate(()=>Reflect.get(window,'__resumeLate')());
  expect(await page.evaluate(()=>Reflect.get(window,'__resumeJobs')())).toBe(0);expect(await old!.evaluate((canvas:HTMLCanvasElement)=>({connected:canvas.isConnected,width:canvas.width,height:canvas.height}))).toEqual({connected:false,width:0,height:0});
 }
});
