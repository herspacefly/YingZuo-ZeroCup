# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: navigation.spec.ts >> workbench recovery can be explicitly reread without leaving the product stuck
- Location: tests\e2e\navigation.spec.ts:111:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('#app-view')
Expected substring: "暂停接续"
Received string:    "已回到原来的状态，可以直接开始。幕前这一场，从此刻接续。每次回来，幕面准备好便从当前这一小段的起点自动开演。你可随时暂停，造型和已确认的选择会被保留。这一场，从此刻接续。制偶灯影剧场练习幕上此刻沉香：娘，你看见了吗？左手右手左脚右脚身左右先听这一段，再接过操偶。重试幕面使用轻量二维继续当前画面恢复原画质展开戏台空间从幕前走到背面，看灯、薄片与操偶杆。工坊近景幕前幕后展台剧情空间人物近看拖动空间画面改变视角；放大查看刻纹与持物。操偶仍在上方二维幕面完成。沉香母亲二郎神放大缩小复位观察E01 · 颜色为什么能透出来E02 · 刻掉的地方留下什么E03 · 一只影偶怎样动起来E04 · 一盏灯，两种尺度E05 · 台上两个人，幕后多少双手E06 · 这出《劈山救母》从哪里来E07 · 同是皮影，各地不同切换机位可以看清幕后的关系；操偶仍在上方幕面完成。只看二维幕面拖动手、脚上的圆点摆动四肢；点击幕面后用 ↑ ↓ ← → 移动身躯。拖动沉香的手脚或握柄；舞台上的方向键移动身躯，方向按钮移动所选杆，滑块可精调关节。牵动沉香当前操纵杆身杆左手杆右手杆向左向上向下向右身杆左右32%身杆高低68%左肩角度0°左肘角度0°左髋角度0°左膝角度0°右肩角度0°右肘角度0°右髋角度0°右膝角度0°影偶大小80%灯位左右0%影偶离幕距离20%正在播放当前片段，后续片段会自动接续。先举灯呼唤山缝仍闭合。移动灯，让共同纹样的投影经过山缝，并保持片刻。本场沿用先前剧本，未接入中文配音。可先导出作品，再到制偶页归档重开。 去制偶页 →先举灯呼唤点击台词，定位当前片段。不会跳过操偶任务或改变剧情选择。沉香：娘，你看见了吗？展开本段完整台词沉香：娘，你看见了吗？确认开始这一场先为他备好行装去备行装 →确认这身行装，进入第一幕先举灯呼唤先挥斧开山接母亲回家为后来人留路请二郎神共同承山由我独自承山，承担永久化为山影的代价暂缓最后一斧，留灯相守请二郎神一起稳山，再解开封印解开最后封印，牵手回家解印后，母亲自愿守灯、沉香远行解开最后封印，母子并肩远行暂缓最后一斧：封印未解，留灯相守（开放终章）沉香永久化作山影，失去归家与人间未来，换母亲自由（悲剧终章）演出节奏（暂停时可切换）完整演出节选导览继续操偶暂停重开片段（暂停）跳过本段，进入《山后先有回应》跳过定场放映再看一次关闭舞台音效关闭中文配音确认进入下一段帮我演过这一段举起手中的灯，移动身躯与灯位，让白框内的灯火照进金色山缝。 金色是目标区域，白线是当前观察范围。暂停不累计动作时间；刷新后会从本段开头自动开演。重试当前片段带走本场节目单 →先去展馆走走 →这一场已留下检查点，随时可回“正式演出”接续。也可自由体验其他页面。1 故事缘起2 制偶3 调灯4 练习5 正式演出6 留影成果7 展馆再练一次"
Timeout: 5000ms

