import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';
import fixture from '../fixtures/project-v1.json' with {type:'json'};
import type {ProjectV1} from '../../src/domain/types';

async function stored(page:Page){return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  try{return JSON.parse(await new Promise<string>((resolve,reject)=>{const r=db.transaction('snapshots').objectStore('snapshots').get('draft');r.onsuccess=()=>resolve(r.result as string);r.onerror=()=>reject(r.error);})) as ProjectV1;}finally{db.close();}
});}
async function seed(page:Page,p:ProjectV1){await page.goto('/study.html');await page.evaluate(async value=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const t=db.transaction('snapshots','readwrite');t.objectStore('snapshots').put(JSON.stringify(value),'draft');t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error);});db.close();
},p);}
const saved=(page:Page)=>expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
const canvasReady=(page:Page)=>expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready',{timeout:15000});

test('native lamp dragging changes lamp geometry, leaves the puppet fixed and survives a context loss',async({page})=>{
  test.setTimeout(90000);await page.goto('/#/light');const space=page.locator('.lamp-spatial-host .three-stage');
  await expect(space).toHaveAttribute('data-state','ready',{timeout:15000});await saved(page);const before=await stored(page);
  await space.scrollIntoViewIfNeeded();const point=await space.evaluate(el=>{const r=el.getBoundingClientRect();return{x:r.x+r.width*Number(el.getAttribute('data-lamp-screen-x')),y:r.y+r.height*Number(el.getAttribute('data-lamp-screen-y'))};});
  await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+32,point.y+7,{steps:12});await page.mouse.up();
  await expect.poll(()=>page.locator('#light-summary').textContent()).not.toContain('灯位 0.00 · 灯距 1.20');await saved(page);const after=await stored(page);
  expect(after.pose).toEqual(before.pose);expect(after.appearance).toEqual(before.appearance);expect(after.stage.puppetDistance).toBe(before.stage.puppetDistance);expect(after.stage).not.toEqual(before.stage);
  expect(Number(await space.getAttribute('data-draw-calls'))).toBeLessThanOrEqual(80);
  await space.screenshot({path:`docs/evidence/t25-t28/lamp-${test.info().project.name}.png`});
  await space.evaluate(el=>el.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));await expect(space).toHaveCount(0);await expect(page.locator('.lamp-status')).toContainText('二维灯影可完整继续');
  await page.getByRole('button',{name:'灯向右',exact:true}).click();await saved(page);const recovered=await stored(page);expect(recovered.stage.lampX).toBeGreaterThan(after.stage.lampX);
  await page.getByRole('button',{name:'重试三维灯影',exact:true}).click();await expect(space).toHaveAttribute('data-state','ready',{timeout:15000});
  await page.getByRole('button',{name:'改用二维灯影',exact:true}).click();await expect(space).toHaveCount(0);
});

test('without WebGL the lamp experiment keeps its shadow and keyboard controls',async({page})=>{
  await page.addInitScript(()=>Object.defineProperty(window,'WebGL2RenderingContext',{value:undefined,configurable:true}));await page.goto('/#/light');
  await expect(page.locator('.lamp-status')).toContainText('二维灯影可完整继续',{timeout:15000});await expect(page.locator('.lamp-shadow-host canvas')).toBeVisible();
  await page.getByRole('slider',{name:'灯的左右位置',exact:true}).focus();await page.keyboard.press('ArrowRight');await saved(page);expect((await stored(page)).stage.lampX).toBeGreaterThan(0);
  await page.locator('#journey-to-practice').click();await canvasReady(page);await expect(page).toHaveURL(/#\/practice$/);
});

test('practice uses the detailed original costume even when old pattern fields change',async({page})=>{
  test.setTimeout(60000);const p=structuredClone(fixture) as ProjectV1;p.story=null;await seed(page,p);await page.goto('/#/practice');await canvasReady(page);
  const before=await page.locator('canvas.shadow-stage').evaluate(c=>(c as HTMLCanvasElement).toDataURL());
  p.appearance.patternId='flower-v1';p.appearance.carvedSegments=[false,false,false];await seed(page,p);await page.goto('/#/practice');await canvasReady(page);
  expect(await page.locator('canvas.shadow-stage').evaluate(c=>(c as HTMLCanvasElement).toDataURL())).toBe(before);
});

test('museum prioritizes public photos, supports enlargement and offers a motion switch',async({page})=>{
  await page.goto('/#/museum');await expect(page.locator('.museum-hero-photo img')).toBeVisible();await page.locator('.museum-hero-copy .button').click();
  await expect(page.locator('#museum-gallery')).toBeVisible();expect(await page.locator('#museum-gallery').evaluate(el=>!!(el.compareDocumentPosition(document.querySelector('#museum-display')!)&Node.DOCUMENT_POSITION_FOLLOWING))).toBe(true);
  await page.locator('.museum-photo-enlarge').first().click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.locator('#site-motion-toggle').click();await expect(page.locator('html')).toHaveAttribute('data-motion','reduced');await page.locator('#site-motion-toggle').click();await expect(page.locator('html')).toHaveAttribute('data-motion','full');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
