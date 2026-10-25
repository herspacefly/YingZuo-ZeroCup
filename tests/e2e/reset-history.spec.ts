import {test,expect} from './formal-fixture';
import type {Page} from '@playwright/test';
import fixture from '../fixtures/project-v1.json' with {type:'json'};
import type {ProjectV1} from '../../src/domain/types';

async function records(page:Page){return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const q=indexedDB.open('yingzuo-v1',1);q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  try{return await new Promise<Record<string,unknown>>((resolve,reject)=>{const tx=db.transaction('snapshots'),store=tx.objectStore('snapshots'),output:Record<string,unknown>={};for(const key of ['draft','backup','previous-project','raw-invalid']){const q=store.get(key);q.onsuccess=()=>{output[key]=q.result;};}tx.oncomplete=()=>resolve(output);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
});}
async function seed(page:Page){await page.goto('/study.html');await page.evaluate(async project=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});
  try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite'),store=tx.objectStore('snapshots');for(const key of ['draft','backup','previous-project'])store.put(JSON.stringify(project),key);store.put('{quarantined original','raw-invalid');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}
},fixture);await page.goto('/#/story');await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');}
async function offerReset(page:Page){await page.locator('#open-project-tools').click();await page.locator('#clear-local-history').click();await expect(page.locator('#clear-history-confirmation')).toBeVisible();}

test('clear history offers export and cancellation, then atomically restores a fresh-user home',async({page})=>{
  await seed(page);const before=await records(page);await offerReset(page);await page.locator('#cancel-clear-history').click();await expect(page.locator('#clear-history-confirmation')).toBeHidden();expect(await records(page)).toEqual(before);
  await page.locator('#clear-local-history').click();const downloading=page.waitForEvent('download');await page.locator('#export-before-clear').click();expect((await downloading).suggestedFilename()).toBe('yingzuo-project-before-reset.json');
  await page.locator('#confirm-clear-history').click();await expect(page).toHaveURL(/#\/$/);await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
  const after=await records(page),project=JSON.parse(after.draft as string) as ProjectV1;
  expect(project.projectId).not.toBe(fixture.projectId);expect(project).toMatchObject({story:null,saveRevision:1,lastRoute:'/',museum:{visitedExhibitIds:[]},performance:null,partialRecording:null});
  expect(after.backup).toBeUndefined();expect(after['previous-project']).toBeUndefined();expect(after['raw-invalid']).toBeUndefined();
  await page.reload();await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');expect((JSON.parse((await records(page)).draft as string) as ProjectV1).story).toBeNull();
});
test('an old live tab cannot write discarded history back after reset',async({page,context})=>{
  await seed(page);const old=await context.newPage();await old.goto('/#/story');await expect(old.locator('#save-state')).toHaveAttribute('data-state','saved');
  await offerReset(page);await page.locator('#confirm-clear-history').click();await expect(page).toHaveURL(/#\/$/);await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
  await old.evaluate(()=>{location.hash='#/museum';});await expect(old.locator('#save-state')).toHaveAttribute('data-state','conflict');
  const project=JSON.parse((await records(page)).draft as string) as ProjectV1;expect(project.story).toBeNull();expect(project.projectId).not.toBe(fixture.projectId);await old.close();
});
test('a failed reset preserves all history and the retry really starts fresh',async({page})=>{
  await seed(page);await offerReset(page);const before=await records(page);
  await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let fail=true;IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(fail&&key==='draft'){fail=false;throw new DOMException('reset quota failure','QuotaExceededError');}return put.call(this,value,key);};});
  await page.locator('#confirm-clear-history').click();await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');await expect(page.locator('#project-operation')).toContainText('未保存');expect(await records(page)).toEqual(before);
  await expect(page.locator('#clear-history-confirmation')).toBeVisible();await page.locator('#confirm-clear-history').click();await expect(page).toHaveURL(/#\/$/);await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');expect((JSON.parse((await records(page)).draft as string) as ProjectV1).story).toBeNull();
});
