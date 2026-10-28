# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> craft saves the current editor while leaving frozen cast and decision intact
- Location: tests\e2e\navigation.spec.ts:67:1

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.selectOption: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByLabel('衣上的纹样')

```

# Page snapshot

```yaml
- generic [active] [ref=f1e1]:
  - link "跳到主要内容" [ref=f1e2] [cursor=pointer]:
    - /url: "#main"
  - banner [ref=f1e3]:
    - link "皮影艺术数字文化馆首页" [ref=f1e4] [cursor=pointer]:
      - /url: "#/"
      - generic [aria-hidden] [ref=f1e5]: 影
      - generic [ref=f1e6]:
        - text: 皮影艺术
        - generic [ref=f1e7]: 数字文化馆
    - navigation "主要导航" [ref=f1e8]:
      - link "剧场" [ref=f1e9] [cursor=pointer]:
        - /url: "#/"
      - link "制偶" [ref=f1e10] [cursor=pointer]:
        - /url: "#/craft"
      - link "展馆" [ref=f1e11] [cursor=pointer]:
        - /url: "#/museum"
      - link "节目单" [ref=f1e12] [cursor=pointer]:
        - /url: "#/result"
      - link "关于" [ref=f1e13] [cursor=pointer]:
        - /url: "#/about"
    - button "我的作品" [ref=f1e14] [cursor=pointer]:
      - text: 我的作品
      - status [ref=f1e15]: 已保存
    - button "关闭戏曲音乐" [pressed] [ref=f1e16] [cursor=pointer]
  - complementary "音乐提示" [ref=f1e17]:
    - status [ref=f1e18]: 点击或按键，让音乐响起。
  - main [ref=f1e19]:
    - generic [ref=f1e20]:
      - generic [ref=f1e21]:
        - generic [ref=f1e22]:
          - paragraph [ref=f1e23]: 先备行装
          - heading "给远行的人，备一身衣色。" [level=1] [ref=f1e24]
          - paragraph [ref=f1e25]: 保留影偶原画的细密刻纹，选择一套颜色；再牵一牵手脚，看看这身行装怎样走上舞台。
          - img [aria-hidden]:
            - generic: 给远行的人，备一身衣色。
        - navigation "这一场的去处" [ref=f1e26]:
          - link "制偶" [ref=f1e27] [cursor=pointer]:
            - /url: "#/craft"
          - link "灯影" [ref=f1e28] [cursor=pointer]:
            - /url: "#/light"
          - link "剧场" [ref=f1e29] [cursor=pointer]:
            - /url: "#/story"
          - link "练习" [ref=f1e30] [cursor=pointer]:
            - /url: "#/practice"
        - generic [ref=f1e31]:
          - figure [ref=f1e32]:
            - generic "操偶幕面：直接拖动手脚，方向键移动身躯" [ref=f1e33]:
              - img "皮影舞台" [ref=f1e34]
              - button "试提身杆，方向键移动" [ref=f1e35] [cursor=pointer]: 身
              - generic:
                - button "拖动沉香左手" [ref=f1e36]: 左手
                - button "拖动沉香右手" [ref=f1e37]: 右手
                - button "拖动沉香左脚" [ref=f1e38]: 左脚
                - button "拖动沉香右脚" [ref=f1e39]: 右脚
            - paragraph [ref=f1e41]: 为沉香选好行装，再试着牵动他的手脚。
            - generic [ref=f1e42]:
              - button "展开戏台空间" [ref=f1e43] [cursor=pointer]
              - status [ref=f1e44]: 从幕前走到背面，看灯、薄片与操偶杆。
            - generic [ref=f1e45]:
              - paragraph [ref=f1e46]: 试提身杆：拖动幕下握柄，或聚焦后用方向键。这里的试提可重置，不改练习台存下的姿态。
              - group "试提身杆逐步操作" [ref=f1e47]:
                - button "身杆向左" [ref=f1e48] [cursor=pointer]
                - button "身杆向上" [ref=f1e49] [cursor=pointer]
                - button "身杆向下" [ref=f1e50] [cursor=pointer]
                - button "身杆向右" [ref=f1e51] [cursor=pointer]
              - button "重置试提" [ref=f1e52] [cursor=pointer]
            - status [ref=f1e53]: 身杆已就位。
            - paragraph [ref=f1e54]: 拖动手、脚上的圆点摆动四肢；点击幕面后用 ↑ ↓ ← → 移动身躯。
          - generic [ref=f1e55]:
            - group "沉香的行装" [ref=f1e56]:
              - generic [ref=f1e58]:
                - text: 这一套颜色
                - combobox "这一套颜色" [ref=f1e59]:
                  - option "朱砂"
                  - option "青岚" [selected]
                  - option "山林"
              - button "采用这套配色" [ref=f1e66] [cursor=pointer]
              - button "分别给衣身、袖、下摆着色" [ref=f1e67] [cursor=pointer]
            - paragraph [ref=f1e68]: 青岚。这是编辑稿；本场已冻结的造型保持不变。
            - button "保存这身行装" [ref=f1e69] [cursor=pointer]
            - generic [ref=f1e70]:
              - paragraph [ref=f1e71]: 本场已冻结。继续会使用原造型；归档重开会保留现在的编辑稿并建立新项目，随后由你确认新场。
              - link "继续本场已冻结的演出 →" [ref=f1e72] [cursor=pointer]:
                - /url: "#/story"
              - button "归档旧场，用新造型重新开演" [ref=f1e73] [cursor=pointer]
              - generic [ref=f1e74]:
                - checkbox "允许替换已有的上一项目（可先导出）" [ref=f1e75]
                - text: 允许替换已有的上一项目（可先导出）
      - navigation "推荐体验顺序" [ref=f1e76]:
        - paragraph [ref=f1e77]: 这一场已留下检查点，随时可回“正式演出”接续。也可自由体验其他页面。
        - list [ref=f1e78]:
          - listitem [ref=f1e79]:
            - link "1 故事缘起" [ref=f1e80] [cursor=pointer]:
              - /url: "#/"
          - listitem [ref=f1e81]:
            - link "2 制偶" [ref=f1e82] [cursor=pointer]:
              - /url: "#/craft"
          - listitem [ref=f1e83]:
            - link "3 调灯" [ref=f1e84] [cursor=pointer]:
              - /url: "#/light"
          - listitem [ref=f1e85]:
            - link "4 练习" [ref=f1e86] [cursor=pointer]:
              - /url: "#/practice"
          - listitem [ref=f1e87]:
            - link "5 正式演出" [ref=f1e88] [cursor=pointer]:
              - /url: "#/story"
          - listitem [ref=f1e89]:
            - link "6 留影成果" [ref=f1e90] [cursor=pointer]:
              - /url: "#/result"
          - listitem [ref=f1e91]:
            - link "7 展馆" [ref=f1e92] [cursor=pointer]:
              - /url: "#/museum"
      - button "再练一次" [ref=f1e93] [cursor=pointer]
  - contentinfo [ref=f1e94]:
    - generic [ref=f1e95]: 影作 · 据传统故事原创交互改编
    - link "让幕后的创作，也被看见 ↗" [ref=f1e96] [cursor=pointer]:
      - /url: "#/about"
    - link "素材致谢" [ref=f1e97] [cursor=pointer]:
      - /url: ./credits.html
    - button "切换全站装饰动效" [pressed] [ref=f1e98] [cursor=pointer]: 动效 · 灯火流转