Call log:
  - Expect "toContainText" locator('#app-view') with timeout 5000ms
  - waiting for locator('#app-view')
    3 × locator resolved to <div id="app-view" data-route="/story">…</div>
      - unexpected value "这一场已留下检查点，随时可回“正式演出”接续。也可自由体验其他页面。1 故事缘起2 制偶3 调灯4 练习5 正式演出6 留影成果7 展馆幕前这一场，从此刻接续。每次回来，幕面准备好便从当前这一小段的起点自动开演。你可随时暂停，造型和已确认的选择会被保留。这一场，从此刻接续。制偶灯影剧场练习幕上此刻沉香：娘，你看见了吗？左手右手左脚右脚身左右先听这一段，再接过操偶。正在准备影偶与幕面…重试幕面使用轻量二维继续当前画面恢复原画质展开戏台空间从幕前走到背面，看灯、薄片与操偶杆。工坊近景幕前幕后展台剧情空间人物近看拖动空间画面改变视角；放大查看刻纹与持物。操偶仍在上方二维幕面完成。沉香母亲二郎神放大缩小复位观察E01 · 颜色为什么能透出来E02 · 刻掉的地方留下什么E03 · 一只影偶怎样动起来E04 · 一盏灯，两种尺度E05 · 台上两个人，幕后多少双手E06 · 这出《劈山救母》从哪里来E07 · 同是皮影，各地不同切换机位可以看清幕后的关系；操偶仍在上方幕面完成。只看二维幕面拖动手、脚上的圆点摆动四肢；点击幕面后用 ↑ ↓ ← → 移动身躯。拖动沉香的手脚或握柄；舞台上的方向键移动身躯，方向按钮移动所选杆，滑块可精调关节。牵动沉香当前操纵杆身杆左手杆右手杆向左向上向下向右身杆左右32%身杆高低68%左肩角度0°左肘角度0°左髋角度0°左膝角度0°右肩角度0°右肘角度0°右髋角度0°右膝角度0°影偶大小80%灯位左右0%影偶离幕距离20%正在准备当前片段…先举灯呼唤山缝仍闭合。移动灯，让共同纹样的投影经过山缝，并保持片刻。本场沿用先前剧本，未接入中文配音。可先导出作品，再到制偶页归档重开。 去制偶页 →先举灯呼唤幕面准备、造型确认或保存期间，台词定位暂不可用。沉香：娘，你看见了吗？展开本段完整台词沉香：娘，你看见了吗？确认开始这一场先为他备好行装去备行装 →确认这身行装，进入第一幕先举灯呼唤先挥斧开山接母亲回家为后来人留路请二郎神共同承山由我独自承山，承担永久化为山影的代价暂缓最后一斧，留灯相守请二郎神一起稳山，再解开封印解开最后封印，牵手回家解印后，母亲自愿守灯、沉香远行解开最后封印，母子并肩远行暂缓最后一斧：封印未解，留灯相守（开放终章）沉香永久化作山影，失去归家与人间未来，换母亲自由（悲剧终章）演出节奏（暂停时可切换）完整演出节选导览继续操偶暂停重开片段（暂停）跳过本段，进入《山后先有回应》跳过定场放映再看一次关闭舞台音效关闭中文配音确认进入下一段帮我演过这一段举起手中的灯，移动身躯与灯位，让白框内的灯火照进金色山缝。 金色是目标区域，白线是当前观察范围。暂停不累计动作时间；刷新后会从本段开头自动开演。重试当前片段带走本场节目单 →先去展馆走走 →再练一次"
    5 × locator resolved to <div id="app-view" data-route="/story">…</div>
      - unexpected value "这一场已留下检查点，随时可回“正式演出”接续。也可自由体验其他页面。1 故事缘起2 制偶3 调灯4 练习5 正式演出6 留影成果7 展馆幕前这一场，从此刻接续。每次回来，幕面准备好便从当前这一小段的起点自动开演。你可随时暂停，造型和已确认的选择会被保留。这一场，从此刻接续。制偶灯影剧场练习幕上此刻沉香：娘，你看见了吗？左手右手左脚右脚身左右先听这一段，再接过操偶。重试幕面使用轻量二维继续当前画面恢复原画质展开戏台空间从幕前走到背面，看灯、薄片与操偶杆。工坊近景幕前幕后展台剧情空间人物近看拖动空间画面改变视角；放大查看刻纹与持物。操偶仍在上方二维幕面完成。沉香母亲二郎神放大缩小复位观察E01 · 颜色为什么能透出来E02 · 刻掉的地方留下什么E03 · 一只影偶怎样动起来E04 · 一盏灯，两种尺度E05 · 台上两个人，幕后多少双手E06 · 这出《劈山救母》从哪里来E07 · 同是皮影，各地不同切换机位可以看清幕后的关系；操偶仍在上方幕面完成。只看二维幕面拖动手、脚上的圆点摆动四肢；点击幕面后用 ↑ ↓ ← → 移动身躯。拖动沉香的手脚或握柄；舞台上的方向键移动身躯，方向按钮移动所选杆，滑块可精调关节。牵动沉香当前操纵杆身杆左手杆右手杆向左向上向下向右身杆左右32%身杆高低68%左肩角度0°左肘角度0°左髋角度0°左膝角度0°右肩角度0°右肘角度0°右髋角度0°右膝角度0°影偶大小80%灯位左右0%影偶离幕距离20%正在播放当前片段，后续片段会自动接续。先举灯呼唤山缝仍闭合。移动灯，让共同纹样的投影经过山缝，并保持片刻。本场沿用先前剧本，未接入中文配音。可先导出作品，再到制偶页归档重开。 去制偶页 →先举灯呼唤点击台词，定位当前片段。不会跳过操偶任务或改变剧情选择。沉香：娘，你看见了吗？展开本段完整台词沉香：娘，你看见了吗？确认开始这一场先为他备好行装去备行装 →确认这身行装，进入第一幕先举灯呼唤先挥斧开山接母亲回家为后来人留路请二郎神共同承山由我独自承山，承担永久化为山影的代价暂缓最后一斧，留灯相守请二郎神一起稳山，再解开封印解开最后封印，牵手回家解印后，母亲自愿守灯、沉香远行解开最后封印，母子并肩远行暂缓最后一斧：封印未解，留灯相守（开放终章）沉香永久化作山影，失去归家与人间未来，换母亲自由（悲剧终章）演出节奏（暂停时可切换）完整演出节选导览继续操偶暂停重开片段（暂停）跳过本段，进入《山后先有回应》跳过定场放映再看一次关闭舞台音效关闭中文配音确认进入下一段帮我演过这一段举起手中的灯，移动身躯与灯位，让白框内的灯火照进金色山缝。 金色是目标区域，白线是当前观察范围。暂停不累计动作时间；刷新后会从本段开头自动开演。重试当前片段带走本场节目单 →先去展馆走走 →再练一次"
    5 × locator resolved to <div id="app-view" data-route="/story">…</div>
      - unexpected value "已回到原来的状态，可以直接开始。幕前这一场，从此刻接续。每次回来，幕面准备好便从当前这一小段的起点自动开演。你可随时暂停，造型和已确认的选择会被保留。这一场，从此刻接续。制偶灯影剧场练习幕上此刻沉香：娘，你看见了吗？左手右手左脚右脚身左右先听这一段，再接过操偶。重试幕面使用轻量二维继续当前画面恢复原画质展开戏台空间从幕前走到背面，看灯、薄片与操偶杆。工坊近景幕前幕后展台剧情空间人物近看拖动空间画面改变视角；放大查看刻纹与持物。操偶仍在上方二维幕面完成。沉香母亲二郎神放大缩小复位观察E01 · 颜色为什么能透出来E02 · 刻掉的地方留下什么E03 · 一只影偶怎样动起来E04 · 一盏灯，两种尺度E05 · 台上两个人，幕后多少双手E06 · 这出《劈山救母》从哪里来E07 · 同是皮影，各地不同切换机位可以看清幕后的关系；操偶仍在上方幕面完成。只看二维幕面拖动手、脚上的圆点摆动四肢；点击幕面后用 ↑ ↓ ← → 移动身躯。拖动沉香的手脚或握柄；舞台上的方向键移动身躯，方向按钮移动所选杆，滑块可精调关节。牵动沉香当前操纵杆身杆左手杆右手杆向左向上向下向右身杆左右32%身杆高低68%左肩角度0°左肘角度0°左髋角度0°左膝角度0°右肩角度0°右肘角度0°右髋角度0°右膝角度0°影偶大小80%灯位左右0%影偶离幕距离20%正在播放当前片段，后续片段会自动接续。先举灯呼唤山缝仍闭合。移动灯，让共同纹样的投影经过山缝，并保持片刻。本场沿用先前剧本，未接入中文配音。可先导出作品，再到制偶页归档重开。 去制偶页 →先举灯呼唤点击台词，定位当前片段。不会跳过操偶任务或改变剧情选择。沉香：娘，你看见了吗？展开本段完整台词沉香：娘，你看见了吗？确认开始这一场先为他备好行装去备行装 →确认这身行装，进入第一幕先举灯呼唤先挥斧开山接母亲回家为后来人留路请二郎神共同承山由我独自承山，承担永久化为山影的代价暂缓最后一斧，留灯相守请二郎神一起稳山，再解开封印解开最后封印，牵手回家解印后，母亲自愿守灯、沉香远行解开最后封印，母子并肩远行暂缓最后一斧：封印未解，留灯相守（开放终章）沉香永久化作山影，失去归家与人间未来，换母亲自由（悲剧终章）演出节奏（暂停时可切换）完整演出节选导览继续操偶暂停重开片段（暂停）跳过本段，进入《山后先有回应》跳过定场放映再看一次关闭舞台音效关闭中文配音确认进入下一段帮我演过这一段举起手中的灯，移动身躯与灯位，让白框内的灯火照进金色山缝。 金色是目标区域，白线是当前观察范围。暂停不累计动作时间；刷新后会从本段开头自动开演。重试当前片段带走本场节目单 →先去展馆走走 →这一场已留下检查点，随时可回“正式演出”接续。也可自由体验其他页面。1 故事缘起2 制偶3 调灯4 练习5 正式演出6 留影成果7 展馆再练一次"

