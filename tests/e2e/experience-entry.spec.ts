import {test,expect} from './formal-fixture';
import fixture from '../fixtures/project-v1.json' with {type:'json'};

test.use({reducedMotion:'reduce'});
test('the full journey has one next action and keeps lamp experiments out of the story contract',async({page})=>{
  await page.goto('/');await expect(page.locator('#intro-quick-trial')).toContainText('约90秒');
  await expect(page.locator('#intro-full-experience')).toContainText('约23分钟');await expect(page.locator('.opening-copy')).toContainText('约8—10分钟');
  await page.locator('#intro-full-experience').click();await expect(page.locator('#story-background')).toBeInViewport();
  await page.locator('#journey-to-craft').click();await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready');
  await expect(page.locator('.craft-direct-entry')).not.toHaveAttribute('open');await expect(page.locator('#craft-confirm')).toBeHidden();
  await expect(page.locator('#journey-to-light')).toHaveClass(/primary/);await page.locator('#journey-to-light').click();
  await expect(page.locator('#light-lamp')).toBeEnabled();await page.locator('#light-lamp').fill('0.2');
  await expect(page.locator('.control-panel')).toContainText('正式演出使用各片段的舞台灯位');
  await page.locator('#journey-to-practice').click();await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready');
  await expect(page.locator('.guide-replay')).toBeVisible();await expect(page.locator('#journey-to-story')).toBeEnabled();
  await page.locator('#journey-to-story').click();await expect(page.locator('#story-runtime')).toHaveAttribute('data-node','intro');
  await expect(page.locator('#story-mode')).toHaveValue('full');await expect(page.locator('#story-version-note')).toBeHidden();
});

test('320px home keeps its three entrances aligned and an existing performance remains the primary action',async({page})=>{
  await page.setViewportSize({width:320,height:740});await page.goto('/');
  await expect(page.locator('#intro-quick-trial')).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
  await page.locator('.opening-copy').screenshot({path:test.info().outputPath('home-320.png')});
  await page.goto('/study.html');await page.evaluate(async value=>{
    const db=await new Promise<IDBDatabase>((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});
    await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();
  },fixture);
  await page.goto('/');await expect(page.getByRole('link',{name:'继续这一场 ↗',exact:true})).toHaveClass(/primary/);
  await expect(page.locator('#intro-quick-trial')).not.toHaveClass(/primary/);await expect(page.locator('#intro-full-experience')).toBeHidden();
  await page.locator('.opening-actions a[href="#/museum"]').click();await expect(page.locator('#app-view')).toHaveAttribute('data-route','/museum');
});
