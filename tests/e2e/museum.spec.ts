import {test,expect} from './formal-fixture';
import type {Page} from '@playwright/test';
import exhibits from '../../src/content/exhibits.json' with {type:'json'};
import fixture from '../fixtures/project-v1.json' with {type:'json'};

const saved=async(page:Page)=>expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
async function raw(page:Page){return page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});const value=await new Promise<string>((resolve,reject)=>{const r=db.transaction('snapshots').objectStore('snapshots').get('draft');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();return JSON.parse(value);});}
async function open(page:Page,id:string){await page.goto('/#/museum/'+id);await saved(page);await expect(page.locator('#app-view h1')).toHaveText(exhibits.exhibits.find(e=>e.id===id)!.title);await expect(page.locator('.opening-curtain')).toHaveCount(0);}
async function go(page:Page,id:string){await page.evaluate(id=>{location.hash='#/museum/'+id;},id);await expect(page.locator('#app-view h1')).toHaveText(exhibits.exhibits.find(e=>e.id===id)!.title);await saved(page);}
async function change(page:Page,selector:string,value:string){await page.locator(selector).evaluate((node:HTMLInputElement,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},value);}
function invariant(a:Record<string,unknown>,b:Record<string,unknown>){for(const key of ['story','appearance','pose','stage','performance'])expect(a[key]).toEqual(b[key]);}
async function shot(page:Page,name:string){for(const card of await page.locator('#museum-display .surface-card').all()){await card.scrollIntoViewIfNeeded();await expect(card).not.toHaveClass(/motion-awaiting/);}await page.locator('#museum-display').screenshot({path:`docs/evidence/t35/${name}-${test.info().project.name}.png`});}
async function noWebgl(page:Page){await page.addInitScript(()=>Object.defineProperty(window,'WebGL2RenderingContext',{value:undefined,configurable:true}));}

test('seven public exhibits, clear site identity, no personal labels, and real sources first',async({page})=>{
 await page.goto('/#/museum');await saved(page);await expect(page.locator('.site-positioning')).toContainText('皮影艺术 · 数字文化馆');await expect(page.locator('[data-exhibit]')).toHaveCount(7);await expect(page.locator('.museum-section')).toHaveCount(5);
 for(const e of exhibits.exhibits){await go(page,e.id);await expect(page.locator('#app-view')).not.toContainText(/零组|SpaceFly|张宇翔/);const first=page.locator('.museum-photo-card').first();await expect(first).toContainText('公开资料');expect(await first.evaluate(el=>!!(el.compareDocumentPosition(document.getElementById('museum-display')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);}
 await page.goto('/#/museum/E08');await saved(page);await expect(page.locator('[data-exhibit=E08]')).toHaveCount(0);await expect(page.locator('#app-view h1')).toHaveText('一张皮，一束光，千年戏。');await page.goto('/credits.html');await expect(page.locator('body')).not.toContainText(/零组|SpaceFly|张宇翔/);
});

test('museum native three-dimensional lamp drag changes light and keeps the puppet and project fixed',async({page})=>{
 test.setTimeout(60000);await open(page,'E01');const before=await raw(page),space=page.locator('.lamp-spatial-host .three-stage');await expect(space).toHaveAttribute('data-state','ready',{timeout:25000});await space.scrollIntoViewIfNeeded();const point=await space.evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width*Number(el.getAttribute('data-lamp-screen-x')),y:r.y+r.height*Number(el.getAttribute('data-lamp-screen-y'))};});
 await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+48,point.y-12,{steps:12});await page.mouse.up();await expect(page.locator('#museum-lamp')).not.toHaveValue('0');await expect(space).not.toHaveAttribute('data-lamp-x','0');await expect(page.locator('.shadow-stage')).toHaveAttribute('data-shadow-only','true');invariant(await raw(page),before);await shot(page,'lamp');await page.locator('#museum-demo-reset').click();await expect(page.locator('#museum-lamp')).toHaveValue('0');
});

test('no WebGL keeps lamp sliders and buttons operable without any saved pose or lamp edits',async({page})=>{
 await noWebgl(page);await open(page,'E01');await expect(page.locator('.lamp-shadow-host')).toBeVisible();const before=await raw(page);await page.locator('#museum-lamp').focus();await page.keyboard.press('End');await expect(page.locator('#museum-lamp')).toHaveValue('0.8');await page.getByRole('button',{name:'灯靠近影偶',exact:true}).click();await expect(page.locator('#museum-lamp-depth')).toHaveValue('1.1');await go(page,'E04');await change(page,'#museum-lamp-depth','.7');await expect(page.locator('#museum-demo-reading')).toContainText('1.40');invariant(await raw(page),before);
});

