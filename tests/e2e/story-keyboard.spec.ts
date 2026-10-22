import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';
import type {ProjectV1} from '../../src/domain/types';
import fixture from '../fixtures/project-v1.json' with {type:'json'};
import content from '../../src/content/stories/reunion-v1.json' with {type:'json'};

const runtime=(page:Page)=>page.locator('#story-runtime');
async function ready(page:Page,id:string){await expect(runtime(page)).toHaveAttribute('data-node',id);await expect(runtime(page)).toHaveAttribute('data-state','paused',{timeout:15000});await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready',{timeout:15000});}
async function enter(page:Page,id:string){await page.locator(id).focus();await page.keyboard.press('Enter');}
async function advance(page:Page,ms:number){await page.evaluate(async ms=>{while(ms>0){const delta=Math.min(ms,100);Reflect.get(window,'__frame')(delta);ms-=delta;await Promise.resolve();}},ms);}

/** Use native range keys and read constrained feedback; body limits can differ from the HTML range. */
async function rangeKeys(page:Page,id:string,target:number){
  const range=page.locator(id),limits=await range.evaluate((el:HTMLInputElement)=>({step:Number(el.step),page:(Number(el.max)-Number(el.min))/10}));
  await range.focus();
  for(let count=0;count<400;count++){
    const before=Number(await range.inputValue()),difference=target-before;
    if(Math.abs(difference)<limits.step*.51)return;
    const large=Math.abs(difference)>=limits.page+limits.step/2;
    await page.keyboard.press(large?(difference>0?'PageUp':'PageDown'):(difference>0?'ArrowRight':'ArrowLeft'));
    const after=Number(await range.inputValue());expect(after,`${id} must move toward ${target} with native keys`).not.toBe(before);
  }
  throw new Error(`Native range ${id} did not reach ${target}`);
}

for(const mode of ['full','guided'] as const)for(const approach of ['call-first','split-first'] as const){
  test(`${mode}/${approach} completes every graphical interaction and curtain using only native keyboard controls`,async({page})=>{
    test.setTimeout(180000);
    await page.addInitScript(()=>{
      let now=0,id=0;const callbacks=new Map<number,FrameRequestCallback>();
      Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};window.cancelAnimationFrame=id=>{callbacks.delete(id);};
      Reflect.set(window,'__frame',(delta:number)=>{now+=delta;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(callback=>callback(now));});
    });
    const project=structuredClone(fixture) as ProjectV1;Object.assign(project.story!,{nodeId:'memory-wave',mode,approach:null,approachSource:null,assistedNodeIds:[],completedAt:null});
    await page.goto('/study.html');await page.evaluate(async project=>{
      const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('yingzuo-v1',1);request.onupgradeneeded=()=>request.result.createObjectStore('snapshots');request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(project),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
    },project);await page.goto('/#/story');await ready(page,'memory-wave');
    for(let index=0;index<15;index++){
      const id=(await runtime(page).getAttribute('data-node'))!;if(id==='completed')break;
      await ready(page,id);const node=content.nodes.find(node=>node.id===id)!;
      if(node.kind==='choice')await enter(page,approach==='call-first'?'#story-call-first':'#story-split-first');
      else {
        await enter(page,'#story-play');
        if(id==='memory-wave'){
          await rangeKeys(page,'#story-rod-rightShoulder',1.8);await rangeKeys(page,'#story-rod-rightElbow',.52);await advance(page,3000);
        }else if(id==='road'){
          await rangeKeys(page,'#story-rod-x',.775);await rangeKeys(page,'#story-rod-y',.66);await advance(page,2400);
        }else if(id==='guardian'){
          await rangeKeys(page,'#story-rod-x',.53);await rangeKeys(page,'#story-rod-y',.58);await advance(page,2400);
        }else if(id==='call-light'||id==='split-search'){
          await rangeKeys(page,'#story-distance',.4);await rangeKeys(page,'#story-rod-x',.535);await rangeKeys(page,'#story-rod-y',.565);await advance(page,2600);
        }else if(id==='call-split'||id==='split-axe'){
          await rangeKeys(page,'#story-rod-rightShoulder',1.2);await advance(page,700);await expect(runtime(page)).toHaveAttribute('data-interaction','raised');
          await rangeKeys(page,'#story-rod-rightShoulder',0);await advance(page,4300);
        }else if(id==='reunion-reach'){
          await advance(page,2000);await rangeKeys(page,'#story-rod-x',.47);await rangeKeys(page,'#story-rod-y',.555);await rangeKeys(page,'#story-rod-rightShoulder',.01);await advance(page,1000);
        }else {
          await advance(page,mode==='full'?node.fullTiming.targetMs:node.guidedTiming.targetMs);
          if(id==='reunion-hold'){await expect(page.locator('#story-finish')).toHaveText('谢幕');await enter(page,'#story-finish');}
        }
      }
      await expect(runtime(page)).not.toHaveAttribute('data-node',id);
    }
    await ready(page,'completed');
    // Inspect the real persisted checkpoint, not runtime labels alone.
    const saved=await page.evaluate(async()=>{
      const db=await new Promise<IDBDatabase>((resolve,reject)=>{const request=indexedDB.open('yingzuo-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
      const value=await new Promise<string>((resolve,reject)=>{const request=db.transaction('snapshots').objectStore('snapshots').get('draft');request.onsuccess=()=>resolve(request.result as string);request.onerror=()=>reject(request.error);});db.close();return JSON.parse(value) as ProjectV1;
    });
    expect(saved.story).toMatchObject({nodeId:'completed',mode,approach,approachSource:'user',assistedNodeIds:[],castSnapshot:project.story!.castSnapshot});expect(saved.story!.completedAt).not.toBeNull();expect(saved.pose).toEqual(project.pose);expect(saved.stage).toEqual(project.stage);
  });
}
