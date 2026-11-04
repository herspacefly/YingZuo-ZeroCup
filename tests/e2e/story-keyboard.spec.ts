import {test,expect} from './formal-fixture';
import type {Page} from '@playwright/test';
import type {ProjectV1,StoryNodeId} from '../../src/domain/types';
import {currentProject,currentDuration} from '../helpers/current-project';
async function advance(page:Page,ms:number){await page.evaluate(async remaining=>{while(remaining>0){const delta=Math.min(100,remaining);remaining-=delta;Reflect.get(window,'__keyboardFrame')(delta);await Promise.resolve();}},ms);}
async function keyRange(page:Page,id:string,value:number){
 const range=page.locator(id);await range.focus();await page.keyboard.press('Home');const min=Number(await range.inputValue()),step=await range.evaluate((input:HTMLInputElement)=>Number(input.step));
 for(let n=0;n<Math.round((value-min)/step);n++)await page.keyboard.press('ArrowRight');expect(Number(await range.inputValue())).toBeCloseTo(value,2);
}
for(const mode of ['full','guided'] as const)for(const id of ['memory-wave','split-axe'] as const)test(`${mode}/${id}: native keyboard manipulates the puppet only after narration and keeps the saved pose`,async({page})=>{
 test.setTimeout(90000);await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>{
  let now=0,serial=0;const jobs=new Map<number,FrameRequestCallback>();Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=callback=>{jobs.set(++serial,callback);return serial;};window.cancelAnimationFrame=id=>jobs.delete(id);Reflect.set(window,'__keyboardFrame',(delta:number)=>{now+=delta;const batch=[...jobs.values()];jobs.clear();batch.forEach(callback=>callback(now));});
 });
 const project=currentProject(id,mode);await page.goto('/study.html');await page.evaluate(async project=>{
  const db=await new Promise<IDBDatabase>((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(project),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();
 },project);await page.goto('/#/story');await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready');
 if(await page.locator('#story-voice-toggle').getAttribute('aria-pressed')==='true')await page.locator('#story-voice-toggle').click();
 if(await page.locator('#story-runtime').getAttribute('data-state')==='paused')await page.locator('#story-play').click();
 await expect(page.locator('.limb-overlay')).toBeHidden();await advance(page,currentDuration(id,mode)+100);await expect(page.locator('.limb-overlay')).toBeVisible();
 if(id==='memory-wave'){await keyRange(page,'#story-rod-rightShoulder',1.8);await keyRange(page,'#story-rod-rightElbow',.52);await advance(page,600);}
 else {await keyRange(page,'#story-rod-rightShoulder',1.2);await advance(page,600);await expect(page.locator('#story-runtime')).toHaveAttribute('data-interaction','raised');await keyRange(page,'#story-rod-rightShoulder',0);await advance(page,100);}
 await expect(page.locator('#story-runtime')).toHaveAttribute('data-showcase','playing');await page.locator('#showcase-skip').focus();await page.keyboard.press('Enter');
 const next:StoryNodeId=id==='memory-wave'?'memory-words':'split-search';await expect(page.locator('#story-runtime')).toHaveAttribute('data-node',next);
 const saved=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(yes=>{const q=indexedDB.open('yingzuo-v1',1);q.onsuccess=()=>yes(q.result);});const raw=await new Promise<string>(yes=>{const q=db.transaction('snapshots').objectStore('snapshots').get('draft');q.onsuccess=()=>yes(q.result as string);});db.close();return JSON.parse(raw) as ProjectV1;});
 expect(saved.pose).toEqual(project.pose);expect(saved.stage).toEqual(project.stage);expect(saved.story!.assistedNodeIds).toEqual([]);
});
