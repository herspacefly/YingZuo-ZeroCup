import {currentDuration,currentProject} from '../helpers/current-project';
import { test, expect } from './formal-fixture';
import type { Page } from '@playwright/test';
import type { ProjectV1 } from '../../src/domain/types';
import fixture from '../fixtures/project.json' with {type:'json'};

async function controlledClock(page:Page){
  await page.addInitScript(()=>{
    let now=0,id=0;const callbacks=new Map<number,FrameRequestCallback>();
    Object.defineProperty(performance,'now',{value:()=>now});
    window.requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};
    window.cancelAnimationFrame=id=>{callbacks.delete(id);};
    Reflect.set(window,'__feedbackAdvance',async(ms:number)=>{
      while(ms>0){const delta=Math.min(100,ms);ms-=delta;now+=delta;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(now));await Promise.resolve();}
    });
  });
}
async function seed(page:Page,project:ProjectV1){
  await page.goto('/study.html');
  await page.evaluate(async project=>{
    const db=await new Promise<IDBDatabase>((yes,no)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
    await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(project),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();
  },project);
  await page.goto('/#/story');await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready',{timeout:15000});
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','playing');
}
const advance=(page:Page,ms:number)=>page.evaluate(ms=>Reflect.get(window,'__feedbackAdvance')(ms),ms);
async function shoulder(page:Page,value:number){
  await page.locator('#story-rod-rightShoulder').evaluate((input:HTMLInputElement,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));},value);
}

test('the real axe observer displays holding then lowering and pause clears held progress',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await controlledClock(page);const project=currentProject('call-split');await seed(page,project);
  const feedback=page.locator('.story-feedback');
  await expect(feedback).toHaveAttribute('data-state','listening');await advance(page,currentDuration('call-split')+100);await expect(feedback).toHaveAttribute('data-state','ready');await shoulder(page,1.2);await advance(page,300);
  await expect(feedback).toHaveAttribute('data-state','holding');
  await expect(feedback.getByRole('progressbar')).toHaveAttribute('aria-valuenow','200');
  await page.locator('#story-pause').click();await expect(feedback).toHaveAttribute('data-state','paused');await expect(feedback.getByRole('progressbar')).toBeHidden();
  await advance(page,1000);await page.locator('#story-play').click();await advance(page,700);
  await expect(feedback).toHaveAttribute('data-state','lower-axe');await expect(feedback).toContainText('现在落斧');
  await shoulder(page,0);await advance(page,100);await expect(feedback).toHaveAttribute('data-state','showcase');
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-node','call-split');
});

test('dialogue gates the handover and its phase announcement does not change on every frame',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});await controlledClock(page);const project=structuredClone(fixture) as ProjectV1;Object.assign(project.story!,{definitionVersion:5,nodeId:'memory-wave',revision:2,assistedNodeIds:[],mode:'guided',approach:null,approachSource:null,ending:null,endingSource:null,choices:{journeyIntent:null,mountainPact:null,finalAction:null}});await seed(page,project);
  const feedback=page.locator('.story-feedback');await expect(feedback).toHaveAttribute('data-state','listening');
  await expect(page.locator('#story-rod-rightShoulder')).toBeDisabled();
  await advance(page,currentDuration('memory-wave')+100);await expect(feedback).toHaveAttribute('data-state','ready');await expect(page.locator('#story-rod-rightShoulder')).toBeEnabled();
  await page.locator('.story-feedback-label').evaluate(label=>{
    Reflect.set(window,'__feedbackAnnouncements',0);
    new MutationObserver(()=>Reflect.set(window,'__feedbackAnnouncements',Number(Reflect.get(window,'__feedbackAnnouncements'))+1)).observe(label,{childList:true,characterData:true,subtree:true});
  });
  await advance(page,1000);expect(await page.evaluate(()=>Reflect.get(window,'__feedbackAnnouncements'))).toBe(0);
  await expect(page.locator('.story-stage-slot .stage-figure')).toHaveClass(/story-handoff/);
  await page.locator('#story-pause').click();await expect(feedback).toHaveAttribute('data-state','paused');
});
