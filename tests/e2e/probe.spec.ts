import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function setLamp(page: Page, value: number) {
  await page.locator('#lamp-x').fill(String(value));
}

test('production canvas responds to keyboard and has no horizontal overflow', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/study.html');
  await expect(page.locator('#canvas-status')).toHaveAttribute('data-state', 'ready');
  const before = await page.locator('canvas').evaluate((element: HTMLCanvasElement) => element.toDataURL());
  await page.locator('#lamp-x').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#lamp-value')).toHaveText('51');
  const after = await page.locator('canvas').evaluate((element: HTMLCanvasElement) => element.toDataURL());
  expect(after).not.toBe(before);
  await page.getByRole('button', { name: '灯归原处' }).click();
  await expect(page.locator('#lamp-x')).toHaveValue('50');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('home.png'), fullPage: true });
});

test('commits, reloads and rolls back in actual browser IndexedDB', async ({ page }) => {
  await page.goto('/probe.html');
  await expect(page.locator('#runtime-status')).toHaveAttribute('data-entry', 'modern');
  await expect(page.locator('#storage-status')).toHaveAttribute('data-state', 'ready');
  await setLamp(page, 25);
  await page.getByRole('button', { name: '保存当前灯位', exact: true }).click();
  await expect(page.locator('#storage-status')).toHaveAttribute('data-state', 'saved');
  await setLamp(page, 73);
  await page.getByRole('button', { name: '保存当前灯位', exact: true }).click();
  await expect(page.locator('#storage-status')).toContainText('第 2 版');
  const snapshot = await page.locator('#stored-value').textContent();
  await page.getByRole('button', { name: '验证中止回滚' }).click();
  await expect(page.locator('#storage-status')).toHaveAttribute('data-state', 'rollback-passed');
  await expect(page.locator('#stored-value')).toHaveText(snapshot!);
  await page.reload();
  await expect(page.locator('#storage-status')).toHaveAttribute('data-state', 'restored');
  await expect(page.locator('#lamp-x')).toHaveValue('73');
  await expect(page.locator('#stored-value')).toHaveText(snapshot!);
});

test('stale second tab keeps its unsaved sample and reports a conflict', async ({ page, context }) => {
  await page.goto('/probe.html');
  await expect(page.locator('#storage-status')).toHaveAttribute('data-state', 'ready');
  await page.getByRole('button', { name: '保存当前灯位', exact: true }).click();
  await expect(page.locator('#storage-status')).toHaveAttribute('data-state', 'saved');
  const second = await context.newPage();
  await second.goto('/probe.html');
  await expect(second.locator('#storage-status')).toHaveAttribute('data-state', 'restored');
  await setLamp(page, 22);
  await page.getByRole('button', { name: '保存当前灯位', exact: true }).click();
  await expect(page.locator('#storage-status')).toContainText('第 2 版');
  await setLamp(second, 81);
  await second.getByRole('button', { name: '保存当前灯位', exact: true }).click();
  await expect(second.locator('#storage-status')).toContainText('另一页面已更新');
  await expect(second.locator('#lamp-x')).toHaveValue('81');
  await page.reload();
  await expect(page.locator('#lamp-x')).toHaveValue('22');
});

test('denied storage preserves an editable sample and offers a real download', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('Blocked for test', 'SecurityError'); } });
  });
  await page.goto('/probe.html');
  await expect(page.locator('#storage-status')).toHaveAttribute('data-state', 'error');
  await expect(page.getByRole('button', { name: '保存当前灯位', exact: true })).toBeDisabled();
  await setLamp(page, 64);
  await expect(page.locator('#storage-status')).toContainText('本地存储不可用');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: '导出当前测试记录' }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe('yingzuo-light-probe.json');
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  expect(JSON.parse(Buffer.concat(chunks).toString('utf8'))).toMatchObject({
    kind: 'yingzuo-light-probe', sample: { lampX: 64, distance: 30 },
  });
});

test('legacy production chunks operate in Chromium smoke check, not an IE test', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/probe.html', async route => {
    const response = await route.fetch();
    const html = (await response.text())
      .replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g, '')
      .replace(/\snomodule\b/g, '');
    await route.fulfill({ response, body: html });
  });
  await page.goto('/probe.html');
  await expect(page.locator('#runtime-status')).toHaveAttribute('data-entry', 'legacy');
  await expect(page.locator('#canvas-status')).toHaveAttribute('data-state', 'ready');
  await expect(page.locator('#storage-status')).toHaveAttribute('data-state', 'ready');
  await setLamp(page, 67);
  await page.getByRole('button', { name: '保存当前灯位', exact: true }).click();
  await expect(page.locator('#storage-status')).toHaveAttribute('data-state', 'saved');
  await page.getByRole('button', { name: '验证中止回滚' }).click();
  await expect(page.locator('#storage-status')).toHaveAttribute('data-state', 'rollback-passed');
  await page.reload();
  await expect(page.locator('#storage-status')).toHaveAttribute('data-state', 'restored');
  await expect(page.locator('#lamp-x')).toHaveValue('67');
  expect(errors).toEqual([]);
});

test('readable story and museum introduction survives disabled JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/study.html');
  await expect(page.locator('#title')).toHaveText('隔着一张幕，让思念有了形。');
  await expect(page.locator('#title')).toBeVisible();
  await page.getByRole('link', { name: '认识这出戏' }).click();
  await expect(page.locator('#story-title')).toBeInViewport();
  await expect(page.locator('#museum-title')).toBeVisible();
  await expect(page.locator('#light-controls')).toBeHidden();
  await context.close();
});

test('Canvas initialization failure leaves honest readable fallback', async ({ page }) => {
  await page.addInitScript(() => {
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto('/study.html');
  await expect(page.locator('#canvas-status')).toHaveAttribute('data-state', 'unavailable');
  await expect(page.locator('#light-controls')).toBeHidden();
  await expect(page.locator('#story-title')).toBeVisible();
});
