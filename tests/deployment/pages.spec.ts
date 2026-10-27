import { readFileSync } from 'node:fs';
import { test, expect } from '../e2e/formal-fixture';
import type { Page } from '@playwright/test';
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

test('production entry, fonts, museum thumbnails and enlarged photos stay within the deployment directory', async ({ page, request, baseURL }) => {
  const problems = observe(page, baseURL!);
  const entry = await page.goto(baseURL!);
  expect(entry?.ok()).toBe(true);
  await expect(page.locator('#title')).toBeVisible();
  expect(await page.evaluate(() => document.fonts.load('18px "Yingzuo Kai"').then(fonts => fonts.length))).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.fonts.load('32px "Yingzuo Brush"').then(fonts => fonts.length))).toBeGreaterThan(0);
  for (const image of media.media) {
    const response = await request.get(new URL(image.localPath.replace(/^\/+/, ''), baseURL!).href);
    expect(response.ok(), image.id).toBe(true);
    expect(response.headers()['content-type'], image.id).toMatch(/^image\//);
  }
  await page.goto(baseURL! + '#/museum');
  const cover = page.locator('.museum-hero img');
  await expect(cover).toBeVisible();
  await expect.poll(() => cover.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.goto(baseURL! + '#/museum/E07');
  const opener = page.locator('#museum-gallery .museum-photo-enlarge').first();
  await opener.click();
  const image = page.getByRole('dialog').locator('img');
  await expect.poll(() => image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  expect(new URL((await image.getAttribute('src'))!, baseURL!).pathname).toContain(new URL(baseURL!).pathname + 'assets/');
  await page.getByRole('button', { name: '关闭大图 ×' }).click();
  await expect(opener).toBeFocused();
  await page.goto(new URL('credits.html', baseURL!).href);
  await expect(page.locator('#voice')).toContainText('Yunyang');
  expect(problems).toEqual([]);
});

test('saved colors, JSON export and native v5 voice work after a project-directory refresh', async ({ page, baseURL }) => {
  const problems = observe(page, baseURL!);
  await page.goto(baseURL! + '#/craft');
  await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state', 'ready', { timeout: 20000 });
  await expect(page.locator('#craft-palette')).toBeEnabled();
  await page.locator('#craft-palette').selectOption('indigo-v1');
  await page.locator('#craft-apply-palette').click();
  await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'saved');
  await page.reload();
  await expect(page.locator('#craft-palette')).toHaveValue('indigo-v1');
  await page.locator('#open-project-tools').click();
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-project').click();
  const download = await downloaded;
  expect(JSON.parse(readFileSync((await download.path())!, 'utf8')).appearance.paletteId).toBe('indigo-v1');
  await page.locator('#open-project-tools').click();
  await page.goto(baseURL!);
  await page.getByRole('button', { name: '节选导览', exact: true }).click();
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-node', 'intro');
  await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state', 'ready', { timeout: 20000 });
  await page.locator('#story-runtime').click();
  // A trusted gesture also unlocks native media when the browser requires it.
  if (await page.locator('#story-play').isEnabled()) await page.locator('#story-play').click();
  if (await page.locator('#story-voice-toggle').textContent() === '重试中文配音') await page.locator('#story-voice-toggle').click();
  await expect(page.locator('#story-voice-status')).toHaveAttribute('data-playing', 'true', { timeout: 20000 });
  await page.locator('#story-pause').click();
  await expect(page.locator('#story-voice-status')).toHaveAttribute('data-playing', 'false');
  await page.reload();
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-node', 'intro');
  expect(problems).toEqual([]);
});

test('lamp workshop loads its lazy Three module and keeps a working two-dimensional alternative', async ({ page, baseURL }) => {
  const problems = observe(page, baseURL!);
  await page.goto(baseURL! + '#/light');
  const stage = page.locator('.lamp-spatial-host .three-stage');
  await expect(stage).toHaveAttribute('data-state', 'ready', { timeout: 20000 });
  await page.getByRole('button', { name: '改用二维灯影', exact: true }).click();
  await expect(stage).toHaveCount(0);
  await expect(page.locator('.lamp-status')).toContainText('二维灯影已就绪');
  await expect(page.locator('.lamp-shadow-host canvas')).toBeVisible();
  await page.locator('#light-lamp').fill('0.2');
  await expect(page.locator('#light-summary')).toContainText('灯位 0.20');
  expect(problems).toEqual([]);
});
