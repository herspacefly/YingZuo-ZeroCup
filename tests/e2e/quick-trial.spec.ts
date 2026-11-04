import { test, expect } from './formal-fixture';
import type { Page } from '@playwright/test';

async function virtualClock(page: Page) {
  await page.addInitScript(() => {
    let now = 0, serial = 0; const jobs = new Map<number, FrameRequestCallback>();
    Object.defineProperty(performance, 'now', { value: () => now });
    window.requestAnimationFrame = callback => { jobs.set(++serial, callback); return serial; };
    window.cancelAnimationFrame = id => { jobs.delete(id); };
    Reflect.set(window, '__trialFrame', (delta: number) => { now += delta; const callbacks = [...jobs.values()]; jobs.clear(); callbacks.forEach(callback => callback(now)); });
    Reflect.set(window, '__trialClocks', () => jobs.size);
  });
}
async function frames(page: Page, milliseconds: number) {
  for (let remaining = milliseconds; remaining > 0; remaining -= 100) await page.evaluate(delta => Reflect.get(window, '__trialFrame')(delta), Math.min(100, remaining));
}
async function draft(page: Page) {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open('yingzuo-v1', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const value = await new Promise<unknown>((resolve, reject) => { const request = db.transaction('snapshots').objectStore('snapshots').get('draft'); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); }); db.close(); return value;
  });
}
async function open(page: Page) {
  await page.goto('/'); await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'saved'); const source = await draft(page);
  await page.locator('#intro-quick-trial').click(); await expect(page.locator('#quick-trial .canvas-stage-status')).toHaveAttribute('data-state', 'ready');
  // Deterministic choreography checks do not fast-forward native MP3 output.
  // Natural native playback is verified separately from this synthetic clock.
  if (await page.locator('#trial-voice-toggle').getAttribute('aria-pressed') === 'true') await page.locator('#trial-voice-toggle').click();
  if (await page.locator('#trial-play').isEnabled()) await page.locator('#trial-play').click();
  return source;
}
async function continueIfPaused(page: Page) { await expect(page.locator('#quick-trial .canvas-stage-status')).toHaveAttribute('data-state', 'ready'); if (await page.locator('#trial-play').isEnabled()) await page.locator('#trial-play').click(); }
async function advanceToLamp(page: Page) {
  await frames(page, 6000); await continueIfPaused(page);
  await frames(page, 20455); await continueIfPaused(page);
  await frames(page, 12000); await expect(page.locator('#quick-trial')).toHaveAttribute('data-state', 'waiting-lamp');
}

test('quick trial keeps the formal draft unchanged, pauses at both operations and ends before the mountain opens', async ({ page }) => {
  test.setTimeout(90000); await page.emulateMedia({ reducedMotion: 'reduce' }); await virtualClock(page);
  await page.addInitScript(() => Object.defineProperty(window, 'WebGL2RenderingContext', { value: undefined, configurable: true }));
  const source = await open(page); await advanceToLamp(page);
  const budget = await page.locator('#quick-trial').getAttribute('data-automatic-ms'); await frames(page, 5000); await expect(page.locator('#quick-trial')).toHaveAttribute('data-automatic-ms', budget!);
  await page.locator('#trial-lamp-x').focus(); await page.locator('#trial-lamp-x').press('ArrowRight'); await expect(page.locator('#trial-lamp-done')).toBeEnabled(); await page.locator('#trial-lamp-done').click();
  await continueIfPaused(page); await frames(page, 18396); await expect(page.locator('#quick-trial')).toHaveAttribute('data-state', 'waiting-wave');
  await expect(page.locator('#trial-wave-controls')).toBeVisible(); await expect(page.locator('.trial-wave-target')).toBeVisible(); await page.locator('#trial-assist').click();
  await frames(page, 7000); await continueIfPaused(page); await frames(page, 20235); await frames(page, 5914);
  await expect(page.locator('#quick-trial')).toHaveAttribute('data-state', 'completed'); await expect(page.locator('#quick-trial')).toHaveAttribute('data-automatic-ms', '90000');
  expect(await draft(page)).toEqual(source); expect(await page.evaluate(() => Reflect.get(window, '__trialClocks')())).toBe(0);
  await page.locator('#trial-close').click(); await expect(page.locator('#quick-trial')).toHaveCount(0); expect(await draft(page)).toEqual(source);
});

test('pause, lost focus, restart and closing leave no active trial clock', async ({ page }) => {
  test.setTimeout(60000); await virtualClock(page); const source = await open(page); await frames(page, 200);
  await page.locator('#trial-pause').click(); const position = await page.locator('#quick-trial').getAttribute('data-automatic-ms'); await frames(page, 1000); await expect(page.locator('#quick-trial')).toHaveAttribute('data-automatic-ms', position!);
  await page.locator('#trial-play').click(); await page.evaluate(() => dispatchEvent(new Event('blur'))); await expect(page.locator('#quick-trial')).toHaveAttribute('data-state', 'paused'); await page.evaluate(() => dispatchEvent(new Event('focus'))); await expect(page.locator('#quick-trial')).toHaveAttribute('data-state', 'paused');
  await page.locator('#trial-play').click(); await page.evaluate(() => Reflect.get(window, '__trialFrame')(300)); await expect(page.locator('#trial-status')).toContainText('停顿');
  await page.locator('#trial-restart').click(); await expect(page.locator('#quick-trial')).toHaveAttribute('data-automatic-ms', '0'); await expect(page.locator('#quick-trial')).toHaveAttribute('data-state', 'paused');
  await page.locator('#trial-close').click(); expect(await page.evaluate(() => Reflect.get(window, '__trialClocks')())).toBe(0); expect(await draft(page)).toEqual(source);
});

test('a failed curtain asset reports failure and retries without starting time or changing the draft', async ({ page }) => {
  await virtualClock(page); let fail = true;
  await page.route('**/assets/puppets/chenxiang-v1/head-mask.png', route => fail ? route.abort() : route.continue());
  await page.goto('/'); await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'saved'); const source = await draft(page);
  await page.locator('#intro-quick-trial').click(); await expect(page.locator('#quick-trial')).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#trial-status')).toContainText('未能准备好'); await expect(page.locator('#trial-play')).toBeDisabled();
  fail = false; await page.locator('#quick-trial .canvas-stage-status+button').click();
  await expect(page.locator('#quick-trial .canvas-stage-status')).toHaveAttribute('data-state', 'ready'); await expect(page.locator('#quick-trial')).toHaveAttribute('data-state', 'paused');
  expect(await page.evaluate(() => Reflect.get(window, '__trialClocks')())).toBe(0); expect(await draft(page)).toEqual(source);
  await page.locator('#trial-close').click();
});

test('320px trial, keyboard close and repeated entry retain a single usable curtain', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await virtualClock(page); await open(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
  await page.locator('#trial-close').focus(); await page.locator('#trial-close').press('Escape'); await expect(page.locator('#quick-trial')).toHaveCount(0);
  await page.locator('#intro-quick-trial').click(); await expect(page.locator('#quick-trial')).toHaveCount(1); await expect(page.locator('#quick-trial canvas.shadow-stage')).toHaveCount(1);
  await page.locator('#trial-close').click(); expect(await page.evaluate(() => Reflect.get(window, '__trialClocks')())).toBe(0);
});
