import { expect,test } from '@playwright/test';
import type { Page } from '@playwright/test';
import fixture from '../fixtures/project-v1.json' with {type:'json'};

const ready=async(page:Page)=>expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');
async function seed(page:Page,project:unknown) {
  await page.goto('/study.html');
  await page.evaluate(async value=>{
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    try {await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});}finally{db.close();}
  },project);
}
async function pixels(page:Page,section:'all'|'left'|'right'='all') {
  return page.locator('.shadow-stage').evaluate((canvas:HTMLCanvasElement,section)=>{
    const ctx=canvas.getContext('2d')!,x=section==='right'?Math.floor(canvas.width*.55):0,width=section==='left'?Math.floor(canvas.width*.45):canvas.width-x;
    const data=ctx.getImageData(x,0,width,canvas.height).data;let hash=2166136261,opaque=0,colored=0;
    for(let i=0;i<data.length;i++)hash=Math.imul(hash^data[i]!,16777619);
    for(let i=0;i<data.length;i+=4){if(data[i+3])opaque++;if(data[i+3]&&data[i]!<170&&data[i+1]!<170&&data[i+2]!<170)colored++;}
    return {hash,opaque,colored,total:width*canvas.height};
  },section);
}
test('duet recolors the editor but preserves the frozen mother and saved story',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await seed(page,fixture);await page.goto('/#/craft');await ready(page);
  await expect(page.locator('.shadow-stage')).toHaveAttribute('data-actors','chenxiang,mother');
  const left=await pixels(page,'left'),right=await pixels(page,'right');expect(left.colored).toBeGreaterThan(50);expect(right.opaque).toBeGreaterThan(1000);
  await page.getByLabel('这一套颜色').selectOption('woodland-v1');await ready(page);
  await expect.poll(async()=> (await pixels(page,'left')).hash).not.toBe(left.hash);expect((await pixels(page,'right')).hash).toBe(right.hash);
  await page.getByLabel('衣上的纹样').selectOption('flower-v1');await ready(page);expect((await pixels(page,'right')).hash).toBe(right.hash);
  await page.getByRole('button',{name:'保存这身行装',exact:true}).click();await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
  await page.reload();await ready(page);await expect(page.getByLabel('这一套颜色')).toHaveValue('woodland-v1');expect((await pixels(page,'right')).hash).toBe(right.hash);
  expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('paused story uses its node scene, props and frozen cast independently of editor previews',async({page})=>{
  const project={...fixture,story:{...fixture.story,nodeId:'split-axe',approach:'split-first',revision:8,assistedNodeIds:['memory-wave','road']}};
  await seed(page,project);await page.goto('/#/story');await ready(page);
  await expect(page.locator('.shadow-stage')).toHaveAttribute('data-scene','mountain-v1');
  const before=await pixels(page);await page.evaluate(()=>{location.hash='#/craft';});await expect(page.locator('#app-view')).toHaveAttribute('data-route','/craft');await ready(page);
  await page.getByLabel('这一套颜色').selectOption('woodland-v1');await page.getByRole('button',{name:'保存这身行装',exact:true}).click();await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
  await page.evaluate(()=>{location.hash='#/story';});await expect(page.locator('#app-view')).toHaveAttribute('data-route','/story');await ready(page);expect((await pixels(page)).hash).toBe(before.hash);
  const draws=await page.locator('.shadow-stage').getAttribute('data-draws');await page.waitForTimeout(150);expect(await page.locator('.shadow-stage').getAttribute('data-draws')).toBe(draws);
  await expect(page.locator('#app-view')).toContainText('开头的静止画面');
});
test('missing color image fails visibly with a blank canvas and retry restores both actors',async({page})=>{
  let blocked=true;await page.route(/\/assets\/(?:puppets\/mother-v1\/head-color\.png|delivery\/mother-v1-head-color\.webp)(?:\?|$)/,route=>blocked?route.abort():route.continue());
  await page.goto('/#/craft');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','error');await expect(page.locator('.canvas-stage-status')).toContainText('mother-v1-head-color');
  expect((await pixels(page)).opaque).toBe(0);await expect(page.locator('.shadow-stage')).toBeHidden();
  blocked=false;await page.getByRole('button',{name:'重试幕面',exact:true}).click();await ready(page);await expect(page.locator('.shadow-stage')).toBeVisible();
});
test('carving changes the puppet while keeping the already drawn curtain opaque',async({page})=>{
  const uncut={...fixture,appearance:{...fixture.appearance,carvedSegments:[false,false,false]}};
  await seed(page,uncut);await page.goto('/#/light');await ready(page);const before=await pixels(page);
  await page.getByRole('button',{name:/我的作品/}).click();
  await page.getByLabel('导入作品 JSON').setInputFiles({name:'carved.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(fixture))});
  await expect(page.locator('#app-view')).toHaveAttribute('data-route','/');
  await page.evaluate(()=>{location.hash='#/light';});await expect(page.locator('#app-view')).toHaveAttribute('data-route','/light');await ready(page);
  const carved=await pixels(page);expect(carved.hash).not.toBe(before.hash);expect(carved.opaque).toBe(carved.total);
});
test('Canvas failure leaves the editor and story text available without false ready status',async({page})=>{
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=(()=>null) as typeof HTMLCanvasElement.prototype.getContext;});
  await page.goto('/#/craft');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','error');await expect(page.locator('.canvas-stage-status')).toContainText('Canvas 2D');
  await expect(page.getByLabel('衣上的纹样')).toBeEnabled();await expect(page.locator('#app-view h1')).toBeVisible();await expect(page.locator('.shadow-stage')).toBeHidden();
});
test('a drawing failure clears cached images and retry reads fresh sources',async({page})=>{
  let requests=0;await page.route(/\/assets\/(?:puppets\/chenxiang-v1\/head-color\.png|delivery\/chenxiang-v1-head-color\.webp)(?:\?|$)/,route=>{requests++;return route.continue();});
  await page.addInitScript(()=>{
    const read=CanvasRenderingContext2D.prototype.getImageData;let fail=true;
    CanvasRenderingContext2D.prototype.getImageData=function(...args:Parameters<typeof read>) {if(fail && this.canvas.width>2){fail=false;throw new Error('Injected pixel read failure');}return read.apply(this,args);};
  });
  await page.goto('/#/craft');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','error');
  await expect(page.locator('.canvas-stage-status')).toContainText('Injected pixel read failure');const before=requests;
  await page.getByRole('button',{name:'重试幕面',exact:true}).click();await ready(page);expect(requests).toBeGreaterThan(before);expect((await pixels(page)).colored).toBeGreaterThan(100);
});
test('late images and ten remounts leave one canvas and no detached drawing or resize listeners',async({page})=>{
  await page.addInitScript(()=>{
    const add=window.addEventListener.bind(window),remove=window.removeEventListener.bind(window),active=new Set<EventListenerOrEventListenerObject>();
    window.addEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{if(type==='resize')active.add(listener);add(type,listener,options);}) as typeof window.addEventListener;
    window.removeEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions)=>{if(type==='resize')active.delete(listener);remove(type,listener,options);}) as typeof window.removeEventListener;
    Object.defineProperty(window,'__resizeCount',{get:()=>active.size});
  });
  let release!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;});let entered!:()=>void;const requested=new Promise<void>(resolve=>{entered=resolve;});
  await page.route(/\/assets\/(?:puppets\/chenxiang-v1\/head-color\.png|delivery\/chenxiang-v1-head-color\.webp)(?:\?|$)/,async route=>{entered();await held;await route.continue().catch(()=>{});});
  await page.goto('/#/craft');await requested;const old=await page.locator('.shadow-stage').elementHandle();
  await page.evaluate(()=>{location.hash='#/museum';});await expect(page.locator('#app-view')).toHaveAttribute('data-route','/museum');release();
  expect(await old!.evaluate((canvas:HTMLCanvasElement)=>({connected:canvas.isConnected,width:canvas.width,height:canvas.height}))).toEqual({connected:false,width:0,height:0});
  for(let i=0;i<10;i++) {await page.evaluate(()=>{location.hash='#/practice';});await ready(page);await page.evaluate(()=>{location.hash='#/museum';});await expect(page.locator('.shadow-stage')).toHaveCount(0);}
  expect(await page.evaluate(()=>Reflect.get(window,'__resizeCount'))).toBe(0);
  // Renderer, temporary body rod and direct limb overlay each own a cleaned resize listener.
  await page.evaluate(()=>{location.hash='#/craft';});await ready(page);await expect(page.locator('.shadow-stage')).toHaveCount(1);expect(await page.evaluate(()=>Reflect.get(window,'__resizeCount'))).toBe(3);
  expect(await old!.evaluate((canvas:HTMLCanvasElement)=>canvas.width)).toBe(0);
});
test('legacy product draws the same two-role frame in Chromium smoke check',async({page})=>{
  await page.route('http://127.0.0.1:4173/',async route=>{const response=await route.fetch();const html=(await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/\snomodule\b/g,'');await route.fulfill({response,body:html});});
  await page.goto('/#/craft');await ready(page);await expect(page.locator('#app-runtime')).toHaveAttribute('data-entry','legacy');await expect(page.locator('.shadow-stage')).toHaveAttribute('data-actors','chenxiang,mother');
  expect((await pixels(page)).colored).toBeGreaterThan(100);
});
