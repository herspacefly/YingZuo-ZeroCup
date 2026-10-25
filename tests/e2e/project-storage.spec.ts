import {test,expect} from './formal-fixture';
import type { Download, Page } from '@playwright/test';
import fixture from '../fixtures/project-v1.json' with { type: 'json' };
import corrupt from '../fixtures/corrupt-project.json' with { type: 'json' };
import future from '../fixtures/unknown-version.json' with { type: 'json' };

async function seed(page: Page, records: Record<string, unknown>) {
  // The study page does not open the formal store, so fixture seeding has no competing writer.
  await page.goto('/study.html');
  await page.evaluate(async entries => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('yingzuo-v1', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
      request.onerror = () => reject(request.error); request.onsuccess = () => resolve(request.result);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction('snapshots', 'readwrite');
      for (const [key, value] of Object.entries(entries)) tx.objectStore('snapshots').put(value, key);
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    });
    database.close();
  }, records);
}
async function downloadedJSON(download: Download) {
  expect(await download.failure()).toBeNull();
  const stream = await download.createReadStream(); const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function exportProject(page: Page) {
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: '导出当前项目', exact: true }).click();
  return downloadedJSON(await downloading);
}
async function exportRaw(page: Page) {
  const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: '导出存储原始记录', exact: true }).click();
  return downloadedJSON(await downloading);
}
const status = (page: Page) => page.locator('#project-status');

test('formal project autosaves and resumes identity and editing choices after real reload', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/project.html'); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  const id = await page.locator('#project-id').textContent();
  await page.getByLabel('作品名称').fill('灯下的一场团圆');
  await page.getByLabel('配色', { exact: true }).selectOption('indigo-v1');
  await page.getByLabel('纹样', { exact: true }).selectOption('flower-v1');
  await expect(page.locator('#project-revision')).toHaveText('2'); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  await page.reload(); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  await expect(page.locator('#project-id')).toHaveText(id!);
  await expect(page.getByLabel('作品名称')).toHaveValue('灯下的一场团圆');
  await expect(page.getByLabel('配色', { exact: true })).toHaveValue('indigo-v1');
  await expect(page.getByLabel('纹样', { exact: true })).toHaveValue('flower-v1');
  const exported = await exportProject(page);
  expect(exported.performance).toBeNull(); expect(exported.partialRecording).toBeNull(); expect(exported.story).toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
  await page.screenshot({ path: test.info().outputPath('project-workbench.png'), fullPage: true });
});

test('imports a real project file as a new project without altering frozen cast or checkpoint', async ({ page }) => {
  await page.goto('/project.html'); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  const oldId = await page.locator('#project-id').textContent();
  await page.getByLabel('导入项目 JSON').setInputFiles({ name: 'fixture.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  await expect(page.locator('#project-node')).toContainText('call-light'); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  const importedId = await page.locator('#project-id').textContent();
  expect(importedId).not.toBe(oldId); expect(importedId).not.toBe(fixture.projectId);
  await page.getByLabel('配色', { exact: true }).selectOption('woodland-v1');
  await page.getByRole('button', { name: '立即保存', exact: true }).click(); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  const exported = await exportProject(page);
  expect(exported.story).toEqual(fixture.story); expect(exported.appearance.paletteId).toBe('woodland-v1');
  expect(exported.story.castSnapshot.appearance.paletteId).toBe('vermilion-v1');
  await page.reload(); await expect(page.locator('#project-id')).toHaveText(importedId!);
  await expect(page.locator('#project-node')).toContainText('call-light');
  const raw = await exportRaw(page); expect(JSON.parse(raw.records.previousProject.slice('string:'.length)).projectId).toBe(oldId);
});

test('malformed and future-version file imports leave the existing current project intact', async ({ page }) => {
  await page.goto('/project.html'); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  const before = await exportProject(page);
  for (const invalid of [corrupt, future]) {
    await page.getByLabel('导入项目 JSON').setInputFiles({ name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalid)) });
    await expect(page.locator('#project-operation')).toContainText('操作未完成');
    expect(await exportProject(page)).toEqual(before);
  }
});

test('pending replacement preserves continuous typing and can be canceled without losing queued edits', async ({ page }) => {
  await page.goto('/project.html'); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  await page.getByRole('button', { name: '归档当前并新建', exact: true }).click(); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  const currentId = await page.locator('#project-id').textContent();
  await page.getByRole('button', { name: '归档当前并新建', exact: true }).click(); await expect(status(page)).toHaveAttribute('data-state', 'error');
  await expect(page.locator('#project-editor-title')).toContainText('待提交');
  const title = page.getByLabel('作品名称'); await title.fill('候选'); await title.pressSequentially('ABC');
  await expect(title).toHaveValue('候选ABC'); expect((await exportProject(page)).title).toBe('候选ABC');
  await page.getByRole('button', { name: '取消待提交操作', exact: true }).click();
  await expect(page.locator('#project-id')).toHaveText(currentId!); await expect(title).toHaveValue('候选ABC');
  await page.getByRole('button', { name: '立即保存', exact: true }).click(); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  await page.reload(); await expect(page.locator('#project-id')).toHaveText(currentId!); await expect(title).toHaveValue('候选ABC');
});

