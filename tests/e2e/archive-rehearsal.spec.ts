import {test,expect} from './formal-fixture';
import {currentProject} from '../helpers/current-project';

for(const definitionVersion of [1,2,3,4])test(`explicit archive restart replaces retired archive ${definitionVersion} without blocking the current session`,async({page})=>{
  const current=currentProject('road'),old=structuredClone(current) as unknown as {story:Record<string,unknown>};
  old.story.definitionVersion=definitionVersion;delete old.story.choices;
  if(definitionVersion===1){delete old.story.ending;delete old.story.endingSource;}
  await page.goto('/study.html');await page.evaluate(async({current,old})=>{
    const db=await new Promise<IDBDatabase>((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});
    await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite'),s=tx.objectStore('snapshots');s.put(JSON.stringify(current),'draft');s.put(JSON.stringify(current),'backup');s.put(JSON.stringify(old),'previous-project');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();
  },{current,old});
  await page.goto('/#/craft');await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
  await page.locator('.craft-archive-entry summary').click();
  if(definitionVersion%2){await page.locator('#craft-archive-ack').check();await page.locator('#craft-restart').click();}
  else{
    await page.locator('#craft-restart').click();await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');
    await expect(page.locator('#archive-ack')).toBeVisible();await page.locator('#archive-ack').check();await page.locator('#retry-save').click();
  }
  await expect(page.locator('#craft-return')).toBeHidden();await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
  const records=await page.evaluate(async()=>{
    const db=await new Promise<IDBDatabase>((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});
    const values=await Promise.all(['draft','backup','previous-project'].map(key=>new Promise<string>((yes,no)=>{const q=db.transaction('snapshots').objectStore('snapshots').get(key);q.onsuccess=()=>yes(q.result as string);q.onerror=()=>no(q.error);})));db.close();return values.map(v=>JSON.parse(v));
  });
  expect(records[0].projectId).not.toBe(current.projectId);expect(records[0].story).toBeNull();expect(records[1]).toEqual(records[0]);expect(records[2].story).toEqual(current.story);
  await page.locator('.craft-direct-entry summary').click();await page.locator('#craft-confirm').click();await expect(page.locator('#app-view')).toHaveAttribute('data-route','/story');await expect(page.locator('#story-voice-toggle')).toHaveAttribute('aria-pressed','true');
});