```

# Test source

```ts
  1   | import {test,expect} from './formal-fixture';
  2   | import type { Download, Page } from '@playwright/test';
  3   | import type { ProjectV1 } from '../../src/domain/types';
  4   | import fixture from '../fixtures/project-v1.json' with { type: 'json' };
  5   | import future from '../fixtures/unknown-version.json' with { type: 'json' };
  6   | import corrupt from '../fixtures/corrupt-project.json' with { type: 'json' };
  7   |
  8   | const saved = async (page: Page) => expect(page.locator('#save-state')).toHaveAttribute('data-state', 'saved');
  9   | async function record(page: Page): Promise<string> {
  10  |   return page.evaluate(async () => {
  11  |     const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('yingzuo-v1', 1); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  12  |     try { return await new Promise<string>((resolve, reject) => { const r = db.transaction('snapshots').objectStore('snapshots').get('draft'); r.onsuccess = () => resolve(r.result as string); r.onerror = () => reject(r.error); }); }
  13  |     finally { db.close(); }
  14  |   });
  15  | }
  16  | const stored = async (page: Page) => JSON.parse(await record(page)) as ProjectV1;
  17  | async function seed(page: Page, draft: unknown, backup?: unknown) {
  18  |   await page.goto('/study.html');
  19  |   await page.evaluate(async entries => {
  20  |     const db = await new Promise<IDBDatabase>((resolve, reject) => { const r = indexedDB.open('yingzuo-v1', 1); r.onupgradeneeded = () => r.result.createObjectStore('snapshots'); r.onsuccess = () => resolve(r.result); r.onerror = () => reject(r.error); });
  21  |     try { await new Promise<void>((resolve, reject) => { const tx = db.transaction('snapshots', 'readwrite'); for (const [key, value] of entries) tx.objectStore('snapshots').put(value, key); tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error); }); }
  22  |     finally { db.close(); }
  23  |   }, [['draft', JSON.stringify(draft)], ...(backup ? [['backup', JSON.stringify(backup)]] : [])]);
  24  | }
  25  | async function hash(page: Page, path: string) {
  26  |   await page.evaluate(value => { window.location.hash = value; }, `#${path}`);
  27  |   await expect(page.locator('#app-view')).toHaveAttribute('data-route', path.startsWith('/museum/') ? '/museum' : path);
  28  | }
  29  | async function downloadJSON(download: Download) {
  30  |   expect(await download.failure()).toBeNull(); const stream = await download.createReadStream(), chunks: Buffer[] = [];
  31  |   for await (const chunk of stream) chunks.push(Buffer.from(chunk)); return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  32  | }
  33  |
  34  | test('direct routes, museum children, back and refresh preserve the confirmed performance', async ({ page }) => {
  35  |   test.setTimeout(60000); const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  36  |   await seed(page, fixture); await page.goto('/#/story'); await saved(page);
  37  |   for (const path of ['/', '/craft', '/light', '/story', '/practice', '/result', '/about', '/museum', ...Array.from({ length: 8 }, (_, i) => `/museum/E0${i + 1}`)]) {
  38  |     await hash(page, path); await expect(page.locator('#app-view h1')).toBeVisible();
  39  |     expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  40  |   }
  41  |   await saved(page); const before = await stored(page);
  42  |   expect(before.story).toEqual(fixture.story); expect(before.projectId).toBe(fixture.projectId);
  43  |   expect([...before.museum.visitedExhibitIds].sort()).toEqual(['E01','E02','E03','E04','E05','E06','E07']); expect(before.lastRoute).toBe('/museum');
  44  |   await page.goBack(); await expect(page).toHaveURL(/#\/museum\/E07$/);
  45  |   await page.reload(); await saved(page); expect((await stored(page)).story).toEqual(fixture.story);
  46  |   expect(errors).toEqual([]);
  47  | });
  48  |
  49  | test('URLs cannot start a story or manufacture a completed result', async ({ page }) => {
  50  |   await page.goto('/#/story'); await saved(page); expect((await stored(page)).story).toBeNull();
  51  |   await hash(page, '/result'); await expect(page.locator('#app-view')).toContainText('尚未开演');
  52  |   await page.evaluate(() => { window.location.hash = '#/story/curtain'; }); await expect(page).toHaveURL(/#\/$/);
  53  |   await expect(page.locator('#app-notice')).toContainText('已回到剧场首页'); await saved(page);
  54  |   expect((await stored(page)).story).toBeNull();
  55  | });
  56  |
  57  | test('explicit guided opening and intro skip persist once, and ten remounts cannot repeat the command', async ({ page }) => {
  58  |   await page.goto('/'); await saved(page); const id = (await stored(page)).projectId;
  59  |   await page.getByRole('button', { name: '节选导览', exact: true }).click(); await expect(page).toHaveURL(/#\/story$/); await saved(page);
  60  |   const intro = (await stored(page)).story!; expect(intro).toMatchObject({ nodeId: 'intro', mode: 'guided', revision: 0 });
  61  |   for (let i = 0; i < 10; i++) { await hash(page, '/museum/E04'); await hash(page, '/story'); }
  62  |   await page.getByRole('button', { name: '先为他备好行装', exact: true }).click(); await expect(page).toHaveURL(/#\/story$/); await saved(page);
  63  |   const after = await stored(page); expect(after.projectId).toBe(id); expect(after.story).toMatchObject({ runId: intro.runId, nodeId: 'craft', revision: 1 });
  64  |   await page.reload(); await saved(page); expect((await stored(page)).story).toEqual(after.story);
  65  | });
  66  |
  67  | test('craft saves the current editor while leaving frozen cast and decision intact', async ({ page }) => {
  68  |   await seed(page, fixture); await page.goto('/#/craft'); await saved(page);
> 69  |   await page.getByLabel('衣上的纹样').selectOption('flower-v1'); await page.getByLabel('这一套颜色').selectOption('woodland-v1');
      |                                  ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
  70  |   await page.getByRole('button', { name: '保存这身行装', exact: true }).click(); await saved(page);
  71  |   const project = await stored(page); expect(project.appearance).toMatchObject({ patternId: 'flower-v1', paletteId: 'woodland-v1' }); expect(project.story).toEqual(fixture.story);
  72  |   await hash(page, '/museum/E03'); await hash(page, '/craft'); await page.reload(); await saved(page);
  73  |   await expect(page.getByLabel('衣上的纹样')).toHaveValue('flower-v1'); await expect(page.getByLabel('这一套颜色')).toHaveValue('woodland-v1');
  74  | });
  75  |
  76  | test('a failed opening stays on the old page, exports its candidate and retries the identical run', async ({ page }) => {
  77  |   await page.goto('/'); await saved(page);
  78  |   await page.evaluate(() => { const put = IDBObjectStore.prototype.put; let fail = true; IDBObjectStore.prototype.put = function (value: unknown, key?: IDBValidKey) { if (fail && key === 'draft') { fail = false; throw new DOMException('Injected quota failure', 'QuotaExceededError'); } return put.call(this, value, key); }; });
  79  |   await page.getByRole('button', { name: '节选导览', exact: true }).click(); await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'error');
  80  |   expect((await stored(page)).story).toBeNull(); await page.evaluate(() => { window.location.hash = '#/museum'; });
  81  |   await expect(page).toHaveURL(/#\/$/); await expect(page.locator('#app-view')).toHaveAttribute('data-route', '/'); await expect(page.locator('#app-notice')).toContainText('先处理待保存动作');
  82  |   const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: '导出当前作品', exact: true }).click(); const candidate = await downloadJSON(await downloading);
  83  |   expect(candidate.story.nodeId).toBe('intro'); await page.getByRole('button', { name: '重试保存', exact: true }).click(); await saved(page);
  84  |   expect((await stored(page)).story).toEqual(candidate.story); await hash(page, '/story'); await expect(page.locator('#app-view')).toContainText('先为他备好行装');
  85  | });
  86  |
  87  | test('denied storage keeps an editable export and an explicit memory-only opening', async ({ page }) => {
  88  |   await page.addInitScript(() => Object.defineProperty(window, 'indexedDB', { get() { throw new DOMException('Denied for test', 'SecurityError'); } }));
  89  |   await page.goto('/#/craft'); await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'error');
  90  |   await page.getByLabel('衣上的纹样').selectOption('wave-v1'); await hash(page, '/story');
  91  |   await page.getByRole('button', { name: '确认开始这一场', exact: true }).click(); await expect(page.locator('#cancel-pending')).toBeVisible();
  92  |   await page.getByRole('button', { name: '仅在本页继续（未保存）', exact: true }).click(); await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'memory');
  93  |   const downloading = page.waitForEvent('download'); await page.getByRole('button', { name: '导出当前作品', exact: true }).click(); const project = await downloadJSON(await downloading);
  94  |   expect(project.story.nodeId).toBe('intro'); expect(project.appearance.patternId).toBe('wave-v1'); expect(project.saveRevision).toBe(0);
  95  | });
  96  |
  97  | test('archive/import use the shared serial entry, and cancel preserves the existing project', async ({ page }) => {
  98  |   await page.goto('/'); await saved(page); const original = (await stored(page)).projectId;
  99  |   await page.getByRole('button', { name: /我的作品/ }).click();
  100 |   await page.getByRole('button', { name: '归档并新建作品', exact: true }).click(); await saved(page);
  101 |   await expect.poll(async () => (await stored(page)).projectId).not.toBe(original); const current = (await stored(page)).projectId;
  102 |   await page.getByLabel('导入作品 JSON').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  103 |   await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'error');
  104 |   await page.getByRole('button', { name: '取消待保存动作', exact: true }).click(); await saved(page); expect((await stored(page)).projectId).toBe(current);
  105 |   await page.getByLabel('允许替换已有的上一项目', { exact: false }).check();
  106 |   await page.getByLabel('导入作品 JSON').setInputFiles({ name: 'project.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) });
  107 |   await expect.poll(async () => (await stored(page)).story).toEqual(fixture.story);
  108 |   expect((await stored(page)).projectId).not.toBe(current); expect((await stored(page)).projectId).not.toBe(fixture.projectId);
  109 | });
  110 |
  111 | test('workbench recovery can be explicitly reread without leaving the product stuck', async ({ page, context }) => {
  112 |   await seed(page, corrupt, fixture); await page.goto('/#/story'); await expect(page.locator('#save-state')).toHaveAttribute('data-state', 'recovery');
  113 |   const lab = await context.newPage(); await lab.goto('/project.html');
  114 |   await lab.getByRole('button', { name: '恢复已读取的有效备份', exact: true }).click(); await expect(lab.locator('#project-status')).toHaveAttribute('data-state', 'saved'); await lab.close();
  115 |   await page.getByRole('button', { name: '处理完成，重新读取本机作品', exact: true }).click(); await saved(page);
  116 |   expect((await stored(page)).story).toEqual(fixture.story); await expect(page.locator('#app-view')).toContainText('暂停接续');
  117 | });
  118 |
  119 | test('a real curtain checkpoint produces the actual programme and prepared reunion image', async ({ page }) => {
  120 |   const project = { ...fixture, story: { ...fixture.story, nodeId: 'curtain', revision: 15, completedAt: '2026-10-17T00:00:00.000Z' } };
  121 |   await seed(page, project); await page.goto('/#/result'); await saved(page);
  122 |   await expect(page.locator('#app-view h1')).toHaveText('这一回，终于相见。'); await expect(page.locator('.programme-list')).toContainText('先举灯呼唤');
  123 |   await expect(page.locator('.programme-list')).toContainText('团圆已保存，谢幕尚未结束'); expect((await stored(page)).story).toEqual(project.story);
  124 |   await expect(page.locator('#result-png')).toBeEnabled();
  125 | });
  126 |
  127 | for (const [label, draft, backup, status] of [
  128 |   ['future', future, fixture, 'unsupported'], ['corrupt', corrupt, fixture, 'recovery'],
  129 | ] as const) test(`${label} records remain protected while the museum is readable`, async ({ page }) => {
  130 |   await seed(page, draft, backup); await page.goto('/#/museum/E01'); await expect(page.locator('#save-state')).toHaveAttribute('data-state', status);
  131 |   await expect(page.locator('#app-view h1')).toBeVisible(); await expect(page.getByRole('button', { name: '归档并新建作品', exact: true })).toBeDisabled();
  132 |   await hash(page, '/story'); await expect(page.getByRole('button', { name: '确认开始这一场', exact: true })).toBeDisabled();
  133 |   expect(await record(page)).toBe(JSON.stringify(draft));
  134 | });
  135 |
  136 | test('alias redirects once, keyboard skip does not change route and mobile menu has real focus targets', async ({ page }, info) => {
  137 |   await page.goto('/#/stage'); await expect(page).toHaveURL(/#\/practice$/); await saved(page);
  138 |   await page.locator('.skip-link').focus(); await page.keyboard.press('Enter'); await expect(page.locator('#main')).toBeFocused(); await expect(page).toHaveURL(/#\/practice$/);
  139 |   if (info.project.name.startsWith('mobile')) { await page.getByRole('button', { name: '菜单', exact: true }).click(); await expect(page.locator('#menu-toggle')).toHaveAttribute('aria-expanded', 'true'); }
  140 |   await page.locator('#primary-nav').getByRole('link', { name: '展馆', exact: true }).click(); await expect(page).toHaveURL(/#\/museum$/); await expect(page.locator('#app-view h1')).toBeFocused();
  141 |   await page.goBack(); await expect(page).toHaveURL(/#\/practice$/); expect((await stored(page)).story).toBeNull();
  142 | });
  143 |
  144 | test('legacy product entry uses the same project and can save an editor change in Chromium', async ({ page }) => {
  145 |   const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  146 |   await page.route('http://127.0.0.1:4173/', async route => { const response = await route.fetch(); const html = (await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g, '').replace(/\snomodule\b/g, ''); await route.fulfill({ response, body: html }); });
  147 |   await page.goto('/#/craft'); await expect(page.locator('#app-runtime')).toHaveAttribute('data-entry', 'legacy'); await saved(page);
  148 |   await page.getByLabel('衣上的纹样').selectOption('wave-v1'); await page.getByRole('button', { name: '保存这身行装', exact: true }).click(); await saved(page);
  149 |   expect((await stored(page)).appearance.patternId).toBe('wave-v1'); expect(errors).toEqual([]);
  150 | });
  151 |
  152 | test('static product introduction remains readable without JavaScript', async ({ browser }) => {
  153 |   const context = await browser.newContext({ javaScriptEnabled: false }); const page = await context.newPage();
  154 |   await page.goto('http://127.0.0.1:4173/'); await expect(page.locator('#fallback-title')).toBeVisible();
  155 |   await page.getByRole('link', { name: '认识这出戏', exact: true }).click(); await expect(page.locator('#static-story')).toBeInViewport();
  156 |   await expect(page.locator('#static-museum')).toContainText('五个展区'); await expect(page.locator('#open-project-tools')).toBeHidden(); await context.close();
  157 | });
  158 |
```