test('lamp context loss releases the renderer and permits a real retry',async({page})=>{
 test.setTimeout(60000);await open(page,'E04');const space=page.locator('.lamp-spatial-host .three-stage');await expect(space).toHaveAttribute('data-state','ready',{timeout:25000});await space.evaluate(el=>el.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));await expect(page.locator('.lamp-shadow-host')).toBeVisible();await page.getByRole('button',{name:'重试三维灯影',exact:true}).click();await expect(space).toHaveAttribute('data-state','ready',{timeout:25000});
});

test('carve by mouse and buttons, compare actual holes, reset without costume changes',async({page})=>{
 await open(page,'E02');const before=await raw(page),target=page.locator('[data-cut="0"]');await target.scrollIntoViewIfNeeded();await target.click();await expect(page.locator('#museum-demo-reading')).toContainText('1 / 8');await expect(page.locator('.carving-shadow .carving-light-hole').first()).toBeVisible();
 const box=await page.locator('.carving-surface').boundingBox();expect(box).toBeTruthy();await page.mouse.move(box!.x+box!.width*.39,box!.y+box!.height*.4);await page.mouse.down();await page.mouse.move(box!.x+box!.width*.61,box!.y+box!.height*.4,{steps:20});await page.mouse.up();
 for(let i=0;i<8;i++){const b=page.getByRole('button',{name:/刻开/}).nth(i);await b.click();}await expect(page.locator('#museum-demo-reading')).toContainText('八刀完成');await expect(page.locator('.carving-shadow .carving-light-hole:visible')).toHaveCount(8);await shot(page,'carving');await page.locator('#museum-carve-compare').click();await expect(page.locator('.carving-shadow .carving-light-hole:visible')).toHaveCount(0);await page.locator('#museum-carve-compare').click();await expect(page.locator('.carving-shadow .carving-light-hole:visible')).toHaveCount(8);await page.locator('#museum-demo-reset').click();await expect(page.locator('#museum-demo-reading')).toContainText('0 / 8');invariant(await raw(page),before);
});

test('joint controls stay in a short card and component photographs sit below the stage',async({page})=>{
 await open(page,'E03');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');await expect(page.locator('.museum-demo-parts li')).toHaveCount(10);await page.locator('#museum-shoulder').focus();await page.keyboard.press('End');
 const geom=await page.evaluate(()=>{const p=document.querySelector('.museum-demo .control-panel')!.getBoundingClientRect(),s=document.querySelector('.museum-demo-workspace')!.getBoundingClientRect(),d=document.querySelector('.museum-joint-details')!.getBoundingClientRect();return {panel:p.height,details:d.top,workspace:s.bottom};});expect(geom.panel).toBeLessThan(600);expect(geom.details).toBeGreaterThan(geom.workspace-40);await shot(page,'joints');
});

test('four responsibilities alter the performance, pause, compare and reset',async({page})=>{
 test.setTimeout(45000);await open(page,'E05');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');const before=await raw(page);await page.getByRole('button',{name:'看回应',exact:true}).click();await expect(page.locator('#museum-wave-reading')).toContainText('母亲');await page.getByRole('checkbox',{name:'加入唱念',exact:true}).uncheck();await page.getByRole('button',{name:'看回应',exact:true}).click();await expect(page.locator('#museum-wave-reading')).toContainText('唱念未到');await page.getByRole('button',{name:'一键合拍',exact:true}).click();await page.locator('#museum-ensemble-play').click();await expect(page.locator('#museum-ensemble-pause')).toBeEnabled();await expect.poll(()=>page.locator('.ensemble-transport progress').evaluate((e:HTMLProgressElement)=>e.value)).toBeGreaterThan(500);await page.locator('#museum-ensemble-pause').click();const paused=await page.locator('.ensemble-transport progress').getAttribute('value');await page.waitForTimeout(300);expect(await page.locator('.ensemble-transport progress').getAttribute('value')).toBe(paused);await page.getByRole('button',{name:'看落幕',exact:true}).click();await expect(page.locator('#museum-ensemble-reading')).toContainText('这一拍接住了');await shot(page,'ensemble');await page.getByRole('button',{name:'试试错拍',exact:true}).click();await page.getByRole('button',{name:'看落幕',exact:true}).click();await expect(page.locator('#museum-ensemble-reading')).toContainText('没有同时');invariant(await raw(page),before);
});

