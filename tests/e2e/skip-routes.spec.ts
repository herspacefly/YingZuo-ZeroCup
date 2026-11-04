import {test,expect} from '@playwright/test';
import {currentProject,CHOICE_RUNS} from '../helpers/current-project';
import {arrangeVoiceNode} from '../../src/content/voice-arrangement';
import type {StoryNode} from '../../src/domain/story-types';
import definition from '../../src/content/stories/reunion.json' with {type:'json'};
import {storyPath} from '../../src/domain/story-path';
for(const run of CHOICE_RUNS)test(`explicit skip ${run.journeyIntent}/${run.mountainPact}/${run.approach}/${run.finalAction} preserves choices and read-only replay`,async({page})=>{
 test.setTimeout(60000);await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{let now=0,id=0;const pending=new Map<number,FrameRequestCallback>();Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{pending.set(++id,cb);return id;};window.cancelAnimationFrame=id=>pending.delete(id);Reflect.set(window,'__advance',async(ms:number)=>{while(ms>0){const dt=Math.min(200,ms);ms-=dt;now+=dt;const batch=[...pending.values()];pending.clear();batch.forEach(cb=>cb(now));await Promise.resolve();}});new MutationObserver(()=>document.querySelector<HTMLButtonElement>('#guide-skip')?.click()).observe(document,{childList:true,subtree:true});});
 await page.goto('/study.html');const project=currentProject('intro','guided',run),approach=run.approach,ending=run.ending;
 await page.evaluate(async value=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();},project);
 await page.goto('/#/story');const path=storyPath(5,approach,ending);
 for(const id of path){await expect(page.locator('#story-runtime')).toHaveAttribute('data-node',id,{timeout:15000});if(id==='completed')break;
  await expect(page.locator('.guide-banner')).toHaveCount(0);
  const node=arrangeVoiceNode(definition.nodes.find(n=>n.id===id)! as unknown as StoryNode,5);
  if(id==='craft')await page.locator('#story-confirm-craft').click();
  else if(node.kind==='choice'){
   await expect(page.locator('#story-next-node')).toBeDisabled();await page.locator('#story-play').click();await page.evaluate(ms=>Reflect.get(window,'__advance')(ms),node.guidedTiming.targetMs);
   const button=id==='journey-choice'?'#story-choice-journey-'+run.journeyIntent:id==='mountain-pact-choice'?'#story-choice-pact-'+run.mountainPact:id==='ending-choice'?'#story-choice-final-'+run.finalAction:'#story-'+approach;await page.locator(button).click();
  }else await page.locator('#story-next-node').click();
  await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
 }
 await page.goto('/#/result');await expect(page.locator('#app-view h1')).toHaveText(definition.endings.find(e=>e.id===ending)!.title);await expect(page.locator('.programme-list')).toContainText('主动跳过的片段');
 await expect(page.locator('canvas.reunion-artifact')).toHaveAttribute('data-state','ready',{timeout:15000});if(approach==='call-first')await page.locator('.result-capture').screenshot({path:`docs/evidence/t29-t32/ending-${ending}-${test.info().project.name}.png`,animations:'disabled'});
 await page.locator('#result-replay').click();await expect(page.locator('#replay-segment')).toBeVisible();await page.locator('#replay-next').click();await expect(page.locator('#replay-segment')).toHaveValue('1');
});
