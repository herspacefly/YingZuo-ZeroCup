import {test,expect} from './formal-fixture';
import type { Page } from '@playwright/test';
import type { ProjectV1 } from '../../src/domain/types';
import fixture from '../fixtures/project-v1.json' with { type: 'json' };

const wait = { timeout: 15_000 };
const notice = (page: Page) => page.locator('.stage-performance').first();
const runtime = (page: Page) => page.locator('#story-runtime');
const saved = (page: Page) => expect(page.locator('#save-state')).toHaveAttribute('data-state', 'saved', wait);
test.beforeEach(() => { test.setTimeout(90_000); });

async function seed(page: Page, route: '/story' | '/practice' | '/result' = '/story') {
  const project = structuredClone(fixture) as ProjectV1; project.lastRoute = route;
  if (route === '/result') { project.story!.nodeId = 'completed'; project.story!.completedAt = '2026-10-19T08:00:00.000Z'; }
  await page.goto('/study.html');
  await page.evaluate(async value => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('yingzuo-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
      request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readwrite'); tx.objectStore('snapshots').put(JSON.stringify(value), 'draft');
        tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, project);
  return project;
}

async function stored(page: Page): Promise<ProjectV1> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('yingzuo-v1', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
    });
    try {
      const json = await new Promise<string>((resolve, reject) => {
        const request = db.transaction('snapshots').objectStore('snapshots').get('draft');
        request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
      });
      return JSON.parse(json);
    } finally { db.close(); }
  });
}

async function clock(page: Page) {
  await page.addInitScript(() => {
    let now = 0, id = 0;
    const callbacks = new Map<number, FrameRequestCallback>(), cancelled: FrameRequestCallback[] = [];
    Object.defineProperty(performance, 'now', { value: () => now });
    window.requestAnimationFrame = callback => { callbacks.set(++id, callback); return id; };
    window.cancelAnimationFrame = id => { const callback = callbacks.get(id); if (callback) cancelled.push(callback); callbacks.delete(id); };
    Reflect.set(window, '__frame', (delta: number) => {
      now += delta; const batch = [...callbacks.values()]; callbacks.clear(); batch.forEach(callback => callback(now));
    });
    Reflect.set(window, '__late', () => cancelled.splice(0).forEach(callback => callback(now)));
    Reflect.set(window, '__frameCount', () => callbacks.size);
  });
}
async function advance(page: Page, ms: number, interval = 50) {
  await page.evaluate(async ({ ms, interval }) => {
    while (ms > 1e-7) { const delta = Math.min(ms, interval); Reflect.get(window, '__frame')(delta); ms -= delta; await Promise.resolve(); }
  }, { ms, interval });
}
async function openStory(page: Page) {
  await page.goto('/#/story');
  await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state', 'ready', wait);
  await expect(runtime(page)).toHaveAttribute('data-state', 'paused', wait); await saved(page);
}
async function frameCount(page: Page) { return page.evaluate(() => Reflect.get(window, '__frameCount')()) as Promise<number>; }