test('reduced motion presents complete collaboration as stills without a running clock',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await open(page,'E05');await page.locator('#museum-ensemble-play').click();await expect(page.locator('#museum-ensemble-pause')).toBeDisabled();await expect(page.locator('.ensemble-transport progress')).toHaveAttribute('value','1600');await page.getByRole('button',{name:'看落幕',exact:true}).click();await expect(page.locator('#museum-ensemble-reading')).toContainText('这一拍接住了');
});

test('old E08 visits restore without reinstating an empty exhibit or losing records',async({page})=>{
 await page.goto('/study.html');await page.evaluate(async fixture=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});fixture.museum.visitedExhibitIds=['E08'];await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(fixture),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();},structuredClone(fixture));await open(page,'E02');expect((await raw(page)).museum.visitedExhibitIds).toContain('E08');await expect(page.locator('[data-exhibit=E08]')).toHaveCount(0);
});

test('repeated route exit disposes old lamp canvas and local listeners',async({page})=>{
 await noWebgl(page);await open(page,'E01');const before=await raw(page);for(let i=0;i<4;i++){await go(page,'E04');const old=await page.locator('.shadow-stage').elementHandle();await go(page,'E02');expect(await old!.evaluate((e:HTMLCanvasElement)=>[e.isConnected,e.width,e.height])).toEqual([false,0,0]);await go(page,'E05');await page.getByRole('button',{name:'看回应',exact:true}).click();}await go(page,'E03');invariant(await raw(page),before);
});

test('museum experiments fit five responsive widths without long side cards or overflow',async({page})=>{
 test.setTimeout(90000);await noWebgl(page);for(const width of [1920,1440,1024,390,320]){await page.setViewportSize({width,height:900});for(const id of ['E01','E02','E03','E05']){await open(page,id);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}}
});

test('lamp asset failure retries and clears the repaired error message',async({page})=>{
 let broken=true;await page.route(/\/assets\/(?:puppets\/chenxiang-v1\/head-color\.png|delivery\/chenxiang-v1-head-color\.webp)(?:\?|$)/,route=>broken?route.abort():route.continue());await open(page,'E01');await expect(page.getByRole('button',{name:'重试影偶素材',exact:true})).toBeVisible();broken=false;await page.getByRole('button',{name:'重试影偶素材',exact:true}).click();await expect(page.locator('.lamp-status')).toContainText('二维灯影已就绪');await expect(page.getByRole('button',{name:'重试影偶素材',exact:true})).toBeHidden();await change(page,'#museum-lamp','.3');await expect(page.locator('#museum-lamp')).toHaveValue('0.3');
});

test('three module failure keeps controls usable and can retry after the failure',async({page})=>{
 test.setTimeout(45000);let broken=true;await page.route(/\/assets\/renderer-[^/]+\.js$/,route=>broken?route.abort():route.continue());await open(page,'E04');await expect(page.locator('.lamp-status')).toContainText('三维灯影暂未就绪');await page.getByRole('button',{name:'灯向右',exact:true}).click();await expect(page.locator('#museum-lamp')).toHaveValue('0.1');broken=false;await page.getByRole('button',{name:'重试三维灯影',exact:true}).click();await expect(page.locator('.lamp-spatial-host .three-stage')).toHaveAttribute('data-state','ready',{timeout:20000});
});

test('ensemble waits for imagery, pauses on blur, and can resume after recovery',async({page})=>{
 let broken=true;await page.route(/\/assets\/(?:puppets\/mother-v1\/head-color\.png|delivery\/mother-v1-head-color\.webp)(?:\?|$)/,route=>broken?route.abort():route.continue());await open(page,'E05');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','error');await expect(page.locator('#museum-ensemble-play')).toBeDisabled();await expect(page.getByRole('button',{name:'看回应',exact:true})).toBeDisabled();broken=false;await page.getByRole('button',{name:'重试幕面',exact:true}).click();await expect(page.locator('#museum-ensemble-play')).toBeEnabled();await page.locator('#museum-ensemble-play').click();await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await expect(page.locator('#museum-ensemble-pause')).toBeDisabled();await page.locator('#museum-ensemble-play').click();await expect(page.locator('#museum-ensemble-pause')).toBeEnabled();
});