test('new project autosaves keep the previous project recoverable', async ({ page }) => {
  await page.goto('/project.html'); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  const oldId = await page.locator('#project-id').textContent();
  await page.getByLabel('作品名称').fill('上一场');
  await page.getByRole('button', { name: '立即保存', exact: true }).click(); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  await page.getByRole('button', { name: '归档当前并新建', exact: true }).click();
  await expect(page.locator('#project-id')).not.toHaveText(oldId!); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  for (const title of ['新场一', '新场二']) {
    await page.getByLabel('作品名称').fill(title); await page.getByRole('button', { name: '立即保存', exact: true }).click();
    await expect(status(page)).toHaveAttribute('data-state', 'saved');
  }
  const raw = await exportRaw(page); const previous = JSON.parse(raw.records.previousProject.slice('string:'.length));
  expect(previous.projectId).toBe(oldId); expect(previous.title).toBe('上一场');
  await page.locator('#archive-ack').check();
  await page.getByRole('button', { name: '恢复上一项目', exact: true }).click();
  await expect(page.locator('#project-id')).toHaveText(oldId!); await expect(page.getByLabel('作品名称')).toHaveValue('上一场');
  await page.reload(); await expect(page.locator('#project-id')).toHaveText(oldId!);
});

test('damaged draft is quarantined and backup can be edited, saved and reloaded', async ({ page }) => {
  const broken = JSON.stringify(corrupt);
  await seed(page, { draft: broken, backup: JSON.stringify(fixture) });
  await page.goto('/project.html'); await expect(status(page)).toHaveAttribute('data-state', 'recovery');
  expect((await exportRaw(page)).records.draft).toBe(`string:${broken}`);
  await page.getByRole('button', { name: '恢复已读取的有效备份' }).click();
  await expect(status(page)).toHaveAttribute('data-state', 'saved'); await expect(page.locator('#project-node')).toContainText('call-light');
  await page.getByLabel('作品名称').fill('恢复后继续'); await page.getByRole('button', { name: '立即保存', exact: true }).click();
  await expect(page.locator('#project-revision')).toHaveText('5');
  await page.reload(); await expect(page.getByLabel('作品名称')).toHaveValue('恢复后继续');
  await expect(status(page)).toHaveAttribute('data-state', 'saved');
  const raw = await exportRaw(page); expect(raw.records.rawInvalid).toContain(broken.replace(/"/g, '\\"'));
  expect(JSON.parse(raw.records.backup.slice('string:'.length)).saveRevision).toBe(4);
});

test('unknown stored versions remain exportable and cannot be overwritten through recovery', async ({ page }) => {
  const futureJSON = JSON.stringify(future);
  await seed(page, { draft: futureJSON, backup: JSON.stringify(fixture) });
  await page.goto('/project.html'); await expect(status(page)).toHaveAttribute('data-state', 'unsupported');
  await expect(page.getByRole('button', { name: '恢复已读取的有效备份' })).toBeDisabled();
  await expect(page.getByRole('button', { name: '双损坏原稿已可导出，明确新建' })).toBeDisabled();
  expect((await exportRaw(page)).records.draft).toBe(`string:${futureJSON}`);
  await page.reload(); await expect(status(page)).toHaveAttribute('data-state', 'unsupported');
});

test('two tabs retain both versions on conflict and takeover requires an explicit action', async ({ page, context }) => {
  await page.goto('/project.html'); await expect(status(page)).toHaveAttribute('data-state', 'saved');
  const second = await context.newPage(); await second.goto('/project.html'); await expect(status(second)).toHaveAttribute('data-state', 'saved');
  await page.getByLabel('作品名称').fill('另一页面已保存');
  await page.getByRole('button', { name: '立即保存', exact: true }).click(); await expect(page.locator('#project-revision')).toHaveText('2');
  await second.getByLabel('作品名称').fill('当前页未保存');
  await second.getByRole('button', { name: '立即保存', exact: true }).click(); await expect(status(second)).toHaveAttribute('data-state', 'conflict');
  expect((await exportProject(second)).title).toBe('当前页未保存');
  const raw = await exportRaw(second); expect(JSON.parse(raw.records.draft.slice('string:'.length)).title).toBe('另一页面已保存');
  await second.getByLabel('作品名称').fill('冲突后还在编辑');
  await expect(status(second)).toHaveAttribute('data-state', 'conflict');
  await second.getByRole('button', { name: '明确用当前稿接管', exact: true }).click();
  await expect(status(second)).toHaveAttribute('data-state', 'saved'); await expect(second.locator('#project-revision')).toHaveText('3');
  await page.reload(); await expect(page.getByLabel('作品名称')).toHaveValue('冲突后还在编辑');
});

test('storage denial keeps an honest in-memory draft with a working project file download', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('Denied by test', 'SecurityError'); } }));
  await page.goto('/project.html'); await expect(status(page)).toHaveAttribute('data-state', 'error');
  await page.getByLabel('作品名称').fill('页面内的灯');
  const exported = await exportProject(page); expect(exported.title).toBe('页面内的灯'); expect(exported.saveRevision).toBe(0);
  await expect(status(page)).not.toHaveAttribute('data-state', 'saved');
});

test('formal store and file export operate through legacy production chunks in Chromium smoke check', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.route('**/project.html', async route => {
    const response = await route.fetch();
    const html = (await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g, '').replace(/\snomodule\b/g, '');
    await route.fulfill({ response, body: html });
  });
  await page.goto('/project.html'); await expect(page.locator('#project-runtime')).toHaveAttribute('data-entry', 'legacy');
  await expect(status(page)).toHaveAttribute('data-state', 'saved');
  await page.getByLabel('作品名称').fill('旧入口也能接续');
  await page.getByRole('button', { name: '立即保存', exact: true }).click(); await expect(page.locator('#project-revision')).toHaveText('2');
  await page.reload(); await expect(page.getByLabel('作品名称')).toHaveValue('旧入口也能接续');
  expect((await exportProject(page)).title).toBe('旧入口也能接续'); expect(errors).toEqual([]);
});
