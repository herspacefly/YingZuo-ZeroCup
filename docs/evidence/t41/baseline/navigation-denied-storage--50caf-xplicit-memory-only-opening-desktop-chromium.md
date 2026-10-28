# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> denied storage keeps an editable export and an explicit memory-only opening
- Location: tests\e2e\navigation.spec.ts:87:1

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
- generic [active] [ref=e1]:
  - link "跳到主要内容" [ref=e2] [cursor=pointer]:
    - /url: "#main"
  - banner [ref=e3]:
    - link "皮影艺术数字文化馆首页" [ref=e4] [cursor=pointer]:
      - /url: "#/"
      - generic [aria-hidden] [ref=e5]: 影
      - generic [ref=e6]:
        - text: 皮影艺术
        - generic [ref=e7]: 数字文化馆
    - navigation "主要导航" [ref=e8]:
      - link "剧场" [ref=e9] [cursor=pointer]:
        - /url: "#/"
      - link "制偶" [ref=e10] [cursor=pointer]:
        - /url: "#/craft"
      - link "展馆" [ref=e11] [cursor=pointer]:
        - /url: "#/museum"
      - link "节目单" [ref=e12] [cursor=pointer]:
        - /url: "#/result"
      - link "关于" [ref=e13] [cursor=pointer]:
        - /url: "#/about"
    - button "我的作品" [expanded] [ref=e14] [cursor=pointer]:
      - text: 我的作品
      - status [ref=e15]: 保存失败
    - button "关闭戏曲音乐" [pressed] [ref=e16] [cursor=pointer]
  - complementary "音乐提示" [ref=e17]:
    - status [ref=e18]: 点击或按键，让音乐响起。
  - group [ref=e20]:
    - generic "我的作品与保存" [ref=e21] [cursor=pointer]
    - paragraph [ref=e22]: 本地存储不可用，作品仅保留在页面内。 自动覆盖已暂停；可导出当前稿或明确重试。
    - alert
    - generic [ref=e23]:
      - button "导出当前作品" [ref=e24] [cursor=pointer]
      - button "重试保存" [ref=e25] [cursor=pointer]
    - generic [ref=e26]:
      - text: 导入作品 JSON
      - button "导入作品 JSON" [ref=e27]
    - generic [ref=e28]:
      - checkbox "允许替换已有的上一项目（可先导出保留）" [ref=e29]
      - text: 允许替换已有的上一项目（可先导出保留）
    - generic [ref=e30]:
      - button "归档并新建作品" [ref=e31] [cursor=pointer]
      - button "导出存储原始记录" [ref=e32] [cursor=pointer]
      - link "存档恢复与冲突检查（新窗口） ↗" [ref=e33] [cursor=pointer]:
        - /url: ./project.html
    - paragraph [ref=e34]: 在新窗口处理存档后，先导出本页需要保留的未保存稿，再重新读取。重新读取会放弃本页尚未保存的内容。
    - button "处理完成，重新读取本机作品" [ref=e35] [cursor=pointer]
    - separator [ref=e36]
    - button "清除本机历史并重新开始" [ref=e37] [cursor=pointer]
  - main [ref=e38]:
    - generic [ref=e39]:
      - navigation "推荐体验顺序" [ref=e40]:
        - paragraph [ref=e41]: 初次来访，沿这七步走一遍。每页有明确的下一步，也可以随时自由逛展。
        - list [ref=e42]:
          - listitem [ref=e43]:
            - link "1 故事缘起" [ref=e44] [cursor=pointer]:
              - /url: "#/"
          - listitem [ref=e45]:
            - link "2 制偶" [ref=e46] [cursor=pointer]:
              - /url: "#/craft"
          - listitem [ref=e47]:
            - link "3 调灯" [ref=e48] [cursor=pointer]:
              - /url: "#/light"
          - listitem [ref=e49]:
            - link "4 练习" [ref=e50] [cursor=pointer]:
              - /url: "#/practice"
          - listitem [ref=e51]:
            - link "5 正式演出" [ref=e52] [cursor=pointer]:
              - /url: "#/story"
          - listitem [ref=e53]:
            - link "6 留影成果" [ref=e54] [cursor=pointer]:
              - /url: "#/result"
          - listitem [ref=e55]:
            - link "7 展馆" [ref=e56] [cursor=pointer]:
              - /url: "#/museum"
      - generic [ref=e57]:
        - generic [ref=e58]:
          - paragraph [ref=e59]: 先备行装
          - heading "给远行的人，备一身衣色。" [level=1] [ref=e60]
          - paragraph [ref=e61]: 保留影偶原画的细密刻纹，选择一套颜色；再牵一牵手脚，看看这身行装怎样走上舞台。
          - img [aria-hidden]:
            - generic: 给远行的人，备一身衣色。
        - navigation "这一场的去处" [ref=e62]:
          - link "制偶" [ref=e63] [cursor=pointer]:
            - /url: "#/craft"
          - link "灯影" [ref=e64] [cursor=pointer]:
            - /url: "#/light"
          - link "剧场" [ref=e65] [cursor=pointer]:
            - /url: "#/story"
          - link "练习" [ref=e66] [cursor=pointer]:
            - /url: "#/practice"
        - generic [ref=e67]:
          - figure [ref=e68]:
            - generic "操偶幕面：直接拖动手脚，方向键移动身躯" [ref=e69]:
              - img "皮影舞台" [ref=e70]
              - button "试提身杆，方向键移动" [ref=e71] [cursor=pointer]: 身
              - generic:
                - button "拖动沉香左手" [ref=e72]: 左手
                - button "拖动沉香右手" [ref=e73]: 右手
                - button "拖动沉香左脚" [ref=e74]: 左脚
                - button "拖动沉香右脚" [ref=e75]: 右脚
            - paragraph [ref=e77]: 为沉香选好行装，再试着牵动他的手脚。
            - generic [ref=e78]:
              - button "展开戏台空间" [ref=e79] [cursor=pointer]
              - status [ref=e80]: 从幕前走到背面，看灯、薄片与操偶杆。
            - generic [ref=e81]:
              - paragraph [ref=e82]: 试提身杆：拖动幕下握柄，或聚焦后用方向键。这里的试提可重置，不改练习台存下的姿态。
              - group "试提身杆逐步操作" [ref=e83]:
                - button "身杆向左" [ref=e84] [cursor=pointer]
                - button "身杆向上" [ref=e85] [cursor=pointer]
                - button "身杆向下" [ref=e86] [cursor=pointer]
                - button "身杆向右" [ref=e87] [cursor=pointer]
              - button "重置试提" [ref=e88] [cursor=pointer]
            - status [ref=e89]: 身杆已就位。
            - paragraph [ref=e90]: 拖动手、脚上的圆点摆动四肢；点击幕面后用 ↑ ↓ ← → 移动身躯。
          - generic [ref=e91]:
            - group "沉香的行装" [ref=e92]:
              - generic [ref=e94]:
                - text: 这一套颜色
                - combobox "这一套颜色" [ref=e95]:
                  - option "朱砂" [selected]
                  - option "青岚"
                  - option "山林"
              - button "采用这套配色" [ref=e102] [cursor=pointer]
              - button "分别给衣身、袖、下摆着色" [ref=e103] [cursor=pointer]
            - paragraph [ref=e104]: 朱砂。保留原画的精细纹理；确认开演前还可以修改配色。
            - button "保存这身行装" [ref=e105] [cursor=pointer]
            - generic [ref=e106]:
              - paragraph [ref=e107]: 第2步 / 制偶：挑好喜欢的颜色，就可以继续调灯。现在只保存编辑稿，正式开演时再确认本场造型。
              - button "保存行装，下一步调灯 →" [ref=e108] [cursor=pointer]
            - generic [ref=e109]:
              - paragraph [ref=e110]: 推荐先调灯、练习，再正式开演。也可以在此直接确认造型并进入第一幕；采用默认影偶会标为预设造型。
              - generic [ref=e111]:
                - text: 新场的节奏
                - combobox "新场的节奏" [ref=e112]:
                  - option "完整演出" [selected]
                  - option "节选导览"
              - button "用这身行装开演" [ref=e113] [cursor=pointer]
              - button "采用默认影偶开演" [ref=e114] [cursor=pointer]
  - contentinfo [ref=e115]:
    - generic [ref=e116]: 影作 · 据传统故事原创交互改编
    - link "让幕后的创作，也被看见 ↗" [ref=e117] [cursor=pointer]:
      - /url: "#/about"
    - link "素材致谢" [ref=e118] [cursor=pointer]:
      - /url: ./credits.html
    - button "切换全站装饰动效" [pressed] [ref=e119] [cursor=pointer]: 动效 · 灯火流转
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
  69  |   await page.getByLabel('衣上的纹样').selectOption('flower-v1'); await page.getByLabel('这一套颜色').selectOption('woodland-v1');
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
> 90  |   await page.getByLabel('衣上的纹样').selectOption('wave-v1'); await hash(page, '/story');
      |                                  ^ Error: locator.selectOption: Test timeout of 30000ms exceeded.
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