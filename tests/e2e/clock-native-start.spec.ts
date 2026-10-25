import {test,expect} from './formal-fixture';
import type {Page} from '@playwright/test';
import fixture from '../fixtures/project-v1.json' with {type:'json'};
async function seed(page:Page){await page.goto('/study.html');await page.evaluate(async value=>{
 const db=await new Promise<IDBDatabase>((yes,no)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
 try{await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});}finally{db.close();}
},fixture);}
test('twelve native-clock play clicks advance without falsely pausing at the first frame',async({page},info)=>{
 // Observe the native scheduler without replacing its timestamps or delaying callbacks.
 await page.addInitScript(()=>{const native=window.requestAnimationFrame.bind(window),frames:{requested:number;timestamp:number;delivered:number}[]=[];window.requestAnimationFrame=callback=>{const requested=performance.now();return native(timestamp=>{frames.push({requested,timestamp,delivered:performance.now()});if(frames.length>600)frames.shift();callback(timestamp);});};Reflect.set(window,'__nativeFrames',frames);});
 await seed(page);await page.goto('/#/story');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');await page.bringToFront();
 const samples=[];
 try{
 for(let n=0;n<12;n++){
  const before=Number(await page.locator('#story-runtime').getAttribute('data-elapsed'));await page.locator('#story-play').click();
  await expect.poll(async()=>Number(await page.locator('#story-runtime').getAttribute('data-elapsed'))).toBeGreaterThan(before);
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','playing');
  const after=Number(await page.locator('#story-runtime').getAttribute('data-elapsed'));samples.push({before,after});await page.locator('#story-pause').click();
 }
 }finally{
 const frames=await page.evaluate(()=>Reflect.get(window,'__nativeFrames'));
 await info.attach('native-clock-starts',{contentType:'application/json',body:Buffer.from(JSON.stringify({nativeClock:true,noClockOverrides:true,samples,frames}))});
 }
});