```

```yaml
- status: 已回到原来的状态，可以直接开始。
- paragraph: 幕前
- heading "这一场，从此刻接续。" [level=1]
- paragraph: 每次回来，幕面准备好便从当前这一小段的起点自动开演。你可随时暂停，造型和已确认的选择会被保留。
- navigation "这一场的去处":
  - link "制偶":
    - /url: "#/craft"
  - link "灯影":
    - /url: "#/light"
  - link "剧场":
    - /url: "#/story"
  - link "练习":
    - /url: "#/practice"
- complementary "当前台词":
  - text: 幕上此刻
  - paragraph: 沉香：娘，你看见了吗？
- figure "先听这一段，再接过操偶。":
  - img "皮影舞台"
  - button "拖动沉香左手": 左手
  - button "拖动沉香右手": 右手
  - button "拖动沉香左脚": 左脚
  - button "拖动沉香右脚": 右脚
  - button "拖动身杆，方向键移动": 身
  - button "拖动右手杆，方向键移动" [pressed]: 右
  - paragraph: 先听这一段，再接过操偶。
  - button "展开戏台空间"
  - status: 从幕前走到背面，看灯、薄片与操偶杆。
  - paragraph: 拖动手、脚上的圆点摆动四肢；点击幕面后用 ↑ ↓ ← → 移动身躯。
  - paragraph: 拖动沉香的手脚或握柄；舞台上的方向键移动身躯，方向按钮移动所选杆，滑块可精调关节。
  - group "牵动沉香":
    - text: 牵动沉香 当前操纵杆
    - combobox "当前操纵杆":
      - option "身杆"
      - option "右手杆" [selected]
    - group "逐步移动当前操纵杆":
      - button "向左"
      - button "向上"
      - button "向下"
      - button "向右"
    - text: 身杆左右
    - status: 32%
    - slider "身杆左右": "0.32"
    - text: 身杆高低
    - status: 68%
    - slider "身杆高低": "0.68"
    - text: 左髋角度
    - status: 0°
    - slider "左髋角度": "0"
    - text: 左膝角度
    - status: 0°
    - slider "左膝角度": "0"
    - text: 右肩角度
    - status: 0°
    - slider "右肩角度": "0"
    - text: 右肘角度
    - status: 0°
    - slider "右肘角度": "0"
    - text: 右髋角度
    - status: 0°
    - slider "右髋角度": "0"
    - text: 右膝角度
    - status: 0°
    - slider "右膝角度": "0"
    - text: 影偶大小
    - status: 80%
    - slider "影偶大小": "0.8"
    - text: 灯位左右
    - status: 0%
    - slider "灯位左右": "0"
    - text: 影偶离幕距离
    - status: 20%
    - slider "影偶离幕距离": "0.2"
