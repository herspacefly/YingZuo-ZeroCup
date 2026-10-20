import {expect,test} from '@playwright/test';
import type {Page} from '@playwright/test';
import fixture from '../fixtures/project-v1.json' with {type:'json'};

const ready=(page:Page)=>expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready');
async function setup(page:Page,blockCache=false){
  await page.addInitScript(blockCache=>{
    let now=0,id=0,copies=0,rectReads=0,blocked=0,failCopy=false;const frames=new Map<number,FrameRequestCallback>(),surfaces=new Set<HTMLCanvasElement>();
    Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};window.cancelAnimationFrame=id=>frames.delete(id);
    Reflect.set(window,'__cacheFrame',(delta:number)=>{now+=delta;rectReads=0;const callbacks=[...frames.values()];frames.clear();callbacks.forEach(cb=>cb(now));return rectReads;});
    const rect=HTMLElement.prototype.getBoundingClientRect;HTMLElement.prototype.getBoundingClientRect=function(){if(this.matches('.shadow-stage'))rectReads++;return rect.call(this);};
    const draw=CanvasRenderingContext2D.prototype.drawImage;CanvasRenderingContext2D.prototype.drawImage=function(this:CanvasRenderingContext2D,image:CanvasImageSource,...args:number[]){
      if(this.canvas.matches('.shadow-stage')&&image instanceof HTMLCanvasElement&&image.width===this.canvas.width&&image.height===this.canvas.height){surfaces.add(image);copies++;if(failCopy)throw new Error('Injected cached-buffer copy failure');}
      return Reflect.apply(draw,this,[image,...args]);
    } as typeof draw;
    const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,type,...args){
      const main=document.querySelector<HTMLCanvasElement>('.shadow-stage');
      if(blockCache&&type==='2d'&&main&&this!==main&&!this.isConnected&&this.width===main.width&&this.height===main.height){blocked++;return null;}
      return Reflect.apply(get,this,[type,...args]);
    } as typeof get;
    Reflect.set(window,'__cacheProbe',()=>({copies,blocked,surfaces:[...surfaces].map(c=>[c.width,c.height]),frames:frames.size}));
    Reflect.set(window,'__cacheFailCopy',(value:boolean)=>{failCopy=value;});
  },blockCache);
  const project=structuredClone(fixture);Object.assign(project.story,{nodeId:'guardian',approach:null,approachSource:null,assistedNodeIds:[]});
  await page.goto('/study.html');await page.evaluate(async project=>{
    const db=await new Promise<IDBDatabase>((yes,no)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
    try{await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(project),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});}finally{db.close();}
  },project);await page.goto('/#/story');await ready(page);
}
const probe=(page:Page)=>page.evaluate(()=>Reflect.get(window,'__cacheProbe')() as {copies:number;blocked:number;surfaces:number[][];frames:number});
async function frames(page:Page,count=10){for(let i=0;i<count;i++)await page.evaluate(()=>Reflect.get(window,'__cacheFrame')(100));}
async function range(page:Page,id:string,value:number){await page.locator(id).evaluate((input:HTMLInputElement,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);}

test('opaque background is reused, moving light stays direct, resize and exit release old pixels',async({page})=>{
  await setup(page);await page.locator('#story-play').click();await frames(page);
  const first=await probe(page);expect(first.surfaces).toHaveLength(1);expect(first.copies).toBeGreaterThan(2);
  await page.locator('#story-pause').click();await page.evaluate(()=>{location.hash='#/light';});await ready(page);
  expect((await probe(page)).surfaces[0]).toEqual([0,0]);
  await range(page,'#light-distance',.25);expect((await probe(page)).surfaces.filter(([w])=>w!>0)).toHaveLength(1);
  const copies=(await probe(page)).copies;
  for(const value of [-.4,.2,.5])await range(page,'#light-lamp',value);
  expect((await probe(page)).copies).toBe(copies);
  await range(page,'#light-distance',.3);expect((await probe(page)).copies).toBeGreaterThan(copies);
  await page.setViewportSize({width:1025,height:769});await expect.poll(async()=>(await probe(page)).surfaces.every(([w])=>w===0)).toBe(true);
  await range(page,'#light-distance',.29);expect((await probe(page)).surfaces.filter(([w])=>w!>0)).toHaveLength(1);
  await page.evaluate(()=>{location.hash='#/museum';});await expect(page.locator('.museum-section')).toHaveCount(5);
  expect((await probe(page)).surfaces.every(([w,h])=>w===0&&h===0)).toBe(true);
});

test('optional backdrop allocation failure retains full original-quality drawing',async({page})=>{
  await setup(page,true);await page.locator('#story-play').click();await frames(page);await ready(page);
  const state=await probe(page);expect(state.blocked).toBe(1);expect(state.copies).toBe(0);expect(state.surfaces).toEqual([]);
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','playing');
  expect(await page.locator('.shadow-stage').evaluate((c:HTMLCanvasElement)=>c.getContext('2d')!.getImageData(c.width/2,c.height/2,1,1).data[3])).toBe(255);
});

test('cached drawing failure clears buffers and actual retry loads a fresh background',async({page})=>{
  await setup(page);await page.locator('#story-play').click();await frames(page);
  expect((await probe(page)).surfaces).toHaveLength(1);await page.evaluate(()=>Reflect.get(window,'__cacheFailCopy')(true));await frames(page,1);
  await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','error');expect((await probe(page)).surfaces).toEqual([[0,0]]);expect((await probe(page)).frames).toBe(0);
  await page.evaluate(()=>Reflect.get(window,'__cacheFailCopy')(false));await page.getByRole('button',{name:'重试幕面',exact:true}).click();await ready(page);
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','paused');await page.locator('#story-play').click();await frames(page);
  expect((await probe(page)).surfaces.filter(([w])=>w!>0)).toHaveLength(1);
  await page.evaluate(()=>{location.hash='#/museum';});await expect(page.locator('.museum-section')).toHaveCount(5);expect((await probe(page)).surfaces.every(([w])=>w===0)).toBe(true);
});

test('stable drawing refreshes control geometry once and Three follows each new Canvas frame',async({page})=>{
  await setup(page);await page.locator('.spatial-toggle').first().click();await expect(page.locator('.spatial-stage').first()).toHaveAttribute('data-state','ready');
  await page.locator('#story-play').click();await frames(page,3);
  const before=Number(await page.locator('.shadow-stage').getAttribute('data-draws'));
  const reads=await page.evaluate(()=>Reflect.get(window,'__cacheFrame')(100));expect(reads).toBe(1);
  const after=await page.locator('.shadow-stage').getAttribute('data-draws');expect(Number(after)).toBeGreaterThan(before);
  await expect(page.locator('canvas.three-stage')).toHaveAttribute('data-source-draws',after!);
  await expect(page.locator('button[data-story-rod="rightHand"]')).toBeEnabled();
  await page.locator('#story-pause').click();await expect(page.locator('button[data-story-rod="rightHand"]')).toBeDisabled();expect((await probe(page)).frames).toBe(0);
});
