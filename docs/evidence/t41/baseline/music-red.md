# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: site-music.spec.ts >> music retry resource via pointer keeps intent and needs one activation
- Location: tests\e2e\site-music.spec.ts:37:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 2
Received:   2

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e1]:
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
    - button "我的作品" [ref=e14] [cursor=pointer]:
      - text: 我的作品
      - status [ref=e15]: 已保存
    - button "开启戏曲音乐" [active] [ref=e16] [cursor=pointer]
  - main [ref=e17]:
    - generic [ref=e18]:
      - generic [ref=e19]:
        - generic [ref=e20]:
          - paragraph [ref=e21]: 影作数字展馆 / 皮影艺术
          - heading "一张皮，一束光，千年戏。" [level=1] [ref=e22]
          - paragraph [ref=e23]: 循着实物与工艺照片，认识皮影的材料、刻制、操演和地方风貌。五个展区，七件展签，随时入馆。
          - img [aria-hidden]:
            - generic: 一张皮，一束光，千年戏。
        - navigation "展馆导览" [ref=e24]:
          - button "一张皮" [ref=e25] [cursor=pointer]
          - button "一道刻" [ref=e26] [cursor=pointer]
          - button "一束光" [ref=e27] [cursor=pointer]
          - button "一双手" [ref=e28] [cursor=pointer]
          - button "一出戏" [ref=e29] [cursor=pointer]
        - generic [ref=e30]:
          - generic [ref=e31]:
            - text: 光影之间 / 手艺长存
            - heading "从一刀一线，读懂一出戏。" [level=2] [ref=e32]
            - paragraph [ref=e33]: 影窗前，是人物的聚散；影窗后，是皮料、刻刀、色彩、灯与操演者的手。先看真实的手工痕迹，再走近它们怎样共同成就一场演出。
            - link "从材料与颜色开始 →" [ref=e34] [cursor=pointer]:
              - /url: "#/museum/E01"
            - paragraph [ref=e35]: 先看实物，认识一刀一线；再亲手试一试。
            - img [aria-hidden]:
              - generic: 从一刀一线，读懂一出戏。
          - figure "河北唐山；2021年常州博物馆展览介绍 · 影人 行当：生 资料出处 ↗" [ref=e36]:
            - img "戴冠的侧面影人，一手前伸，衣身有密集镂空。" [ref=e37]
            - generic [ref=e38]:
              - generic [ref=e39]: 河北唐山；2021年常州博物馆展览介绍 · 影人 行当：生
              - link "资料出处 ↗" [ref=e40] [cursor=pointer]:
                - /url: https://www.chinamuseum.org.cn/detail.html?contentId=9583&id=14
        - generic [ref=e42]:
          - generic [ref=e43]:
            - generic [ref=e44]: "01"
            - heading "一张皮" [level=2] [ref=e45]
            - link "E01 颜色为什么能透出来 一张皮，怎样留住一束光？ ↗" [ref=e47] [cursor=pointer]:
              - /url: "#/museum/E01"
              - generic [ref=e48]: E01
              - generic [ref=e49]:
                - generic [ref=e50]: 颜色为什么能透出来
                - generic [ref=e51]: 一张皮，怎样留住一束光？
              - generic [ref=e52]: ↗
          - generic [ref=e53]:
            - generic [ref=e54]: "02"
            - heading "一道刻" [level=2] [ref=e55]
            - generic [ref=e56]:
              - link "E02 刻掉的地方留下什么 少一笔，影子里会多出什么？ ↗" [ref=e57] [cursor=pointer]:
                - /url: "#/museum/E02"
                - generic [ref=e58]: E02
                - generic [ref=e59]:
                  - generic [ref=e60]: 刻掉的地方留下什么
                  - generic [ref=e61]: 少一笔，影子里会多出什么？
                - generic [ref=e62]: ↗
              - link "E03 一只影偶怎样动起来 关节与三根杆，怎样一起回应手？ ↗" [ref=e63] [cursor=pointer]:
                - /url: "#/museum/E03"
                - generic [ref=e64]: E03
                - generic [ref=e65]:
                  - generic [ref=e66]: 一只影偶怎样动起来
                  - generic [ref=e67]: 关节与三根杆，怎样一起回应手？
                - generic [ref=e68]: ↗
          - generic [ref=e69]:
            - generic [ref=e70]: "03"
            - heading "一束光" [level=2] [ref=e71]
            - link "E04 一盏灯，两种尺度 灯挪一挪，幕上会发生什么？ ↗" [ref=e73] [cursor=pointer]:
              - /url: "#/museum/E04"
              - generic [ref=e74]: E04
              - generic [ref=e75]:
                - generic [ref=e76]: 一盏灯，两种尺度
                - generic [ref=e77]: 灯挪一挪，幕上会发生什么？
              - generic [ref=e78]: ↗
          - generic [ref=e79]:
            - generic [ref=e80]: "04"
            - heading "一双手" [level=2] [ref=e81]
            - link "E05 台上两个人，幕后多少双手 一出戏，需要怎样的配合？ ↗" [ref=e83] [cursor=pointer]:
              - /url: "#/museum/E05"
              - generic [ref=e84]: E05
              - generic [ref=e85]:
                - generic [ref=e86]: 台上两个人，幕后多少双手
                - generic [ref=e87]: 一出戏，需要怎样的配合？
              - generic [ref=e88]: ↗
          - generic [ref=e89]:
            - generic [ref=e90]: "05"
            - heading "一出戏" [level=2] [ref=e91]
            - generic [ref=e92]:
              - link "E06 这出《劈山救母》从哪里来 哪些来自故事，哪些属于这次创作？ ↗" [ref=e93] [cursor=pointer]:
                - /url: "#/museum/E06"
                - generic [ref=e94]: E06
                - generic [ref=e95]:
                  - generic [ref=e96]: 这出《劈山救母》从哪里来
                  - generic [ref=e97]: 哪些来自故事，哪些属于这次创作？
                - generic [ref=e98]: ↗
              - link "E07 同是皮影，各地不同 从不同地方，走进同一张幕。 ↗" [ref=e99] [cursor=pointer]:
                - /url: "#/museum/E07"
                - generic [ref=e100]: E07
                - generic [ref=e101]:
                  - generic [ref=e102]: 同是皮影，各地不同
                  - generic [ref=e103]: 从不同地方，走进同一张幕。
                - generic [ref=e104]: ↗
      - navigation "推荐体验顺序" [ref=e105]:
        - paragraph [ref=e106]: 展馆可以独立阅读。想亲手操演，再沿下列入口走进剧场。
        - list [ref=e107]:
          - listitem [ref=e108]:
            - link "1 故事缘起" [ref=e109] [cursor=pointer]:
              - /url: "#/"
          - listitem [ref=e110]:
            - link "2 制偶" [ref=e111] [cursor=pointer]:
              - /url: "#/craft"
          - listitem [ref=e112]:
            - link "3 调灯" [ref=e113] [cursor=pointer]:
              - /url: "#/light"
          - listitem [ref=e114]:
            - link "4 练习" [ref=e115] [cursor=pointer]:
              - /url: "#/practice"
          - listitem [ref=e116]:
            - link "5 正式演出" [ref=e117] [cursor=pointer]:
              - /url: "#/story"
          - listitem [ref=e118]:
            - link "6 留影成果" [ref=e119] [cursor=pointer]:
              - /url: "#/result"
          - listitem [ref=e120]:
            - link "7 展馆" [ref=e121] [cursor=pointer]:
              - /url: "#/museum"
  - contentinfo [ref=e122]:
    - generic [ref=e123]: 影作 · 据传统故事原创交互改编
    - link "让幕后的创作，也被看见 ↗" [ref=e124] [cursor=pointer]:
      - /url: "#/about"
    - link "素材致谢" [ref=e125] [cursor=pointer]:
      - /url: ./credits.html
    - button "切换全站装饰动效" [pressed] [ref=e126] [cursor=pointer]: 动效 · 灯火流转
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
  30 |   await instrument(page);await seed(page,'curtain');expect(await stats(page)).toEqual([]);await page.locator('#story-play').click();await advance(page,100);await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','enabled');expect((await stats(page))[0]!.src).toContain('jingju-curtain.mp3');await expect(page.locator('#site-music-credit')).toHaveCount(0);await page.locator('#story-pause').click();expect((await stats(page))[0]!.paused).toBe(true);await page.locator('#site-music-toggle').click();expect((await stats(page))[0]!.src).toBeNull();
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
> 58 |     await expect.poll(attempts).toBeGreaterThan(before);await expect(status).toHaveAttribute('data-state',state);
     |                                 ^ Error: expect(received).toBeGreaterThan(expected)
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