- status: 正在播放当前片段，后续片段会自动接续。
- heading "先举灯呼唤" [level=2]
- paragraph: 山缝仍闭合。移动灯，让共同纹样的投影经过山缝，并保持片刻。
- paragraph:
  - text: 本场沿用先前剧本，未接入中文配音。可先导出作品，再到制偶页归档重开。
  - link "去制偶页 →":
    - /url: "#/craft"
- paragraph: 先举灯呼唤
- paragraph: 点击台词，定位当前片段。不会跳过操偶任务或改变剧情选择。
- navigation "当前片段台词定位":
  - button "定位到第1句，沉香：娘，你看见了吗？": 沉香：娘，你看见了吗？
- button "展开本段完整台词"
- text: 演出节奏（暂停时可切换）
- combobox "演出节奏（暂停时可切换）" [disabled]:
  - option "完整演出" [selected]
  - option "节选导览"
- button "继续操偶" [disabled]
- button "暂停"
- button "重开片段（暂停）"
- button "跳过本段，进入《山后先有回应》"
- button "关闭舞台音效" [pressed]
- button "帮我演过这一段"
- paragraph: 举起手中的灯，移动身躯与灯位，让白框内的灯火照进金色山缝。 金色是目标区域，白线是当前观察范围。暂停不累计动作时间；刷新后会从本段开头自动开演。
- link "先去展馆走走 →":
  - /url: "#/museum"
- navigation "推荐体验顺序":
  - paragraph: 这一场已留下检查点，随时可回“正式演出”接续。也可自由体验其他页面。
  - list:
    - listitem:
      - link "1 故事缘起":
        - /url: "#/"
    - listitem:
      - link "2 制偶":
        - /url: "#/craft"
    - listitem:
      - link "3 调灯":
        - /url: "#/light"
    - listitem:
      - link "4 练习":
        - /url: "#/practice"
    - listitem:
      - link "5 正式演出":
        - /url: "#/story"
    - listitem:
      - link "6 留影成果":
        - /url: "#/result"
    - listitem:
      - link "7 展馆":
        - /url: "#/museum"
- button "再练一次"
```

# Test source

```ts
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
> 116 |   expect((await stored(page)).story).toEqual(fixture.story); await expect(page.locator('#app-view')).toContainText('暂停接续');
      |                                                                                                      ^ Error: expect(locator).toContainText(expected) failed
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