import { readFileSync } from 'node:fs';
import { test, expect } from '../e2e/formal-fixture';
import type { Page } from '@playwright/test';
import {currentProject} from '../helpers/current-project';
import media from '../../src/content/museum-media.json' with { type: 'json' };

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

test('quick trial lazy scripts, images and native voice stay in the hosting directory',async({page,baseURL})=>{
  const problems=observe(page,baseURL!);
  await page.goto(baseURL!);await page.locator('#intro-quick-trial').click();
  await expect(page.locator('#quick-trial .canvas-stage-status')).toHaveAttribute('data-state','ready',{timeout:20000});
  if(await page.locator('#trial-play').isEnabled())await page.locator('#trial-play').click();
  await expect(page.locator('#quick-trial')).toHaveAttribute('data-segment','intro',{timeout:15000});
  await expect(page.locator('#trial-voice-status')).toHaveAttribute('data-playing','true',{timeout:15000});
  await page.locator('#trial-close').click();await expect(page.locator('#quick-trial')).toHaveCount(0);
  expect(problems).toEqual([]);
});

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

test('saved colors, JSON export and native Chinese voice work after a project-directory refresh', async ({ page, baseURL }) => {
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
  test(`craft entry starts voiced story: ${mode}, ${preset ? 'preset' : 'current'} appearance`, async ({ page, baseURL }) => {
    const problems = observe(page, baseURL!);
    const readyTimeout = process.env.YINGZUO_PAGES_URL ? 60000 : 20000;
    await page.goto(baseURL! + '#/craft', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state', 'ready', { timeout: readyTimeout });
    await page.locator('.craft-direct-entry > summary').click();
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
    // The actual craft confirmation must be enough; do not mask an entry bug
    // with extra play, stage or voice-retry gestures in this regression.
    await expect(page.locator('#story-voice-status')).toHaveAttribute('data-playing', 'true', { timeout: readyTimeout });
    expect(problems).toEqual([]);
  });
}


async function seedTheatre(page:Page,baseURL:string,node:'completed'|'memory-words'){
 await page.goto(baseURL+'study.html');await page.evaluate(async project=>{const db=await new Promise<IDBDatabase>((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});try{await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(project),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});}finally{db.close();}},currentProject(node));
}

test('completed theatre opens its programme automatically within the hosting directory',async({page,baseURL})=>{
 const problems=observe(page,baseURL!);await seedTheatre(page,baseURL!,'completed');await page.goto(baseURL!+'#/story');await expect(page.locator('#app-view')).toHaveAttribute('data-route','/result');await expect(page.locator('.reunion-artifact')).toHaveAttribute('data-state','ready',{timeout:20000});await page.reload();await expect(page.locator('#app-view')).toHaveAttribute('data-route','/result');expect(problems).toEqual([]);
});

test('theatre fits a full curtain without a listening card in the hosting directory',async({page,baseURL})=>{
 const problems=observe(page,baseURL!);await seedTheatre(page,baseURL!,'memory-words');await page.goto(baseURL!+'#/story');await expect(page.locator('.page-content .canvas-stage-status')).toHaveAttribute('data-state','ready',{timeout:20000});await expect.poll(()=>page.locator('.page-content .canvas-stage-screen').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight+1;}),{timeout:20000}).toBe(true);await expect(page.locator('.story-stage-slot .story-feedback-inline')).toHaveCount(0);await expect(page.locator('.control-panel .story-feedback-inline')).toBeHidden();expect(problems).toEqual([]);
});
