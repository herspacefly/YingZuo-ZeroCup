# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: site-music.spec.ts >> only actual curtain playback selects vocals, pause and mute release the media
- Location: tests\e2e\site-music.spec.ts:29:1

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

- Expected  - 1
+ Received  + 8

- Array []
+ Array [
+   Object {
+     "paused": false,
+     "ready": 4,
+     "src": "./audio/jingju-curtain.mp3",
+     "time": 0.011947,
+   },
+ ]
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
  - main [ref=f1e17]:
    - generic [ref=f1e18]:
      - navigation "推荐体验顺序" [ref=f1e19]:
        - paragraph [ref=f1e20]: 初次来访，沿这七步走一遍。每页有明确的下一步，也可以随时自由逛展。
        - list [ref=f1e21]:
          - listitem [ref=f1e22]:
            - link "1 故事缘起" [ref=f1e23] [cursor=pointer]:
              - /url: "#/"
          - listitem [ref=f1e24]:
            - link "2 制偶" [ref=f1e25] [cursor=pointer]:
              - /url: "#/craft"
          - listitem [ref=f1e26]:
            - link "3 调灯" [ref=f1e27] [cursor=pointer]:
              - /url: "#/light"
          - listitem [ref=f1e28]:
            - link "4 练习" [ref=f1e29] [cursor=pointer]:
              - /url: "#/practice"
          - listitem [ref=f1e30]:
            - link "5 正式演出" [ref=f1e31] [cursor=pointer]:
              - /url: "#/story"
          - listitem [ref=f1e32]:
            - link "6 留影成果" [ref=f1e33] [cursor=pointer]:
              - /url: "#/result"
          - listitem [ref=f1e34]:
            - link "7 展馆" [ref=f1e35] [cursor=pointer]:
              - /url: "#/museum"
      - generic [ref=f1e36]:
        - generic [ref=f1e37]:
          - paragraph [ref=f1e38]: 幕前
          - heading "这一场，从此刻接续。" [level=1] [ref=f1e39]
          - paragraph [ref=f1e40]: 每次回来，幕面准备好便从当前这一小段的起点自动开演。你可随时暂停，造型和已确认的选择会被保留。
          - img [aria-hidden]:
            - generic: 这一场，从此刻接续。
        - navigation "这一场的去处" [ref=f1e41]:
          - link "制偶" [ref=f1e42] [cursor=pointer]:
            - /url: "#/craft"
          - link "灯影" [ref=f1e43] [cursor=pointer]:
            - /url: "#/light"
          - link "剧场" [ref=f1e44] [cursor=pointer]:
            - /url: "#/story"
          - link "练习" [ref=f1e45] [cursor=pointer]:
            - /url: "#/practice"
        - complementary "当前台词" [ref=f1e46]:
          - generic [ref=f1e47]: 幕上此刻
          - paragraph [ref=f1e49]: 旁白：这一场的操偶者：你。
        - generic [ref=f1e50]:
          - figure [ref=f1e52]:
            - img "皮影舞台" [ref=f1e54]
            - paragraph [ref=f1e56]: 先听这一段，再接过操偶。
            - generic [ref=f1e57]:
              - button "展开戏台空间" [ref=f1e58] [cursor=pointer]
              - status [ref=f1e59]: 从幕前走到背面，看灯、薄片与操偶杆。
          - generic [ref=f1e61]:
            - status [ref=f1e62]: 正在播放当前片段，后续片段会自动接续。
            - heading "幕后的双手" [level=2] [ref=f1e63]
            - paragraph [ref=f1e64]: 影偶欠身，帷幕半拢，灯、关节和竹杆进入视野；这场戏的幕后向你展开。
            - paragraph [ref=f1e65]:
              - text: 本场沿用先前剧本，未接入中文配音。可先导出作品，再到制偶页归档重开。
              - link "去制偶页 →" [ref=f1e66] [cursor=pointer]:
                - /url: "#/craft"
            - paragraph [ref=f1e67]: 谢幕 · 母子同台
            - generic [ref=f1e68]:
              - paragraph [ref=f1e69]: 点击台词，定位当前片段。不会跳过操偶任务或改变剧情选择。
              - navigation "当前片段台词定位" [ref=f1e70]:
                - button "定位到第1句，旁白：这一场的操偶者：你。" [ref=f1e71] [cursor=pointer]: 旁白：这一场的操偶者：你。
              - button "展开本段完整台词" [ref=f1e72] [cursor=pointer]
            - generic [ref=f1e73]:
              - text: 演出节奏（暂停时可切换）
              - combobox "演出节奏（暂停时可切换）" [disabled] [ref=f1e74]:
                - option "完整演出" [selected]
                - option "节选导览"
            - generic [ref=f1e75]:
              - button "继续片段" [disabled] [ref=f1e76]
              - button "暂停" [ref=f1e77] [cursor=pointer]
              - button "重开片段（暂停）" [ref=f1e78] [cursor=pointer]
              - button "跳过本段，进入《同台成馆》" [ref=f1e79] [cursor=pointer]
            - generic [ref=f1e80]:
              - button "关闭舞台音效" [pressed] [ref=f1e81] [cursor=pointer]
              - status [ref=f1e82]: 舞台音效默认开启；点击或按键后由浏览器自动解锁。
            - paragraph [ref=f1e83]: 每次进入剧场会自动开演，暂停后可继续片段。声音可选，静音也保留全部字幕与操作。
            - link "带走本场节目单 →" [ref=f1e84] [cursor=pointer]:
              - /url: "#/result"
            - link "先去展馆走走 →" [ref=f1e85] [cursor=pointer]:
              - /url: "#/museum"
  - contentinfo [ref=f1e86]:
    - generic [ref=f1e87]: 影作 · 据传统故事原创交互改编
    - link "让幕后的创作，也被看见 ↗" [ref=f1e88] [cursor=pointer]:
      - /url: "#/about"
    - link "素材致谢" [ref=f1e89] [cursor=pointer]:
      - /url: ./credits.html
    - button "切换全站装饰动效" [pressed] [ref=f1e90] [cursor=pointer]: 动效 · 灯火流转
