import {test,expect} from './formal-fixture';
import type {Page} from '@playwright/test';
import fixture from '../fixtures/project-v1.json' with {type:'json'};
import type {ProjectV1,StoryNodeId} from '../../src/domain/types';
async function instrument(page:Page){await page.addInitScript(()=>{
  const Native=window.Audio,players:HTMLAudioElement[]=[];class TrackedAudio extends Native{constructor(src?:string){super(src);players.push(this);}}
  Object.defineProperty(window,'Audio',{configurable:true,value:TrackedAudio});Reflect.set(window,'__music',()=>players.map(p=>({src:p.getAttribute('src'),paused:p.paused,time:p.currentTime,ready:p.readyState})));
  let now=0,id=0;const frames=new Map<number,FrameRequestCallback>();Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};window.cancelAnimationFrame=id=>{frames.delete(id);};Reflect.set(window,'__musicFrame',(delta:number)=>{now+=delta;const list=[...frames.values()];frames.clear();list.forEach(cb=>cb(now));});
});}
const stats=(page:Page)=>page.evaluate(()=>Reflect.get(window,'__music')() as {src:string|null;paused:boolean;time:number;ready:number}[]);
async function seed(page:Page,node:StoryNodeId){const project=structuredClone(fixture) as ProjectV1,story=project.story!;story.nodeId=node;story.approach='call-first';story.approachSource='user';if(node==='curtain')story.completedAt='2026-10-18T15:00:00.000Z';await page.goto('/study.html');await page.evaluate(async p=>{const db=await new Promise<IDBDatabase>((r,j)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});await new Promise<void>((r,j)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(p),'draft');tx.oncomplete=()=>r();tx.onabort=()=>j(tx.error);});db.close();},project);await page.goto('/#/story');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');}
async function advance(page:Page,ms:number){await page.evaluate(async ms=>{while(ms>0){const d=Math.min(ms,100);Reflect.get(window,'__musicFrame')(d);ms-=d;await Promise.resolve();}},ms);}
test('site music defaults on, unlocks on the first ordinary click and retains manual mute across routes',async({page})=>{
  await instrument(page);await page.goto('/#/museum');await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
  await expect(page.locator('#site-music-toggle')).toHaveAttribute('aria-pressed','true');
  await page.locator('#app-view h1').click();await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','enabled');
  await expect.poll(async()=>(await stats(page)).find(p=>p.src)?.ready??0).toBeGreaterThanOrEqual(2);
  const active=() => stats(page).then(items=>items.find(p=>p.src)!);
  expect((await active()).src).toContain('jinghu-instrumental.mp3');expect((await active()).paused).toBe(false);await expect(page.locator('#site-music-credit')).toHaveCount(0);
  await expect.poll(async()=>(await active()).time).toBeGreaterThan(.1);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const paused=await active();expect(paused.paused).toBe(true);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await expect.poll(async()=>(await active()).paused).toBe(false);expect((await active()).time).toBeGreaterThanOrEqual(paused.time);
  await page.locator('#site-music-toggle').click();await expect(page.locator('#site-music-toggle')).toHaveAttribute('aria-pressed','false');
  await page.evaluate(()=>{location.hash='#/craft';});await expect(page.locator('#app-view')).toHaveAttribute('data-route','/craft');await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','muted');expect((await stats(page)).every(p=>p.src===null)).toBe(true);
  await page.reload();await expect(page.locator('#site-music-toggle')).toHaveAttribute('aria-pressed','true');
});
test('reunion first two seconds stay quiet and paused story stops the actual music media',async({page})=>{
  await instrument(page);await seed(page,'reunion-hold');
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','playing');expect(await stats(page)).toEqual([]);
  // The restored story already runs. An ordinary gesture unlocks media without toggling its transport.
  await page.locator('#story-runtime').click();await advance(page,1900);expect(await stats(page)).toEqual([]);
  await advance(page,200);await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','enabled');
  await expect.poll(async()=>(await stats(page)).length).toBe(1);expect((await stats(page))[0]!.src).toContain('jinghu-instrumental');
  await page.locator('#story-pause').click();expect((await stats(page))[0]!.paused).toBe(true);
});
test('only actual curtain playback selects vocals, pause and mute release the media',async({page})=>{
  await instrument(page);await seed(page,'curtain');
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','playing');await page.locator('#story-runtime').click();
  await advance(page,100);await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','enabled');
  expect((await stats(page))[0]!.src).toContain('jingju-curtain.mp3');await expect(page.locator('#site-music-credit')).toHaveCount(0);
  await page.locator('#story-pause').click();expect((await stats(page))[0]!.paused).toBe(true);
  await advance(page,1000);expect((await stats(page))[0]!.paused).toBe(true);
  await page.locator('#site-music-toggle').click();expect((await stats(page))[0]!.src).toBeNull();
});
test('failed audio file reports a real error and the next ordinary gesture retries',async({page})=>{
  await instrument(page);let refuse=true;await page.route('**/audio/*.mp3',r=>refuse?r.abort('failed'):r.continue());await page.goto('/#/museum');await page.locator('#app-view h1').click();await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','error');refuse=false;await page.locator('#app-view h1').click();await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','enabled');expect((await stats(page)).filter(p=>p.src)).toHaveLength(1);await page.goto('/study.html');
});

