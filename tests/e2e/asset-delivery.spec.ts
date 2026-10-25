import {test,expect} from './formal-fixture';
import type {Page,Download} from '@playwright/test';
import fixture from '../fixtures/project-v1.json' with {type:'json'};
const ready=async(page:Page)=>expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready');
async function seed(page:Page,value:unknown){await page.goto('/study.html');await page.evaluate(async value=>{
  const db=await new Promise<IDBDatabase>((yes,no)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
  try{await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});}finally{db.close();}
},value);}
async function digest(page:Page){return page.locator('.shadow-stage').first().evaluate(async(canvas:HTMLCanvasElement)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',canvas.getContext('2d')!.getImageData(0,0,canvas.width,canvas.height).data))).join(','));}
async function bytes(file:Download){expect(await file.failure()).toBeNull();const chunks:Buffer[]=[];for await(const c of await file.createReadStream())chunks.push(Buffer.from(c));return Buffer.concat(chunks);}

test('lossless delivery and canonical PNG draw identical carving, palettes, frozen duet, WebGL and result PNG',async({browser,page},info)=>{
  test.setTimeout(90000);const context=await browser.newContext({...info.project.use,baseURL:'http://127.0.0.1:4173'});const png=await context.newPage();
  await png.addInitScript(()=>{Object.defineProperty(window,'createImageBitmap',{value:undefined});});
  const modern:string[]=[],canonical:string[]=[];page.on('request',r=>modern.push(r.url()));png.on('request',r=>canonical.push(r.url()));
  try{
    for(const target of [page,png]){await seed(target,fixture);await target.goto('/#/craft');await ready(target);}
    expect(modern.some(url=>url.includes('/assets/delivery/'))).toBe(true);expect(canonical.some(url=>url.includes('/assets/puppets/chenxiang-v1/head-color.png'))).toBe(true);
    expect([...modern,...canonical].filter(url=>/head-mask\.png/.test(url))).toEqual([]);expect(canonical.filter(url=>url.includes('/assets/delivery/'))).toEqual([]);
    for(const pattern of ['cloud-v1','wave-v1','flower-v1'])for(const palette of ['vermilion-v1','woodland-v1']){
      for(const target of [page,png]){await target.locator('#craft-pattern').selectOption(pattern);await target.getByLabel('这一套颜色').selectOption(palette);await ready(target);}
      expect(await digest(page),`${pattern}/${palette}`).toBe(await digest(png));
      for(const target of [page,png])await target.locator('#craft-cut-3').click();expect(await digest(page)).toBe(await digest(png));
    }
    for(const target of [page,png]){await target.locator('.spatial-toggle').first().click();await expect(target.locator('.spatial-stage').first()).toHaveAttribute('data-state','ready');}
    expect((await page.locator('canvas.three-stage').screenshot()).equals(await png.locator('canvas.three-stage').screenshot())).toBe(true);
    for(const id of ['intro','road','guardian','call-light','split-axe','reunion-hold']){
      const early=['intro','road','guardian'].includes(id);
      const project={...fixture,story:{...fixture.story,nodeId:id,assistedNodeIds:[],revision:id==='intro'?0:8,approach:early?null:id==='split-axe'?'split-first':'call-first',approachSource:early?null:'user',...(id==='intro'?{castSnapshot:null}:{})}};
      for(const target of [page,png]){await seed(target,project);await target.goto('/#/story');await ready(target);await expect(target.locator('#story-runtime')).toHaveAttribute('data-state','paused');}
      expect(await digest(page),id+' scenery/props').toBe(await digest(png));
    }
    const completed={...fixture,story:{...fixture.story,nodeId:'completed',revision:16,approach:'call-first',approachSource:'user',completedAt:'2026-10-19T00:00:00.000Z'}};
    const output:Buffer[]=[];
    for(const target of [page,png]){await seed(target,completed);await target.goto('/#/result');await expect(target.locator('#result-png')).toBeEnabled();const wait=target.waitForEvent('download');await target.locator('#result-png').click();output.push(await bytes(await wait));}
    expect(output[0]!.equals(output[1]!)).toBe(true);
  }finally{await context.close();}
});

test('unsupported non-premultiplied decoding uses PNG without requesting delivery files',async({page})=>{
  await page.addInitScript(()=>{const decode=window.createImageBitmap;window.createImageBitmap=((blob:Blob)=>decode(blob,{premultiplyAlpha:'premultiply'})) as typeof createImageBitmap;});
  const paths:string[]=[];page.on('request',r=>paths.push(r.url()));await page.goto('/#/craft');await ready(page);
  expect(paths.some(url=>url.includes('/assets/puppets/chenxiang-v1/head-color.png'))).toBe(true);expect(paths.filter(url=>url.includes('/assets/delivery/'))).toEqual([]);
});

test('damaged delivery fails visibly and explicit retry refetches a repaired image',async({page})=>{
  let damaged=true,count=0;await page.route('**/assets/delivery/mother-v1-head-color.webp*',route=>{count++;return damaged?route.fulfill({status:200,contentType:'image/webp',body:'invalid image'}):route.continue();});
  await page.goto('/#/craft');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','error');await expect(page.locator('.canvas-stage-status')).toContainText('mother-v1-head-color');await expect(page.locator('.shadow-stage')).toBeHidden();
  damaged=false;await page.getByRole('button',{name:'重试幕面',exact:true}).click();await ready(page);expect(count).toBe(2);
});

test('a decoded bitmap arriving after route exit is closed and cannot revive its old canvas',async({page})=>{
  await page.addInitScript(()=>{
    const decode=window.createImageBitmap,live=new Set<ImageBitmap>();let held=false,release!:()=>void;
    Reflect.set(window,'__bitmapRelease',()=>release());Object.defineProperty(window,'__bitmapLive',{get:()=>live.size});
    window.createImageBitmap=(async(blob:Blob,options?:ImageBitmapOptions)=>{
      const image=await decode(blob,options);live.add(image);const close=image.close.bind(image);image.close=()=>{live.delete(image);close();};
      if(!held && blob.size>100){held=true;Reflect.set(window,'__bitmapHeld',true);await new Promise<void>(yes=>{release=yes;});}return image;
    }) as typeof createImageBitmap;
  });
  await page.goto('/#/craft');await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__bitmapHeld'))).toBe(true);const old=await page.locator('.shadow-stage').elementHandle();
  await page.evaluate(()=>{location.hash='#/museum';});await expect(page.locator('#app-view')).toHaveAttribute('data-route','/museum');await page.evaluate(()=>Reflect.get(window,'__bitmapRelease')());
  await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__bitmapLive'))).toBe(0);expect(await old!.evaluate((c:HTMLCanvasElement)=>[c.isConnected,c.width,c.height])).toEqual([false,0,0]);
  await page.evaluate(()=>{location.hash='#/craft';});await ready(page);await page.evaluate(()=>{location.hash='#/museum';});await expect(page.locator('#app-view')).toHaveAttribute('data-route','/museum');await expect.poll(()=>page.evaluate(()=>Reflect.get(window,'__bitmapLive'))).toBe(0);
});

