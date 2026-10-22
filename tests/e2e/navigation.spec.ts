import { expect, test } from '@playwright/test';
import type { Download, Page } from '@playwright/test';
import type { ProjectV1 } from '../../src/domain/types';
import fixture from '../fixtures/project-v1.json' with { type: 'json' };
import future from '../fixtures/unknown-version.json' with { type: 'json' };
import corrupt from '../fixtures/corrupt-project.json' with { type: 'json' };

const saved = async (page: Page) => expect(page.locator('#save-state')).toHaveAttribute('data-state', 'saved');
async function record(page: Page): Promise<string> {
  return page.evaluate(async () => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('yingzuo-v1', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try { return await new Promise<string>((resolve, reject) => { const r = db.transaction('snapshots').objectStore('snapshots').get('draft'); r.onsuccess = () => resolve(r.result as string); r.onerror = () => reject(r.error); }); }
    finally { db.close(); }
  });
}
const stored = async (page: Page) => JSON.parse(await record(page)) as ProjectV1;
async function seed(page: Page, draft: unknown, backup?: unknown) {
  await page.goto('/study.html');
  await page.evaluate(async entries => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('yingzuo-v1', 1); r.onupgradeneeded = () => r.result.createObjectStore('snapshots'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
    try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('snapshots', 'readwrite'); for (const [key, value] of entries) tx.objectStore('snapshots').put(value, key); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); }
    finally { db.close(); }
  }, [['draft', JSON.stringify(draft)], ...(backup ? [['backup', JSON.stringify(backup)]] : [])]);
}
async function hash(page: Page, path: string) {
  await page.evaluate(value => { window.location.hash = value; }, `#${path}`);
  await expect(page.locator('#app-view')).toHaveAttribute('data-route', path.startsWith('/museum/') ? '/museum' : path);
}
async function downloadJSON(download: Download) {
  expect(await download.failure()).toBeNull(); const stream = await download.createReadStream(), chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk)); return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

