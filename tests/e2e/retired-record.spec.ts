import {test,expect} from './formal-fixture';
import {currentProject} from '../helpers/current-project';
for(const definitionVersion of [1,2,3,4,6])test(`unsupported story identity ${definitionVersion} cannot mount or overwrite its raw record`,async({page})=>{
 const project=currentProject('call-light');Reflect.set(project.story!,'definitionVersion',definitionVersion);const raw=JSON.stringify(project);
 await page.goto('/study.html');await page.evaluate(async raw=>{
  const db=await new Promise<IDBDatabase>((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});
  await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(raw,'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();
 },raw);
 await page.goto('/#/story');await expect(page.locator('#save-state')).toHaveAttribute('data-state','unsupported');
 await expect(page.locator('#story-runtime')).toHaveAttribute('data-node','');await expect(page.locator('canvas.shadow-stage')).toHaveCount(0);await expect(page.locator('#story-voice-toggle')).toBeHidden();
 await expect(page.locator('#export-raw')).toBeVisible();await expect(page.locator('#export-raw')).toBeEnabled();
 const wait=page.waitForEvent('download');await page.locator('#export-raw').click();const file=await wait,chunks:Buffer[]=[];
 for await(const chunk of await file.createReadStream())chunks.push(Buffer.from(chunk));expect(JSON.parse(Buffer.concat(chunks).toString('utf8')).records.draft).toBe('string:'+raw);
 const stored=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>(yes=>{const q=indexedDB.open('yingzuo-v1',1);q.onsuccess=()=>yes(q.result);});const raw=await new Promise<string>(yes=>{const q=db.transaction('snapshots').objectStore('snapshots').get('draft');q.onsuccess=()=>yes(q.result as string);});db.close();return raw;});expect(stored).toBe(raw);
});