for(const failure of ['blocked','resource'] as const)for(const input of ['pointer','Enter','Space'] as const){
  test(`music retry ${failure} via ${input} keeps intent and needs one activation`,async({page,isMobile})=>{
    await instrument(page);
    let refuse=true,requests=0;
    if(failure==='resource')await page.route('**/audio/*.mp3',route=>{requests++;return refuse?route.abort('failed'):route.continue();});
    else await page.addInitScript(()=>{
      const native=HTMLMediaElement.prototype.play;Reflect.set(window,'__blockMusic',true);Reflect.set(window,'__musicAttempts',0);
      HTMLMediaElement.prototype.play=function(){
        if(this.src.includes('jinghu-instrumental.mp3')){
          Reflect.set(window,'__musicAttempts',Number(Reflect.get(window,'__musicAttempts'))+1);
          if(Reflect.get(window,'__blockMusic'))return Promise.reject(new DOMException('Injected music gesture refusal','NotAllowedError'));
        }
        return native.call(this);
      };
    });
    await page.goto('/#/museum');await page.locator('#app-view h1').click();
    const button=page.locator('#site-music-toggle'),status=page.locator('#site-music-status'),state=failure==='blocked'?'blocked':'error';
    await expect(status).toHaveAttribute('data-state',state);
    await expect(button).toHaveAttribute('aria-pressed','true');
    const activate=async()=>{if(input==='pointer'){if(isMobile)await button.tap();else await button.click();}else await button.press(input);};
    const attempts=()=>failure==='resource'?Promise.resolve(requests):page.evaluate(()=>Number(Reflect.get(window,'__musicAttempts')));
    const before=await attempts();await activate();
    await expect.poll(attempts).toBeGreaterThan(before);await expect(status).toHaveAttribute('data-state',state);
    await expect(button).toHaveText('重试戏曲音乐');await expect(button).toHaveAttribute('aria-pressed','true');
    refuse=false;await page.evaluate(()=>Reflect.set(window,'__blockMusic',false));
    await activate();await expect(status).toHaveAttribute('data-state','enabled');
    await expect(button).toHaveText('关闭戏曲音乐');await expect(button).toHaveAttribute('aria-pressed','true');
    await expect.poll(async()=>(await stats(page)).some(item=>item.src?.includes('jinghu-instrumental.mp3')&&!item.paused&&item.ready>=2&&item.time>0)).toBe(true);
    await activate();await expect(button).toHaveAttribute('aria-pressed','false');await expect(status).toHaveAttribute('data-state','muted');
    await page.evaluate(()=>{location.hash='#/about';});await page.locator('#app-view h1').click();
    await expect(button).toHaveAttribute('aria-pressed','false');expect((await stats(page)).every(item=>item.src===null)).toBe(true);
  });
}
test('ten route exits keep one active global player and actual pagehide releases its source',async({page})=>{
  await instrument(page);await page.goto('/#/museum');await page.locator('#app-view h1').click();await expect(page.locator('#site-music-status')).toHaveAttribute('data-state','enabled');
  for(let n=0;n<10;n++){const route=n%2?'/museum':'/craft';await page.evaluate(route=>{location.hash='#'+route;},route);await expect(page.locator('#app-view')).toHaveAttribute('data-route',route);}
  expect((await stats(page)).filter(p=>p.src)).toHaveLength(1);expect((await stats(page)).find(p=>p.src)!.paused).toBe(false);await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide')));expect((await stats(page)).every(p=>p.paused&&p.src===null)).toBe(true);
});