test('direct routes, museum children, back and refresh preserve the confirmed performance', async ({ page }) => {
  test.setTimeout(60000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await seed(page, fixture); await page.goto('/#/story'); await saved(page);
  for (const path of ['/', '/craft', '/light', '/story', '/practice', '/result', '/about', '/museum', ...Array.from({ length: 8 }, (_, i) => `/museum/E0${i + 1}`)]) {
    await hash(page, path); await expect(page.locator('#app-view h1')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await saved(page); const before = await stored(page);
  expect(before.story).toEqual(fixture.story); expect(before.projectId).toBe(fixture.projectId);
  expect([...before.museum.visitedExhibitIds].sort()).toEqual(['E01','E02','E03','E04','E05','E06','E07','E08']); expect(before.lastRoute).toBe('/museum');
  await page.goBack(); await expect(page).toHaveURL(/#\/museum\/E07$/);
  await page.reload(); await saved(page); expect((await stored(page)).story).toEqual(fixture.story);
  expect(errors).toEqual([]);
});

test('URLs cannot start a story or manufacture a completed result', async ({ page }) => {
  await page.goto('/#/story'); await saved(page); expect((await stored(page)).story).toBeNull();
  await hash(page, '/result'); await expect(page.locator('#app-view')).toContainText('尚未开演');
  await page.evaluate(() => { window.location.hash = '#/story/curtain'; }); await expect(page).toHaveURL(/#\/$/);
  await expect(page.locator('#app-notice')).toContainText('已回到剧场首页'); await saved(page);
  expect((await stored(page)).story).toBeNull();
});

test('explicit guided opening and intro skip persist once, and ten remounts cannot repeat the command', async ({ page }) => {
  await page.goto('/'); await saved(page); const id = (await stored(page)).projectId;
  await page.getByRole('button', { name: '节选导览', exact: true }).click(); await expect(page).toHaveURL(/#\/story$/); await saved(page);
  const intro = (await stored(page)).story!; expect(intro).toMatchObject({ nodeId: 'intro', mode: 'guided', revision: 0 });
  for (let i = 0; i < 10; i++) { await hash(page, '/museum/E04'); await hash(page, '/story'); }
  await page.getByRole('button', { name: '先为他备好行装', exact: true }).click(); await expect(page).toHaveURL(/#\/story$/); await saved(page);
  const after = await stored(page); expect(after.projectId).toBe(id); expect(after.story).toMatchObject({ runId: intro.runId, nodeId: 'craft', revision: 1 });
  await page.reload(); await saved(page); expect((await stored(page)).story).toEqual(after.story);
});

test('craft saves the current editor while leaving frozen cast and decision intact', async ({ page }) => {
  await seed(page, fixture); await page.goto('/#/craft'); await saved(page);
  await page.getByLabel('衣上的纹样').selectOption('flower-v1'); await page.getByLabel('这一套颜色').selectOption('woodland-v1');
  await page.getByRole('button', { name: '保存这身行装', exact: true }).click(); await saved(page);
  const project = await stored(page); expect(project.appearance).toMatchObject({ patternId: 'flower-v1', paletteId: 'woodland-v1' }); expect(project.story).toEqual(fixture.story);
  await hash(page, '/museum/E03'); await hash(page, '/craft'); await page.reload(); await saved(page);
  await expect(page.getByLabel('衣上的纹样')).toHaveValue('flower-v1'); await expect(page.getByLabel('这一套颜色')).toHaveValue('woodland-v1');
});

test('a failed opening stays on the old page, exports its candidate and retries the identical run', async ({ page }) => {
  await page.goto('/'); await saved(page);
  await page.evaluate(() => { const put = IDBObjectStore.prototype.put; let fail = true; IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) { if (fail && key === 'draft') { fail = false; throw new DOMException('Injected quota failure', 'QuotaExceededError'); } return put.call(this, value, key); }; });
  await page.getByRole('button', { name: '节选导览', exact: true }).click(); await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'error');
  expect((await stored(page)).story).toBeNull(); await page.evaluate(() => { window.location.hash = '#/museum'; });
  await expect(page).toHaveURL(/#\/$/); await expect(page.locator('#app-view')).toHaveAttribute('data-route', '/'); await expect(page.locator('#app-notice')).toContainText('先处理待保存动作');
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: '导出当前作品', exact: true }).click(); const candidate = await downloadJSON(await downloading);
  expect(candidate.story.nodeId).toBe('intro'); await page.getByRole('button', { name: '重试保存', exact: true }).click(); await saved(page);
  expect((await stored(page)).story).toEqual(candidate.story); await hash(page, '/story'); await expect(page.locator('#app-view')).toContainText('先为他备好行装');
});

test('denied storage keeps an editable export and an explicit memory-only opening', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('Denied for test', 'SecurityError'); } }));
  await page.goto('/#/craft'); await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'error');
  await page.getByLabel('衣上的纹样').selectOption('wave-v1'); await hash(page, '/story');
  await page.getByRole('button', { name: '确认开始这一场', exact: true }).click(); await expect(page.locator('#cancel-pending')).toBeVisible();
  await page.getByRole('button', { name: '仅在本页继续（未保存）', exact: true }).click(); await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'memory');
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: '导出当前作品', exact: true }).click(); const project = await downloadJSON(await downloading);
  expect(project.story.nodeId).toBe('intro'); expect(project.appearance.patternId).toBe('wave-v1'); expect(project.saveRevision).toBe(0);
});

test('archive/import use the shared serial entry, and cancel preserves the existing project', async ({ page }) => {
  await page.goto('/'); await saved(page); const original = (await stored(page)).projectId;
  await page.getByRole('button', { name: /我的作品/ }).click();
  await page.getByRole('button', { name: '归档并新建作品', exact: true }).click(); await saved(page);
  await expect.poll(async () => (await stored(page)).projectId).not.toBe(original); const current = (await stored(page)).projectId;
  await page.getByLabel('导入作品 JSON').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'error');
  await page.getByRole('button', { name: '取消待保存动作', exact: true }).click(); await saved(page); expect((await stored(page)).projectId).toBe(current);
  await page.getByLabel('允许替换已有的上一项目', { exact: false }).check();
  await page.getByLabel('导入作品 JSON').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await expect.poll(async () => (await stored(page)).story).toEqual(fixture.story);
  expect((await stored(page)).projectId).not.toBe(current); expect((await stored(page)).projectId).not.toBe(fixture.projectId);
});

