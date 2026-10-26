import {test,expect} from './formal-fixture';
test('culture identity and all main pages adapt at five browser widths',async({page})=>{
 test.setTimeout(90000);await page.addInitScript(()=>Object.defineProperty(window,'WebGL2RenderingContext',{value:undefined,configurable:true}));await page.goto('/');await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
 for(const width of [1920,1440,1024,390,320]){
  await page.setViewportSize({width,height:900});
  for(const path of ['/','/craft','/light','/practice','/story','/result','/about','/museum']){
   await page.evaluate(path=>{location.hash='#'+path;},path);await expect(page.locator('#app-view')).toHaveAttribute('data-route',path);await expect(page.locator('#app-view h1')).toBeVisible();await page.evaluate(async()=>{await document.fonts?.ready;await new Promise<void>(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve())));});
   await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('.site-positioning')).toContainText('皮影艺术 · 数字文化馆');
  }
 }
});
