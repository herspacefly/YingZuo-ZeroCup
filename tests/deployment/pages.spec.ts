import { readFileSync } from 'node:fs';
import { test, expect } from '../e2e/formal-fixture';
import type { Page } from '@playwright/test';
import media from '../../src/content/museum-media.json' with { type: 'json' };
import fixture from '../fixtures/project-v1.json' with { type: 'json' };
import type { ProjectV1 } from '../../src/domain/types';

function observe(page: Page, baseURL: string) {
  const base = new URL(baseURL), problems: string[] = [];
  page.on('pageerror', error => problems.push(error.message));
  page.on('response', response => {
    const url = new URL(response.url()), kind = response.request().resourceType();
    if (url.origin !== base.origin || !['script', 'stylesheet', 'image', 'font', 'media'].includes(kind)) return;
    if (!url.pathname.startsWith(base.pathname) || response.status() >= 400) problems.push(`${response.status()} ${url.pathname}`);
  });
  return problems;
}

test('production entry, fonts, museum thumbnails and enlarged photos stay within the deployment directory', async ({ page, request, baseURL }) => {
  const problems = observe(page, baseURL!);
  const entry = await page.goto(baseURL!, { waitUntil: 'domcontentloaded' });
  expect(entry?.ok()).toBe(true);
  await expect(page.locator('#title')).toBeVisible();
  expect(await page.evaluate(() => document.fonts.load('18px "Yingzuo Kai"').then(fonts => fonts.length))).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.fonts.load('32px "Yingzuo Brush"').then(fonts => fonts.length))).toBeGreaterThan(0);
  await Promise.all(media.media.map(async image => {
    const response = await request.get(new URL(image.localPath.replace(/^\/+/, ''), baseURL!).href);
    expect(response.ok(), image.id).toBe(true);
    expect(response.headers()['content-type'], image.id).toMatch(/^image\//);
  }));
  await page.goto(baseURL! + '#/museum', { waitUntil: 'domcontentloaded' });
  const cover = page.locator('.museum-hero img');
  await expect(cover).toBeVisible();
  await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.goto(baseURL! + '#/museum/E07', { waitUntil: 'domcontentloaded' });
  const opener = page.locator('#museum-gallery .museum-photo-enlarge').first();
  await opener.click();
  const image = page.getByRole('dialog').locator('img');
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(new URL((await image.getAttribute('src'))!, baseURL!).pathname).toContain(new URL(baseURL!).pathname + 'assets/');
  await page.getByRole('button', { name: '关闭大图 ×' }).click();
  await expect(opener).toBeFocused();
  await page.goto(new URL('credits.html', baseURL!).href, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#voice')).toContainText('Yunyang');
  expect(problems).toEqual([]);
});

test('saved colors, JSON export and native v5 voice work after a project-directory refresh', async ({ page, baseURL }) => {
  const problems = observe(page, baseURL!);
  const readyTimeout = process.env.YINGZUO_PAGES_URL ? 60000 : 20000;
  await page.goto(baseURL! + '#/craft', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state', 'ready', { timeout: readyTimeout });
  await expect(page.locator('#craft-palette')).toBeEnabled();
  await page.locator('#craft-palette').selectOption('indigo-v1');
  await page.locator('#craft-apply-palette').click();
  await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'saved');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#craft-palette')).toHaveValue('indigo-v1');
  await page.locator('#open-project-tools').click();
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-project').click();
  const download = await downloaded;
  expect(JSON.parse(readFileSync((await download.path())!, 'utf8')).appearance.paletteId).toBe('indigo-v1');
  await page.locator('#open-project-tools').click();
  await page.goto(baseURL!, { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: '节选导览', exact: true }).click();
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-node', 'intro');
  await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state', 'ready', { timeout: readyTimeout });
  await page.locator('#story-runtime').click();
  // A trusted gesture also unlocks native media when the browser requires it.
  if (await page.locator('#story-play').isEnabled()) await page.locator('#story-play').click();
  if (await page.locator('#story-voice-toggle').textContent() === '重试中文配音') await page.locator('#story-voice-toggle').click();
  await expect(page.locator('#story-voice-status')).toHaveAttribute('data-playing', 'true', { timeout: readyTimeout });
  await page.locator('#story-pause').click();
  await expect(page.locator('#story-voice-status')).toHaveAttribute('data-playing', 'false');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-node', 'intro');
  expect(problems).toEqual([]);
});