test('workbench recovery can be explicitly reread without leaving the product stuck', async ({ page, context }) => {
  await seed(page, corrupt, fixture); await page.goto('/#/story'); await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'recovery');
  const lab = await context.newPage(); await lab.goto('/project.html');
  await lab.getByRole('button', { name: '恢复已读取的有效备份', exact: true }).click(); await expect(lab.locator('#project-status')).toHaveAttribute('data-state', 'saved'); await lab.close();
  await page.getByRole('button', { name: '处理完成，重新读取本机作品', exact: true }).click(); await saved(page);
  expect((await stored(page)).story).toEqual(fixture.story); await expect(page.locator('#app-view')).toContainText('暂停接续');
});

test('a real curtain checkpoint produces the actual programme and prepared reunion image', async ({ page }) => {
  const project = { ...fixture, story: { ...fixture.story, nodeId: 'curtain', revision: 15, completedAt: '2026-10-17T00:00:00.000Z' } };
  await seed(page, project); await page.goto('/#/result'); await saved(page);
  await expect(page.locator('#app-view h1')).toHaveText('这一回，终于相见。'); await expect(page.locator('.programme')).toContainText('先举灯呼唤');
  await expect(page.locator('.programme')).toContainText('团圆已保存，谢幕尚未结束'); expect((await stored(page)).story).toEqual(project.story);
  await expect(page.locator('#result-png')).toBeEnabled();
});

for (const [label, draft, backup, status] of [
  ['future', future, fixture, 'unsupported'], ['corrupt', corrupt, fixture, 'recovery'],
] as const) test(`${label} records remain protected while the museum is readable`, async ({ page }) => {
  await seed(page, draft, backup); await page.goto('/#/museum/E01'); await expect(page.locator('#save-state')).toHaveAttribute('data-state', status);
  await expect(page.locator('#app-view h1')).toBeVisible(); await expect(page.getByRole('button', { name: '归档并新建作品', exact: true })).toBeDisabled();
  await hash(page, '/story'); await expect(page.getByRole('button', { name: '确认开始这一场', exact: true })).toBeDisabled();
  expect(await record(page)).toBe(JSON.stringify(draft));
});

test('alias redirects once, keyboard skip does not change route and mobile menu has real focus targets', async ({ page }, info) => {
  await page.goto('/#/stage'); await expect(page).toHaveURL(/#\/practice$/); await saved(page);
  await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#main')).toBeFocused(); await expect(page).toHaveURL(/#\/practice$/);
  if (info.project.name.startsWith('mobile')) { await page.getByRole('button', { name: '菜单', exact: true }).click(); await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded', 'true'); }
  await page.locator('#primary-nav').getByRole('link', { name: '展馆', exact: true }).click(); await expect(page).toHaveURL(/#\/museum$/); await expect(page.locator('#app-view h1')).toBeFocused();
  await page.goBack(); await expect(page).toHaveURL(/#\/practice$/); expect((await stored(page)).story).toBeNull();
});

test('legacy product entry uses the same project and can save an editor change in Chromium', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.route('http://127.0.0.1:4173/', async route => { const response = await route.fetch(); const html = (await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g, '').replace(/\snomodule\b/g, ''); await route.fulfill({ response, body: html }); });
  await page.goto('/#/craft'); await expect(page.locator('#app-runtime')).toHaveAttribute('data-entry', 'legacy'); await saved(page);
  await page.getByLabel('衣上的纹样').selectOption('wave-v1'); await page.getByRole('button', { name: '保存这身行装', exact: true }).click(); await saved(page);
  expect((await stored(page)).appearance.patternId).toBe('wave-v1'); expect(errors).toEqual([]);
});

test('static product introduction remains readable without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
  await page.goto('http://127.0.0.1:4173/'); await expect(page.locator('#fallback-title')).toBeVisible();
  await page.getByRole('link', { name: '认识这出戏', exact: true }).click(); await expect(page.locator('#static-story')).toBeInViewport();
  await expect(page.locator('#static-museum')).toContainText('五个展区'); await expect(page.locator('#open-project-tools')).toBeHidden(); await context.close();
});
