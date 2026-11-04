import {test,expect} from '@playwright/test';
import fixture from '../fixtures/project.json' with {type:'json'};
for(const version of [1,2])test(`v${version} silent node guide stays on its checkpoint, restores scroll and cancels on blur`,async({page})=>{
 test.setTimeout(45000);await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map<number,FrameRequestCallback>();Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};window.cancelAnimationFrame=id=>callbacks.delete(id);Reflect.set(window,'__gap',()=>{now+=500;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(now));});Reflect.set(window,'__advance',async(ms:number)=>{while(ms>0){const dt=Math.min(200,ms);ms-=dt;now+=dt;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(now));await Promise.resolve();}});});
 await page.goto('/study.html');const p=structuredClone(fixture);Object.assign(p.story!,{definitionVersion:version,nodeId:'call-split'});if(version===2)Object.assign(p.story!,{ending:null,endingSource:null});
 await page.evaluate(async value=>{const db=await new Promise<IDBDatabase>((yes,no)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();},p);
 await page.goto('/#/story');await expect(page.locator('.guide-banner')).toContainText('1/2');await page.locator('#guide-skip').click();await expect(page.locator('.guide-banner')).toContainText('轮到你接过影偶');await page.locator('#guide-skip').click();await expect(page.locator('.guide-banner')).toHaveCount(0);await page.locator('#story-pause').click();await expect(page.locator('.guide-replay')).toBeEnabled();await page.evaluate(()=>scrollTo(0,180));const scroll=await page.evaluate(()=>scrollY);await page.locator('.guide-replay').dispatchEvent('click');await page.locator('#story-play').click();await expect(page.locator('.guide-banner')).toContainText('2/2');await page.evaluate(()=>Reflect.get(window,'__gap')());await expect(page.locator('.guide-banner')).toContainText('1/2');await page.locator('#story-play').click();await page.evaluate(()=>Reflect.get(window,'__advance')(60000));await expect(page.locator('#story-runtime')).toHaveAttribute('data-node','call-split');await expect(page.locator('.guide-banner')).toContainText('2/2');await page.locator('#story-pause').click();await expect(page.locator('.guide-banner')).toHaveCount(0);expect(await page.evaluate(()=>scrollY)).toBe(scroll);await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','paused');
 await page.locator('.guide-replay').click();await expect(page.locator('.guide-banner')).toBeVisible();await page.evaluate(()=>dispatchEvent(new Event('blur')));await expect(page.locator('.guide-shade')).toHaveCount(0);await expect(page.locator('#story-runtime')).toHaveAttribute('data-node','call-split');await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','paused');await page.goto('/#/museum');await expect(page.locator('.guide-banner')).toHaveCount(0);await expect(page.locator('html')).not.toHaveAttribute('data-guiding');
});
test('legacy entry remains usable with modern DOM methods and WebGL absent',async({page,baseURL})=>{
 test.setTimeout(45000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>{for(const name of ['append','prepend','remove','closest'])Object.defineProperty(Element.prototype,name,{value:undefined,configurable:true});Object.defineProperty(Node.prototype,'isConnected',{get:()=>undefined,configurable:true});Object.defineProperty(document,'fonts',{value:undefined,configurable:true});Object.defineProperty(window,'WebGL2RenderingContext',{value:undefined,configurable:true});});
 await page.route(new URL('/',baseURL).href,async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/\snomodule\b/g,'')});});
 await page.goto('/#/light');await expect(page.locator('#app-runtime')).toHaveAttribute('data-entry','legacy');await expect(page.locator('.guide-banner')).toBeVisible({timeout:20000});await expect(page.locator('.lamp-shadow-host canvas')).toBeVisible();await page.locator('#guide-skip').click();await expect(page.locator('.guide-shade')).toHaveCount(0);await page.locator('#light-lamp').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');expect(errors).toEqual([]);
});


test('completed and skipped teaching stays remembered during routes, but a reload starts a new visit',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.goto('/#/craft');await expect(page.locator('.guide-banner')).toBeVisible({timeout:20000});
 const original=await page.locator('.guide-preview #craft-palette').inputValue();
 await page.locator('.guide-preview #craft-palette').selectOption(original==='indigo-v1'?'woodland-v1':'indigo-v1');
 await expect(page.locator('.guide-banner')).toHaveCount(0);
 await expect(page.locator('.page-content #craft-palette')).toHaveValue(original);
 await page.locator('.page-trail a[href="#/practice"]').click();await expect(page.locator('.guide-banner')).toBeVisible();
 await page.locator('#guide-skip').click();await page.locator('.page-trail a[href="#/craft"]').click();
 await expect(page.locator('#app-view')).toHaveAttribute('data-route','/craft');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');
 await expect(page.locator('.guide-banner')).toHaveCount(0);await expect(page.locator('.guide-replay')).toBeVisible();
 await page.locator('.guide-replay').click();await expect(page.locator('.guide-banner')).toBeVisible();await page.keyboard.press('Escape');
 await page.locator('.page-trail a[href="#/practice"]').click();await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');await expect(page.locator('.guide-banner')).toHaveCount(0);
 await page.reload();await expect(page.locator('.guide-banner')).toBeVisible();
});

test('an interrupted lesson stays quiet on this page and is offered after returning',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.goto('/#/practice');await expect(page.locator('.guide-banner')).toBeVisible({timeout:20000});
 await page.evaluate(()=>dispatchEvent(new Event('blur')));await expect(page.locator('.guide-banner')).toHaveCount(0);await expect(page.locator('.page-content')).toBeVisible();
 await page.locator('.page-trail a[href="#/craft"]').click();await expect(page.locator('.guide-banner')).toBeVisible();await page.locator('#guide-skip').click();
 await page.locator('.page-trail a[href="#/practice"]').click();await expect(page.locator('.guide-banner')).toBeVisible();await expect(page.locator('.guide-banner')).toContainText('先牵动一只手或脚');
});