test('ten slow seconds offer real lightweight 2D without advancing or saving, and quality can be restored', async ({ page }, info) => {
  await clock(page); const project = await seed(page); await openStory(page);
  const spatial = page.locator('.spatial-stage'); await spatial.locator('.spatial-toggle').click();
  await expect(spatial).toHaveAttribute('data-state', 'ready', wait);
  const gpu = await page.locator('canvas.three-stage').elementHandle();
  const originalWidth = await page.locator('.shadow-stage').evaluate((canvas: HTMLCanvasElement) => canvas.width);
  await page.locator('#story-play').click(); await advance(page, 9950); await expect(notice(page)).toBeHidden();
  await advance(page, 50); await expect(notice(page)).toHaveAttribute('data-state', 'suggested');
  await expect(runtime(page)).toHaveAttribute('data-state', 'playing'); expect(await frameCount(page)).toBe(1);
  expect(await stored(page)).toEqual(project);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: `docs/evidence/t10-frame-rate-${info.project.name.startsWith('mobile') ? 'mobile' : 'desktop'}.png`, fullPage: true });
  await notice(page).locator('.performance-lightweight').click();
  await expect(notice(page)).toHaveAttribute('data-state', 'lightweight');
  await expect(page.locator('canvas.three-stage')).toHaveCount(0); await expect(spatial.locator('.spatial-toggle')).toBeDisabled();
  expect(await gpu!.evaluate((canvas: HTMLCanvasElement) => [canvas.width, canvas.height, canvas.isConnected])).toEqual([0, 0, false]);
  const lowWidth = await page.locator('.shadow-stage').evaluate((canvas: HTMLCanvasElement) => canvas.width);
  expect(lowWidth).toBeLessThanOrEqual(512); expect(lowWidth).toBeLessThanOrEqual(originalWidth);
  await expect(page.locator('.shadow-stage')).toHaveAttribute('data-quality', 'lightweight');
  await expect(runtime(page)).toHaveAttribute('data-elapsed', '10000'); await advance(page, 50);
  await expect(runtime(page)).toHaveAttribute('data-elapsed', '10050'); expect(await stored(page)).toEqual(project);
  await notice(page).locator('.performance-restore').click(); await expect(notice(page)).toBeHidden();
  expect(await page.locator('.shadow-stage').evaluate((canvas: HTMLCanvasElement) => canvas.width)).toBe(originalWidth);
  await expect(spatial.locator('.spatial-toggle')).toBeEnabled(); expect(await stored(page)).toEqual(project);
});

test('24fps playback and a few isolated slow seconds do not show the suggestion', async ({ page }) => {
  await clock(page); await seed(page); await openStory(page); await page.locator('#story-play').click();
  await advance(page, 11_000, 1000 / 24); await expect(notice(page)).toBeHidden();
  await advance(page, 5000); await expect(notice(page)).toBeHidden(); await expect(runtime(page)).toHaveAttribute('data-state', 'playing');
});

test('pause, blur, long gaps and route disposal reset the slow streak and reject late callbacks', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  // Shared 2D cleanup also works without the modern Element.remove convenience method.
  await page.addInitScript(() => { Reflect.deleteProperty(Element.prototype, 'remove'); });
  await clock(page); await seed(page); await openStory(page); await page.locator('#story-play').click(); await advance(page, 6000);
  await page.locator('#story-pause').click(); await advance(page, 60_000, 60_000); expect(await frameCount(page)).toBe(0);
  await page.locator('#story-play').click(); await advance(page, 4000); await expect(notice(page)).toBeHidden();
  await page.evaluate(() => window.dispatchEvent(new Event('blur'))); expect(await frameCount(page)).toBe(0);
  await page.locator('#story-play').click(); await advance(page, 6000); await expect(notice(page)).toBeHidden();
  await advance(page, 300, 300); await expect(runtime(page)).toHaveAttribute('data-state', 'paused');
  await page.locator('#story-play').click(); await advance(page, 4000); await expect(notice(page)).toBeHidden();
  await page.evaluate(() => { location.hash = '#/about'; }); await expect(page.locator('#app-view')).toHaveAttribute('data-route', '/about');
  await page.evaluate(() => Reflect.get(window, '__late')()); expect(await frameCount(page)).toBe(0); await expect(notice(page)).toHaveCount(0);
  await page.evaluate(() => { location.hash = '#/story'; }); await expect(runtime(page)).toHaveAttribute('data-state', 'paused', wait);
  await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state', 'ready', wait);
  await page.locator('#story-play').click(); await advance(page, 9950); await expect(notice(page)).toBeHidden();
  await advance(page, 50); await expect(notice(page)).toBeVisible(); expect(errors).toEqual([]);
});

test('continuing the current picture dismisses the suggestion without switching quality or adding clocks', async ({ page }) => {
  await clock(page); const project = await seed(page); await openStory(page); await page.locator('#story-play').click(); await advance(page, 10_000);
  await notice(page).locator('.performance-keep').click(); await advance(page, 12_000);
  await expect(notice(page)).toHaveAttribute('data-state', 'dismissed'); await expect(notice(page)).toBeHidden();
  await expect(page.locator('.shadow-stage')).not.toHaveAttribute('data-quality', 'lightweight');
  await expect(runtime(page)).toHaveAttribute('data-state', 'playing'); expect(await frameCount(page)).toBe(1); expect(await stored(page)).toEqual(project);
});