test('lamp workshop loads its lazy Three module and keeps a working two-dimensional alternative', async ({ page, baseURL }) => {
  const problems = observe(page, baseURL!);
  await page.goto(baseURL! + '#/light', { waitUntil: 'domcontentloaded' });
  const stage = page.locator('.lamp-spatial-host .three-stage');
  await expect(stage).toHaveAttribute('data-state', 'ready', { timeout: process.env.YINGZUO_PAGES_URL ? 60000 : 20000 });
  await page.getByRole('button', { name: '改用二维灯影', exact: true }).click();
  await expect(stage).toHaveCount(0);
  await expect(page.locator('.lamp-status')).toContainText('二维灯影已就绪');
  await expect(page.locator('.lamp-shadow-host canvas')).toBeVisible();
  await page.locator('#light-lamp').fill('0.2');
  await expect(page.locator('#light-summary')).toContainText('灯位 0.20');
  expect(problems).toEqual([]);
});

for (const mode of ['full', 'guided'] as const) for (const preset of [false, true]) {
  test(`craft entry starts voiced v5: ${mode}, ${preset ? 'preset' : 'current'} appearance`, async ({ page, baseURL }) => {
    const problems = observe(page, baseURL!);
    const readyTimeout = process.env.YINGZUO_PAGES_URL ? 60000 : 20000;
    await page.goto(baseURL! + '#/craft', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state', 'ready', { timeout: readyTimeout });
    await page.locator('#craft-mode').selectOption(mode);
    await page.locator(preset ? '#craft-preset' : '#craft-confirm').click();
    await expect(page.locator('#story-runtime')).toHaveAttribute('data-node', 'memory-wave');
    await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'saved');
    const story = await page.evaluate(async () => {
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const open = indexedDB.open('yingzuo-v1', 1); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
      });
      try {
        const raw = await new Promise<string>((resolve, reject) => {
          const read = db.transaction('snapshots').objectStore('snapshots').get('draft'); read.onsuccess = () => resolve(read.result as string); read.onerror = () => reject(read.error);
        });
        return JSON.parse(raw).story as { definitionVersion: number; mode: string; presetAppearanceUsed: boolean };
      } finally { db.close(); }
    });
    expect(story).toMatchObject({ definitionVersion: 5, mode, presetAppearanceUsed: preset });
    await expect(page.locator('#story-voice-toggle')).toBeVisible();
    await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state', 'ready', { timeout: readyTimeout });
    await page.locator('#story-runtime').click();
    if (await page.locator('#story-play').isEnabled()) await page.locator('#story-play').click();
    if (await page.locator('#story-voice-toggle').textContent() === '重试中文配音') await page.locator('#story-voice-toggle').click();
    await expect(page.locator('#story-voice-status')).toHaveAttribute('data-playing', 'true', { timeout: readyTimeout });
    expect(problems).toEqual([]);
  });
}

test('old craft performances stay intact and explicitly archiving opens a voiced new edition', async ({ page, baseURL }) => {
  const legacy = structuredClone(fixture) as ProjectV1;
  Object.assign(legacy.story!, { definitionVersion: 4, nodeId: 'intro', revision: 0, mode: 'guided', approach: null, approachSource: null, ending: null, endingSource: null, castSnapshot: null, assistedNodeIds: [], completedAt: null });
  delete legacy.story!.choices;
  await page.goto(new URL('study.html', baseURL!).href, { waitUntil: 'domcontentloaded' });
  await page.evaluate(async value => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('yingzuo-v1', 1); open.onupgradeneeded = () => open.result.createObjectStore('snapshots'); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction('snapshots', 'readwrite'); tx.objectStore('snapshots').put(JSON.stringify(value), 'draft'); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
      });
    } finally { db.close(); }
  }, legacy);
  await page.goto(baseURL! + '#/craft', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#craft-confirm')).toBeEnabled({ timeout: process.env.YINGZUO_PAGES_URL ? 60000 : 20000 });
  await page.locator('#craft-confirm').click();
  await expect(page.locator('#story-version-note')).toContainText('未接入中文配音');
  await expect(page.locator('#story-voice-toggle')).toBeHidden();
  await page.locator('#story-version-note a').click();
  await page.locator('#craft-restart').click();
  await expect(page.locator('#craft-confirm')).toBeEnabled();
  await page.locator('#craft-confirm').click();
  await expect(page.locator('#story-voice-toggle')).toBeVisible();
  await expect(page.locator('#story-version-note')).toBeHidden();
  const archive = await page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const open = indexedDB.open('yingzuo-v1', 1); open.onsuccess = () => resolve(open.result); open.onerror = () => reject(open.error);
    });
    try { return await new Promise<string>((resolve, reject) => {
      const read = db.transaction('snapshots').objectStore('snapshots').get('previous-project'); read.onsuccess = () => resolve(read.result as string); read.onerror = () => reject(read.error);
    }); } finally { db.close(); }
  });
  expect(JSON.parse(archive).story).toMatchObject({ definitionVersion: 4, runId: legacy.story!.runId, nodeId: 'memory-wave' });
});
