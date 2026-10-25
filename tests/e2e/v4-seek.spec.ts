import {test,expect} from './formal-fixture';
import type {Page} from '@playwright/test';
import content from '../../src/content/stories/reunion-v4.json' with {type:'json'};
import fixture from '../fixtures/project-v1.json' with {type:'json'};
import type {ProjectV1} from '../../src/domain/types';
const node=content.nodes.find(n=>n.id==='memory-wave')!;
function project(mode:'full'|'guided'='guided'){
  const p=structuredClone(fixture) as ProjectV1,s=p.story!;s.definitionVersion=4;s.nodeId='memory-wave';s.mode=mode;s.assistedNodeIds=[];s.approach=null;s.approachSource=null;s.ending=null;s.endingSource=null;return p;
}
async function seed(page:Page,p:ProjectV1){
  await page.goto('/study.html');await page.evaluate(async value=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
  },p);
}
async function stored(page:Page){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(resolve=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>resolve(r.result);});const raw=await new Promise<string>(resolve=>{const r=db.transaction('snapshots').objectStore('snapshots').get('draft');r.onsuccess=()=>resolve(r.result as string);});db.close();return JSON.parse(raw) as ProjectV1;});}
async function clock(page:Page){await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map<number,FrameRequestCallback>();Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};window.cancelAnimationFrame=id=>{callbacks.delete(id);};Reflect.set(window,'__advance',async(ms:number)=>{while(ms>0){const d=Math.min(100,ms);ms-=d;now+=d;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(now));await Promise.resolve();}});});}
const advance=(page:Page,ms:number)=>page.evaluate(ms=>Reflect.get(window,'__advance')(ms),ms);
const runtime=(page:Page)=>page.locator('#story-runtime');
async function ready(page:Page){await expect(runtime(page)).toHaveAttribute('data-state','paused',{timeout:15000});await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready',{timeout:15000});}
for(const mode of ['full','guided'] as const)test(`${mode}: current mode cues seek locally, preserve pause/play, reset task evidence and lock during film`,async({page})=>{
  test.setTimeout(60000);await clock(page);await seed(page,project(mode));await page.goto('/#/story');await ready(page);
  const cues=mode==='guided'?node.guidedSubtitles:node.subtitles,ratio=mode==='guided'?node.guidedTiming.targetMs/node.fullTiming.targetMs:1,buttons=page.locator('.subtitle-directory .subtitle-cue');
  await expect(buttons).toHaveCount(cues.length);const saved=(await stored(page)).story;
  await buttons.nth(1).click();await expect(runtime(page)).toHaveAttribute('data-elapsed',String(Math.round(cues[1]!.startMs*ratio)));await expect(runtime(page)).toHaveAttribute('data-state','paused');
  await page.locator('#story-play').click();await advance(page,300);await buttons.first().click();await expect(runtime(page)).toHaveAttribute('data-state','playing');await expect(runtime(page)).toHaveAttribute('data-elapsed','0');
  await expect(runtime(page)).toHaveAttribute('data-held','0');expect((await stored(page)).story).toEqual(saved);
  if(mode==='guided'){await page.getByRole('button',{name:'展开本段完整台词',exact:true}).click();await expect(page.locator('#story-transcript p')).toHaveCount(node.subtitles.length);await expect(page.locator('#story-transcript button')).toHaveCount(0);}
  await buttons.last().click();await advance(page,(mode==='guided'?node.guidedTiming:node.fullTiming).targetMs-cues[cues.length-1]!.startMs*ratio+100);
  await expect(page.locator('.limb-overlay')).toBeVisible();await page.locator('#story-assist').click();await advance(page,3600);await expect(runtime(page)).toHaveAttribute('data-showcase','playing');
  await expect(buttons.first()).toBeDisabled();expect((await stored(page)).story!.nodeId).toBe('memory-wave');
  if(mode==='guided')await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let fail=true;IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(fail&&key==='draft'){fail=false;throw new DOMException('Cue transport quota probe','QuotaExceededError');}return put.call(this,value,key);};});
  await page.locator('#showcase-skip').click();
  if(mode==='guided'){await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');await expect(buttons.first()).toBeDisabled();expect((await stored(page)).story!.nodeId).toBe('memory-wave');await page.locator('#retry-save').click();}
  await expect(runtime(page)).toHaveAttribute('data-node','memory-words');await ready(page);expect((await stored(page)).story!.revision).toBe(saved!.revision+1);
});
test('craft keeps original image details and palette, with no added pattern or carving selection',async({page})=>{
  test.setTimeout(60000);const p=project();p.story=null;await seed(page,p);await page.goto('/#/craft');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready',{timeout:15000});
  await expect(page.locator('#craft-pattern')).toHaveCount(0);await expect(page.locator('.carve-segments')).toHaveCount(0);await expect(page.locator('#craft-palette')).toBeVisible();
  const before=await page.locator('canvas.shadow-stage').evaluate(c=>(c as HTMLCanvasElement).toDataURL());
  p.appearance.patternId='flower-v1';p.appearance.carvedSegments=[false,false,false];await seed(page,p);await page.goto('/#/craft');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready',{timeout:15000});
  expect(await page.locator('canvas.shadow-stage').evaluate(c=>(c as HTMLCanvasElement).toDataURL())).toBe(before);
  await page.locator('#craft-palette').selectOption('woodland-v1');await page.locator('#craft-confirm').click();await ready(page);await expect(runtime(page)).toHaveAttribute('data-node','memory-wave');expect((await stored(page)).story).toMatchObject({definitionVersion:4,castSnapshot:{appearance:{paletteId:'woodland-v1'}}});
});

test('fresh guide starts v4 without freezing an unconfirmed costume',async({page})=>{
  const p=project();p.story=null;await seed(page,p);await page.goto('/');await page.getByRole('button',{name:'节选导览',exact:true}).click();await ready(page);expect((await stored(page)).story).toMatchObject({definitionVersion:4,nodeId:'intro',mode:'guided',castSnapshot:null});
});

test('paused result replay unlocks its cue directory when the first frame becomes ready',async({page})=>{
  test.setTimeout(60000);const p=project();Object.assign(p.story!,{nodeId:'completed',approach:'call-first',approachSource:'user',ending:'home',endingSource:'user',completedAt:'2026-10-24T02:00:00.000Z'});
  await seed(page,p);await page.goto('/#/result');await expect(page.locator('#result-capture canvas.reunion-artifact')).toHaveAttribute('data-state','ready',{timeout:15000});
  const before=(await stored(page)).story;await page.locator('#result-replay').click();const player=page.locator('#result-replay-player');
  await expect(player.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready',{timeout:15000});const cue=player.locator('.subtitle-cue').nth(1);await expect(cue).toBeEnabled();await cue.click();
  await expect(page.locator('#replay-status')).toContainText('已定位本段台词');await expect(page.locator('#replay-status')).toContainText('已暂停');expect((await stored(page)).story).toEqual(before);
});