test('lightweight choice survives short-stage route changes and refresh returns to the default display', async ({ page }) => {
  await clock(page); const project = await seed(page); await openStory(page); await page.locator('#story-play').click(); await advance(page, 10_000);
  await notice(page).locator('.performance-lightweight').click();
  await page.evaluate(() => { location.hash = '#/about'; }); await expect(page.locator('#app-view')).toHaveAttribute('data-route', '/about');
  await page.evaluate(() => Reflect.get(window, '__late')()); expect(await frameCount(page)).toBe(0);
  await page.evaluate(() => { location.hash = '#/story'; }); await expect(runtime(page)).toHaveAttribute('data-state', 'paused', wait);
  await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state', 'ready', wait);
  await expect(page.locator('.shadow-stage')).toHaveAttribute('data-quality', 'lightweight');
  await expect(notice(page)).toHaveAttribute('data-state', 'lightweight');
  expect((await stored(page)).story).toEqual(project.story);
  await notice(page).locator('.performance-restore').click(); await page.locator('#story-play').click(); await advance(page, 10_000);
  await expect(notice(page)).toHaveAttribute('data-state', 'suggested');
  await expect(notice(page).locator('.performance-lightweight')).toBeVisible();
  await expect(notice(page).locator('.performance-keep')).toBeVisible();
  await expect(notice(page).locator('.performance-restore')).toBeHidden();
  await notice(page).locator('.performance-lightweight').click();
  await page.reload(); await expect(runtime(page)).toHaveAttribute('data-state', 'paused', wait);
  await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state', 'ready', wait);
  await expect(notice(page)).toBeHidden(); await expect(page.locator('.spatial-toggle')).toBeEnabled();
  await expect(page.locator('.shadow-stage')).not.toHaveAttribute('data-quality', 'lightweight');
});

test('practice keyboard motion shares the monitor and display quality cannot change the frozen performance', async ({ page }) => {
  await clock(page); const project = await seed(page, '/practice'); await page.goto('/#/practice');
  await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state', 'ready', wait); await saved(page);
  await page.locator('.rod-handle[data-rod=body]').focus(); await page.keyboard.down('ArrowRight'); await advance(page, 10_000);
  await expect(notice(page)).toBeVisible(); expect(await frameCount(page)).toBe(1);
  await page.keyboard.up('ArrowRight'); await saved(page); const checkpoint = await stored(page);
  expect(checkpoint.story).toEqual(project.story); expect(checkpoint.pose).not.toEqual(project.pose);
  await notice(page).locator('.performance-lightweight').click(); expect(await stored(page)).toEqual(checkpoint);
  expect(await frameCount(page)).toBe(0); await expect(page.locator('.shadow-stage')).toHaveAttribute('data-quality', 'lightweight');
});

test('read-only reunion replay offers the same suggestion and leaves the complete saved result untouched', async ({ page }) => {
  await clock(page); const project = await seed(page, '/result'); await page.goto('/#/result');
  await expect(page.locator('#result-replay')).toBeEnabled(wait); await page.locator('#result-replay').click();
  await expect(page.locator('#result-replay-player .canvas-stage-status')).toHaveAttribute('data-state', 'ready', wait);
  await page.locator('#replay-play').click(); await advance(page, 10_000);
  await expect(notice(page)).toBeVisible(); await expect(page.locator('#replay-status')).toContainText('播放中'); expect(await frameCount(page)).toBe(1);
  await notice(page).locator('.performance-lightweight').click(); expect(await stored(page)).toEqual(project);
  await page.locator('#result-replay').click(); await page.evaluate(() => Reflect.get(window, '__late')());
  expect(await frameCount(page)).toBe(0); await expect(notice(page)).toHaveCount(0); expect(await stored(page)).toEqual(project);
});
