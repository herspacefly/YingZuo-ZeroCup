import { expect,test } from '@playwright/test';
import type { Page,Download } from '@playwright/test';
import type { ProjectV1 } from '../../src/domain/types';

const node=(page:Page)=>page.locator('#story-node');
async function saved(page:Page){await expect(page.locator('#story-status')).toHaveAttribute('data-state','saved');}
async function current(page:Page){return (await node(page).getAttribute('data-node'))!;}
async function stored(page:Page):Promise<ProjectV1>{
  return page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    try{return await new Promise<ProjectV1>((resolve,reject)=>{const r=db.transaction('snapshots').objectStore('snapshots').get('draft');r.onsuccess=()=>resolve(JSON.parse(r.result as string) as ProjectV1);r.onerror=()=>reject(r.error);});}finally{db.close();}
  });
}
async function start(page:Page,mode:'full'|'guided'){
  await page.clock.install();await page.goto('/story.html');await saved(page);await page.locator('#story-mode').selectOption(mode);
  await page.locator('#story-start').click();await expect(node(page)).toHaveAttribute('data-node','intro');await saved(page);
}
const interactions=['memory-wave','road','guardian','call-light','call-split','split-axe','split-search','reunion-reach'];
async function advance(page:Page,approach:'call-first'|'split-first'){
  const before=await current(page);
  if(before==='intro')await page.locator('#story-skip').click();
  else if(before==='craft')await page.locator('#story-preset').click();
  else if(before==='approach-choice')await page.locator(approach==='call-first'?'#story-choose-call':'#story-choose-split').click();
  else if(interactions.includes(before)){await page.locator('#story-play').click();await page.locator('#story-assist').click();}
  else {await page.locator('#story-play').click();await page.clock.runFor(20000);await page.locator('#story-complete').click();}
  await expect(node(page)).not.toHaveAttribute('data-node',before);await saved(page);await expect(page.locator('#node-clock')).toContainText('暂停 · 0.0');
}
async function walkTo(page:Page,target:string,approach:'call-first'|'split-first'){
  for(let i=0;i<18 && await current(page)!==target;i++)await advance(page,approach);
  await expect(node(page)).toHaveAttribute('data-node',target);
}
async function downloadJSON(download:Download):Promise<ProjectV1>{
  expect(await download.failure()).toBeNull();const stream=await download.createReadStream(),chunks:Buffer[]=[];
  for await(const chunk of stream)chunks.push(Buffer.from(chunk));return JSON.parse(Buffer.concat(chunks).toString('utf8')) as ProjectV1;
}
for(const mode of ['full','guided'] as const)for(const approach of ['call-first','split-first'] as const){
  test(`${mode}/${approach} uses the real text controls, commits one reunion and completes curtain`,async({page})=>{
    test.setTimeout(60000);await start(page,mode);await walkTo(page,'reunion-hold',approach);
    await page.locator('#story-play').click();await page.clock.runFor(3900);await expect(page.locator('#story-complete')).toBeDisabled();
    await page.clock.runFor(200);await page.locator('#story-complete').click();await expect(node(page)).toHaveAttribute('data-node','curtain');await saved(page);
    const reunion=(await stored(page)).story!;expect(reunion.completedAt).not.toBeNull();expect(reunion.assistedNodeIds).not.toContain('training');
    await advance(page,approach);await expect(node(page)).toHaveAttribute('data-node','completed');
    const completed=await stored(page);expect(completed.story).toMatchObject({mode,approach,approachSource:'user',runId:reunion.runId,completedAt:reunion.completedAt});
    expect(completed.story!.assistedNodeIds).toContain('curtain');await expect(page.locator('#result-summary')).toContainText(`${reunion.runId}:reunion`);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}
test('refresh retains a confirmed choice, restarts paused and mode changes only the current short node',async({page})=>{
  test.setTimeout(60000);await start(page,'full');await walkTo(page,'approach-choice','call-first');
  await page.reload();await saved(page);await expect(node(page)).toHaveAttribute('data-node','approach-choice');expect((await stored(page)).story!.approach).toBeNull();
  await advance(page,'call-first');const before=await stored(page);await page.reload();await saved(page);
  await expect(node(page)).toHaveAttribute('data-node','call-light');await expect(page.locator('#node-clock')).toContainText('暂停 · 0.0');
  await page.locator('#story-play').click();await page.clock.runFor(500);await expect(page.locator('#story-mode')).toBeDisabled();await page.locator('#story-pause').click();
  await page.locator('#story-mode').selectOption('guided');await saved(page);await expect(page.locator('#node-clock')).toContainText('暂停 · 0.0');
  const after=await stored(page);expect(after.story).toEqual({...before.story,mode:'guided',revision:before.story!.revision+1});
  await advance(page,'call-first');await expect(node(page)).toHaveAttribute('data-node','call-response');
});
test('a failed reunion stays at the old node, exports its exact candidate, and retries without a second result',async({page})=>{
  test.setTimeout(60000);await start(page,'guided');await walkTo(page,'reunion-hold','split-first');
  await page.locator('#story-play').click();await page.clock.runFor(4100);
  await page.evaluate(()=>{
    const original=IDBObjectStore.prototype.put;let fail=true;
    IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(fail&&key==='draft'){fail=false;throw new DOMException('Injected full storage','QuotaExceededError');}return original.call(this,value,key);};
  });
  await page.locator('#story-complete').click();await expect(page.locator('#story-status')).toHaveAttribute('data-state','error');
  await expect(node(page)).toHaveAttribute('data-node','reunion-hold');expect((await stored(page)).story!.completedAt).toBeNull();
  const downloading=page.waitForEvent('download');await page.locator('#story-export').click();const candidate=await downloadJSON(await downloading);
  expect(candidate.story!.nodeId).toBe('curtain');expect(candidate.story!.completedAt).not.toBeNull();
  await page.locator('#story-retry').click();await saved(page);await expect(node(page)).toHaveAttribute('data-node','curtain');
  expect((await stored(page)).story).toEqual(candidate.story);await page.reload();await saved(page);await expect(node(page)).toHaveAttribute('data-node','curtain');
  await advance(page,'split-first');expect((await stored(page)).story!.completedAt).toBe(candidate.story!.completedAt);
});
test('legacy text entry uses the same guarded store in Chromium smoke check',async({page})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/story.html',async route=>{
    const response=await route.fetch(),html=(await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/\snomodule\b/g,'');
    await route.fulfill({response,body:html});
  });
  await start(page,'guided');await expect(page.locator('#story-status')).toHaveAttribute('data-entry','legacy');
  await advance(page,'call-first');await advance(page,'call-first');await advance(page,'call-first');
  await expect(node(page)).toHaveAttribute('data-node','memory-separate');expect(errors).toEqual([]);
});