```

# Test source

```ts
  1  | import {test,expect} from './formal-fixture';
  2  | import type {Page} from '@playwright/test';
  3  | import fixture from '../fixtures/project-v1.json' with {type:'json'};
  4  | import type {ProjectV1,StoryNodeId} from '../../src/domain/types';
  5  | async function instrument(page:Page){await page.addInitScript(()=>{
  6  |   const Native=window.Audio,players:HTMLAudioElement[]=[];class TrackedAudio extends Native{constructor(src?:string){super(src);players.push(this);}}
  7  |   Object.defineProperty(window,'Audio',{configurable:true,value:TrackedAudio});Reflect.set(window,'__music',()=>players.map(p=>({src:p.getAttribute('src'),paused:p.paused,time:p.currentTime,ready:p.readyState})));
  8  |   let now=0,id=0;const frames=new Map<number,FrameRequestCallback>();Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};window.cancelAnimationFrame=id=>{frames.delete(id);};Reflect.set(window,'__musicFrame',(delta:number)=>{now+=delta;const list=[...frames.values()];frames.clear();list.forEach(cb=>cb(now));});
  9  | });}
  10 | const stats=(page:Page)=>page.evaluate(()=>Reflect.get(window,'__music')() as {src:string|null;paused:boolean;time:number;ready:number}[]);
  11 | async function seed(page:Page,node:StoryNodeId){const project=structuredClone(fixture) as ProjectV1,story=project.story!;story.nodeId=node;story.approach='call-first';story.approachSource='user';if(node==='curtain')story.completedAt='2026-10-18T15:00:00.000Z';await page.goto('/study.html');await page.evaluate(async p=>{const db=await new Promise<IDBDatabase>((r,j)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});await new Promise<void>((r,j)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(p),'draft');tx.oncomplete=()=>r();tx.onabort=()=>j(tx.error);});db.close();},project);await page.goto('/#/story');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');}
  12 | async function advance(page:Page,ms:number){await page.evaluate(async ms=>{while(ms>0){const d=Math.min(ms,100);Reflect.get(window,'__musicFrame')(d);ms-=d;await Promise.resolve();}},ms);}
  13 | test('site music defaults on, unlocks on the first ordinary click and retains manual mute across routes',async({page})=>{
  14 |   await instrument(page);await page.goto('/#/museum');await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
  15 |   await expect(page.locator('#site-music-toggle')).toHaveAttribute('aria-pressed','true');
  16 |   await page.locator('#app-view h1').click();await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','enabled');
  17 |   await expect.poll(async()=>(await stats(page)).find(p=>p.src)?.ready??0).toBeGreaterThanOrEqual(2);
  18 |   const active=() => stats(page).then(items=>items.find(p=>p.src)!);
  19 |   expect((await active()).src).toContain('jinghu-instrumental.mp3');expect((await active()).paused).toBe(false);await expect(page.locator('#site-music-credit')).toHaveCount(0);
  20 |   await expect.poll(async()=>(await active()).time).toBeGreaterThan(.1);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const paused=await active();expect(paused.paused).toBe(true);
  21 |   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect.poll(async()=>(await active()).paused).toBe(false);expect((await active()).time).toBeGreaterThanOrEqual(paused.time);
  22 |   await page.locator('#site-music-toggle').click();await expect(page.locator('#site-music-toggle')).toHaveAttribute('aria-pressed','false');
  23 |   await page.evaluate(()=>{location.hash='#/craft';});await expect(page.locator('#app-view')).toHaveAttribute('data-route','/craft');await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','muted');expect((await stats(page)).every(p=>p.src===null)).toBe(true);
  24 |   await page.reload();await expect(page.locator('#site-music-toggle')).toHaveAttribute('aria-pressed','true');
  25 | });
  26 | test('reunion first two seconds stay quiet and paused story stops the actual music media',async({page})=>{
  27 |   await instrument(page);await seed(page,'reunion-hold');expect(await stats(page)).toEqual([]);await page.locator('#story-play').click();await advance(page,1900);expect(await stats(page)).toEqual([]);await advance(page,200);await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','enabled');await expect.poll(async()=>(await stats(page)).length).toBe(1);expect((await stats(page))[0]!.src).toContain('jinghu-instrumental');await page.locator('#story-pause').click();expect((await stats(page))[0]!.paused).toBe(true);
  28 | });
  29 | test('only actual curtain playback selects vocals, pause and mute release the media',async({page})=>{
> 30 |   await instrument(page);await seed(page,'curtain');expect(await stats(page)).toEqual([]);await page.locator('#story-play').click();await advance(page,100);await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','enabled');expect((await stats(page))[0]!.src).toContain('jingju-curtain.mp3');await expect(page.locator('#site-music-credit')).toHaveCount(0);await page.locator('#story-pause').click();expect((await stats(page))[0]!.paused).toBe(true);await page.locator('#site-music-toggle').click();expect((await stats(page))[0]!.src).toBeNull();
     |                                                                               ^ Error: expect(received).toEqual(expected) // deep equality
  31 | });
  32 | test('failed audio file reports a real error and the next ordinary gesture retries',async({page})=>{
  33 |   await instrument(page);let refuse=true;await page.route('**/audio/*.mp3',r=>refuse?r.abort('failed'):r.continue());await page.goto('/#/museum');await page.locator('#app-view h1').click();await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','error');refuse=false;await page.locator('#app-view h1').click();await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','enabled');expect((await stats(page)).filter(p=>p.src)).toHaveLength(1);await page.goto('/study.html');
  34 | });
  35 |
  36 | for(const failure of ['blocked','resource'] as const)for(const input of ['pointer','Enter','Space'] as const){
  37 |   test(`music retry ${failure} via ${input} keeps intent and needs one activation`,async({page,isMobile})=>{
  38 |     await instrument(page);
  39 |     let refuse=true,requests=0;
  40 |     if(failure==='resource')await page.route('**/audio/*.mp3',route=>{requests++;return refuse?route.abort('failed'):route.continue();});
  41 |     else await page.addInitScript(()=>{
  42 |       const native=HTMLMediaElement.prototype.play;Reflect.set(window,'__blockMusic',true);Reflect.set(window,'__musicAttempts',0);
  43 |       HTMLMediaElement.prototype.play=function(){
  44 |         if(this.src.includes('jinghu-instrumental.mp3')){
  45 |           Reflect.set(window,'__musicAttempts',Number(Reflect.get(window,'__musicAttempts'))+1);
  46 |           if(Reflect.get(window,'__blockMusic'))return Promise.reject(new DOMException('Injected music gesture refusal','NotAllowedError'));
  47 |         }
  48 |         return native.call(this);
  49 |       };
  50 |     });
  51 |     await page.goto('/#/museum');await page.locator('#app-view h1').click();
  52 |     const button=page.locator('#site-music-toggle'),status=page.locator('#site-music-status'),state=failure==='blocked'?'blocked':'error';
  53 |     await expect(status).toHaveAttribute('data-state',state);
  54 |     await expect(button).toHaveAttribute('aria-pressed','true');
  55 |     const activate=async()=>{if(input==='pointer'){if(isMobile)await button.tap();else await button.click();}else await button.press(input);};
  56 |     const attempts=()=>failure==='resource'?Promise.resolve(requests):page.evaluate(()=>Number(Reflect.get(window,'__musicAttempts')));
  57 |     const before=await attempts();await activate();
  58 |     await expect.poll(attempts).toBeGreaterThan(before);await expect(status).toHaveAttribute('data-state',state);
  59 |     await expect(button).toHaveText('重试戏曲音乐');await expect(button).toHaveAttribute('aria-pressed','true');
  60 |     refuse=false;await page.evaluate(()=>Reflect.set(window,'__blockMusic',false));
  61 |     await activate();await expect(status).toHaveAttribute('data-state','enabled');
  62 |     await expect(button).toHaveText('关闭戏曲音乐');await expect(button).toHaveAttribute('aria-pressed','true');
  63 |     await expect.poll(async()=>(await stats(page)).some(item=>item.src?.includes('jinghu-instrumental.mp3')&&!item.paused&&item.ready>=2&&item.time>0)).toBe(true);
  64 |     await activate();await expect(button).toHaveAttribute('aria-pressed','false');await expect(status).toHaveAttribute('data-state','muted');
  65 |     await page.evaluate(()=>{location.hash='#/about';});await page.locator('#app-view h1').click();
  66 |     await expect(button).toHaveAttribute('aria-pressed','false');expect((await stats(page)).every(item=>item.src===null)).toBe(true);
  67 |   });
  68 | }
  69 | test('ten route exits keep one active global player and actual pagehide releases its source',async({page})=>{
  70 |   await instrument(page);await page.goto('/#/museum');await page.locator('#app-view h1').click();await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','enabled');
  71 |   for(let n=0;n<10;n++){const route=n%2?'/museum':'/craft';await page.evaluate(route=>{location.hash='#'+route;},route);await expect(page.locator('#app-view')).toHaveAttribute('data-route',route);}
  72 |   expect((await stats(page)).filter(p=>p.src)).toHaveLength(1);expect((await stats(page)).find(p=>p.src)!.paused).toBe(false);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));expect((await stats(page)).every(p=>p.paused&&p.src===null)).toBe(true);
  73 | });
  74 |
```