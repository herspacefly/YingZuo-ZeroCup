import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const ready=async(page: Page)=>expect(page.locator('#asset-status')).toHaveAttribute('data-state','ready');
const pixels=(page: Page,id: string)=>page.locator(id).evaluate((canvas: HTMLCanvasElement)=>{
  const ctx=canvas.getContext('2d')!,bytes=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let hash=2166136261,visible=0;for(let i=0;i<bytes.length;i++)hash=Math.imul(hash^bytes[i]!,16777619);
  for(let i=3;i<bytes.length;i+=4)if(bytes[i])visible++;
  return {hash,visible};
});
test('all local assets decode and distinct neutral roles, cutouts and scenes draw',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('/assets.html');await ready(page);
  await expect(page.locator('#asset-status')).toContainText('81');
  const chen=await pixels(page,'#puppet-canvas');expect(chen.visible).toBeGreaterThan(15000);
  await page.locator('#carve').uncheck();expect((await pixels(page,'#puppet-canvas')).hash).not.toBe(chen.hash);
  await page.locator('#carve').check();await page.locator('#pattern').selectOption('wave-v1');
  expect((await pixels(page,'#puppet-canvas')).hash).not.toBe(chen.hash);
  await page.locator('#puppet').selectOption('mother-v1');const mother=await pixels(page,'#puppet-canvas');expect(mother.hash).not.toBe(chen.hash);
  await expect(page.locator('#puppet-summary')).toContainText('6 部件 · 5 活动关节');
  await page.locator('#puppet').selectOption('guardian-v1');expect((await pixels(page,'#puppet-canvas')).hash).not.toBe(mother.hash);
  await expect(page.locator('#puppet-summary')).toContainText('4 部件 · 3 活动关节');
  const base=await pixels(page,'#puppet-canvas');await page.locator('#prop').check();expect((await pixels(page,'#puppet-canvas')).hash).not.toBe(base.hash);
  await page.locator('#map').selectOption('regions');expect((await pixels(page,'#puppet-canvas')).hash).not.toBe(base.hash);
  await expect(page.locator('#pattern-gallery img')).toHaveCount(9);await expect(page.locator('#source-list li')).toHaveCount(7);
  await page.locator('#scene').selectOption('mountain-v1');const closed=await pixels(page,'#scene-canvas');
  await page.locator('#split').fill('100');expect((await pixels(page,'#scene-canvas')).hash).not.toBe(closed.hash);
  await page.locator('#scene').selectOption('plain-v1');await expect(page.locator('#scene-summary')).toContainText('0 层');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});
test('a missing required mask clears the preview and retry loads a complete actor',async({page})=>{
  let fail=true;
  await page.route('**/assets/puppets/chenxiang-v1/head-mask.png',route=>fail?route.abort():route.continue());
  await page.goto('/assets.html');await expect(page.locator('#asset-status')).toHaveAttribute('data-state','error');
  await expect(page.locator('#asset-status')).toContainText('head-mask');await expect(page.locator('#puppet')).toBeDisabled();
  expect((await pixels(page,'#puppet-canvas')).visible).toBe(0);
  fail=false;await page.locator('#retry-assets').click();await ready(page);expect((await pixels(page,'#puppet-canvas')).visible).toBeGreaterThan(15000);
});
test('legacy asset page consumes the same PNGs in Chromium smoke check',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/assets.html',async route=>{
    const response=await route.fetch();const html=(await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/\snomodule\b/g,'');
    await route.fulfill({response,body:html});
  });
  await page.goto('/assets.html');await ready(page);await expect(page.locator('#asset-status')).toHaveAttribute('data-entry','legacy');
  await page.locator('#puppet').selectOption('mother-v1');await expect(page.locator('#puppet-summary')).toContainText('母亲');
  expect((await pixels(page,'#puppet-canvas')).visible).toBeGreaterThan(15000);expect(errors).toEqual([]);
});
test('Canvas failure remains readable and does not report successful assembly',async({page})=>{
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=(()=>null) as typeof HTMLCanvasElement.prototype.getContext;});
  await page.goto('/assets.html');await expect(page.locator('#asset-status')).toHaveAttribute('data-state','error');
  await expect(page.locator('#asset-status')).toContainText('Canvas2D');await expect(page.getByRole('heading',{level:1})).toBeVisible();
});
