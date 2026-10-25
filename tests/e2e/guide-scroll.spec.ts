import {test,expect} from '@playwright/test';
test('guide locks native scrolling and navigation, then restores original overflow and position',async({page})=>{
 await page.addInitScript(()=>{document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.setProperty('overflow','auto','important');document.documentElement.style.setProperty('overscroll-behavior','contain');},{once:true});});
 await page.goto('/#/craft');await expect(page.locator('.guide-banner')).toBeVisible({timeout:20000});
 const before=await page.evaluate(()=>scrollY);await page.mouse.wheel(0,900);await page.waitForTimeout(200);expect(await page.evaluate(()=>scrollY)).toBe(before);
 const cdp=await page.context().newCDPSession(page);await cdp.send('Input.synthesizeScrollGesture',{x:Math.round(page.viewportSize()!.width/2),y:Math.round(page.viewportSize()!.height/2),yDistance:-500,gestureSourceType:'touch'});expect(await page.evaluate(()=>scrollY)).toBe(before);await cdp.detach();
 await page.locator('#guide-skip').focus();await page.keyboard.press('PageDown');expect(await page.evaluate(()=>scrollY)).toBe(before);
 await page.locator('.wordmark').dispatchEvent('click');await expect(page.locator('.guide-banner')).toBeVisible();await expect(page.locator('#app-view')).toHaveAttribute('data-route','/craft');
 expect(await page.evaluate(()=>getComputedStyle(document.documentElement).overflow)).toBe('hidden');
 await page.keyboard.press('Escape');await expect(page.locator('.guide-banner')).toHaveCount(0);expect(await page.evaluate(()=>({value:document.documentElement.style.getPropertyValue('overflow'),priority:document.documentElement.style.getPropertyPriority('overflow'),overscroll:document.documentElement.style.getPropertyValue('overscroll-behavior')}))).toEqual({value:'auto',priority:'important',overscroll:'contain'});
 await page.mouse.wheel(0,600);await expect.poll(()=>page.evaluate(()=>scrollY)).toBeGreaterThan(0);
});
test('keyboard can reach offscreen rehearsal alternatives and blur releases the lock',async({page})=>{
 await page.goto('/#/practice');await expect(page.locator('.guide-banner')).toBeVisible({timeout:20000});
 await page.keyboard.press('Tab');const first=await page.evaluate(()=>document.activeElement?.tagName);expect(['BUTTON','INPUT','SELECT','DIV']).toContain(first);
 await page.evaluate(()=>dispatchEvent(new Event('blur')));await expect(page.locator('.guide-shade')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.style.getPropertyValue('overflow'))).toBe('');
 await page.locator('.guide-replay').click();await expect(page.locator('.guide-banner')).toBeVisible();await page.locator('#guide-skip').click();await expect(page.locator('html')).not.toHaveAttribute('data-guiding');
});
test('initial positioning failure restores the real page and releases its scroll lock',async({page})=>{
 await page.addInitScript(()=>{const scroll=Element.prototype.scrollIntoView;let failed=false;Element.prototype.scrollIntoView=function(options){if(!failed&&this.closest('.guide-preview')){failed=true;throw new Error('Injected guide positioning failure');}return scroll.call(this,options);};});
 await page.goto('/#/craft');await expect(page.locator('#app-notice')).toContainText('引导准备失败');await expect(page.locator('html')).not.toHaveAttribute('data-guiding');await expect(page.locator('.guide-preview')).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.style.getPropertyValue('overflow'))).toBe('');await expect(page.locator('.page-content #craft-palette')).toBeEnabled();
});
