import {currentDuration,currentProject} from '../helpers/current-project';
import {test,expect} from './formal-fixture';
import type {Page} from '@playwright/test';

test.beforeEach(async({page})=>{await page.emulateMedia({reducedMotion:'reduce'});});

async function seed(page:Page,interactive=false){
  const project=currentProject(interactive?'memory-wave':'memory-words');
  await page.goto('/study.html');await page.evaluate(async value=>{
    const db=await new Promise<IDBDatabase>((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});
    await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();
  },project);await page.goto('/#/story');await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready',{timeout:15000});return project;
}
// Keep pointer/resize geometry native while controlling only director time.
// This phase starts after all measured narration, with the same <=250ms guard.
async function controlledClock(page:Page){await page.addInitScript(()=>{let now=0,id=0;const jobs=new Map<number,FrameRequestCallback>();Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=callback=>{jobs.set(++id,callback);return id;};window.cancelAnimationFrame=id=>jobs.delete(id);Reflect.set(window,'__horizontalAdvance',async(ms:number)=>{while(ms>0){const delta=Math.min(100,ms);ms-=delta;now+=delta;const callbacks=[...jobs.values()];jobs.clear();callbacks.forEach(callback=>callback(now));await Promise.resolve();}});});}
async function interactive(page:Page){const project=await seed(page,true);if(await page.locator('.page-content #story-voice-toggle').getAttribute('aria-pressed')==='true')await page.locator('.page-content #story-voice-toggle').click();if(await page.locator('.page-content #story-play').isEnabled())await page.locator('.page-content #story-play').click();await page.evaluate(ms=>Reflect.get(window,'__horizontalAdvance')(ms),currentDuration('memory-wave')+100);await expect(page.locator('.page-content button[data-story-rod="rightHand"]')).toBeEnabled();return project;}
async function geometry(page:Page){return page.evaluate(()=>{
  const rect=(selector:string)=>{const r=document.querySelector(selector)!.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right};};
  const canvas=document.querySelector<HTMLCanvasElement>('.story-stage-slot canvas.shadow-stage')!;
  return{screen:rect('.story-stage-slot .canvas-stage-screen'),slot:rect('.story-stage-slot'),panel:rect('.story-workspace>.control-panel'),caption:rect('.story-caption-dock'),canvas:rect('.story-stage-slot canvas.shadow-stage'),backing:{width:canvas.width,height:canvas.height},overflow:document.documentElement.scrollWidth-innerWidth};
});}
async function instrument(page:Page){await page.addInitScript(()=>{
  const draws:{width:number;height:number;canvasWidth:number;canvasHeight:number}[]=[],scales:number[][]=[],backgrounds=new WeakSet<CanvasRenderingContext2D>();
  const draw=CanvasRenderingContext2D.prototype.drawImage,scale=CanvasRenderingContext2D.prototype.scale,gradient=CanvasRenderingContext2D.prototype.createRadialGradient,restore=CanvasRenderingContext2D.prototype.restore;
  CanvasRenderingContext2D.prototype.createRadialGradient=function(this:CanvasRenderingContext2D,...args:Parameters<typeof gradient>){backgrounds.add(this);return gradient.apply(this,args);};
  CanvasRenderingContext2D.prototype.restore=function(this:CanvasRenderingContext2D){backgrounds.delete(this);return restore.call(this);};
  CanvasRenderingContext2D.prototype.drawImage=function(this:CanvasRenderingContext2D,image:CanvasImageSource,...args:number[]){
    // The backdrop painter creates its radial light before painting the scene.
    // Track that scope, since decoded image URLs and foreground plates can vary.
    if(backgrounds.has(this)&&image instanceof HTMLImageElement&&args.length===4){draws.push({width:args[2]!,height:args[3]!,canvasWidth:this.canvas.width,canvasHeight:this.canvas.height});if(draws.length>40)draws.shift();}
    return Reflect.apply(draw,this,[image,...args]);
  } as typeof draw;
  CanvasRenderingContext2D.prototype.scale=function(x:number,y:number){if(this.canvas.matches('.shadow-stage')){scales.push([x,y]);if(scales.length>100)scales.shift();}return scale.call(this,x,y);};
  Reflect.set(window,'__horizontalProbe',()=>({draws,scales}));
});}

test('home background card aligns with the combined edges of the two feature cards',async({page})=>{
  await page.goto('/');await expect(page.locator('.story-background')).toBeVisible();
  const boxes=await page.evaluate(()=>{const rect=(s:string)=>{const r=document.querySelector(s)!.getBoundingClientRect();return{left:r.left,right:r.right,width:r.width};};return{card:rect('.story-background'),features:rect('.home-features'),overflow:document.documentElement.scrollWidth-innerWidth};});
  expect(boxes.card.left).toBeCloseTo(boxes.features.left,0);expect(boxes.card.right).toBeCloseTo(boxes.features.right,0);expect(boxes.overflow).toBeLessThanOrEqual(1);
  await test.info().attach('home-edges',{body:JSON.stringify(boxes),contentType:'application/json'});
  await page.locator('.home-features').evaluate(e=>window.scrollTo(0,window.scrollY+e.getBoundingClientRect().bottom-250));await page.screenshot({path:test.info().outputPath('home-aligned.png')});
});

test('wide curtain retains its original height while only background painting expands horizontally',async({page,isMobile})=>{
  if(!isMobile)await page.setViewportSize({width:1366,height:768});await instrument(page);await seed(page);
  if(await page.locator('#story-pause').isEnabled())await page.locator('#story-pause').click();
  if(!isMobile)await expect.poll(async()=>{const g=await geometry(page);return Math.abs(g.screen.height-Math.min(g.slot.width*.75+20,768-g.caption.height-32));}).toBeLessThan(1);
  const g=await geometry(page);expect(g.screen.x).toBe(g.slot.x);expect(g.screen.width).toBe(g.slot.width);expect(g.overflow).toBeLessThanOrEqual(1);
  if(!isMobile){expect(g.panel.x-g.screen.right).toBeCloseTo(24,0);expect(g.screen.width/g.screen.height).toBeGreaterThan(4/3);}
  const probe=await page.evaluate(()=>Reflect.get(window,'__horizontalProbe')() as {draws:{width:number;height:number;canvasWidth:number;canvasHeight:number}[];scales:number[][]});
  expect(probe.draws.length).toBeGreaterThan(0);const background=probe.draws.filter(d=>d.canvasWidth===g.backing.width&&d.canvasHeight===g.backing.height).at(-1)!;expect(background).toBeTruthy();expect(background.width).toBe(background.canvasWidth);expect(background.height).toBeCloseTo(Math.min(background.canvasHeight,background.canvasWidth*.75),5);
  expect(probe.scales.length).toBeGreaterThan(0);expect(probe.scales.every(([x,y])=>Math.abs(Math.abs(x!)-Math.abs(y!))<1e-6)).toBe(true);
  expect(g.canvas.width/g.canvas.height).toBeCloseTo(g.backing.width/g.backing.height,2);
  await test.info().attach('background-and-actor-scale',{body:JSON.stringify({geometry:g,background,scales:probe.scales}),contentType:'application/json'});
  await page.locator('.guide-complete').waitFor({state:'hidden',timeout:6000});
  await page.locator('.story-workspace').evaluate(e=>window.scrollTo(0,window.scrollY+e.getBoundingClientRect().top-document.querySelector('.story-caption-dock')!.getBoundingClientRect().height-38));await page.screenshot({path:test.info().outputPath('horizontal-curtain.png')});
});

test('stretched background retains real rod dragging and the saved checkpoint',async({page,isMobile})=>{
  await controlledClock(page);const original=await interactive(page);
  const handle=page.locator('button[data-story-rod="rightHand"]');await expect(handle).toBeEnabled();
  const shoulder=page.locator('#story-rod-rightShoulder'),before=Number(await shoulder.inputValue());await handle.scrollIntoViewIfNeeded();
  const box=(await handle.boundingBox())!,x=box.x+box.width/2,y=box.y+box.height/2;if(isMobile){const cdp=await page.context().newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+30,y:y-35}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}else{await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+30,y-35,{steps:5});await page.mouse.up();}
  await expect.poll(async()=>Math.abs(Number(await shoulder.inputValue())-before)).toBeGreaterThan(.01);
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-node','memory-wave');
  const saved=await page.evaluate(async()=>{const db=await new Promise<IDBDatabase>((yes,no)=>{const request=indexedDB.open('yingzuo-v1',1);request.onsuccess=()=>yes(request.result);request.onerror=()=>no(request.error);});try{return await new Promise<string>((yes,no)=>{const request=db.transaction('snapshots').objectStore('snapshots').get('draft');request.onsuccess=()=>yes(request.result as string);request.onerror=()=>no(request.error);});}finally{db.close();}});const project=JSON.parse(saved);expect(project.story).toEqual(original.story);expect(project.pose).toEqual(original.pose);expect(project.stage).toEqual(original.stage);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)).toBeLessThanOrEqual(1);
});

test('paused caption resizing redraws the curtain and repositions input geometry',async({page,isMobile})=>{
  test.skip(isMobile,'Desktop height cap follows the caption; narrow screens retain their normal ratio.');
  await page.setViewportSize({width:1366,height:768});await controlledClock(page);await interactive(page);await page.locator('.page-content #story-pause').click();
  const before=await geometry(page);await page.locator('.story-caption-dock').evaluate(e=>{e.style.minHeight='190px';});
  await expect.poll(async()=>Math.abs((await geometry(page)).screen.height-(768-190-32))).toBeLessThan(1);
  const after=await geometry(page);expect(after.screen.width).toBe(before.screen.width);expect(after.screen.height).toBeLessThan(before.screen.height);
  await expect.poll(async()=>page.locator('.page-content .rod-lines').first().evaluate(e=>Number(e.getAttribute('viewBox')!.split(' ')[3]))).toBeCloseTo(after.canvas.height,0);
  expect(after.canvas.width/after.canvas.height).toBeCloseTo(after.backing.width/after.backing.height,2);
  await page.locator('#story-play').click();await expect.poll(async()=>page.locator('.page-content .limb-lines').first().evaluate(e=>Number(e.getAttribute('viewBox')!.split(' ')[3]))).toBeCloseTo(after.canvas.height,0);
  await page.evaluate(()=>{location.hash='#/museum';});await expect(page.locator('#app-view')).toHaveAttribute('data-route','/museum');await page.setViewportSize({width:1440,height:900});await expect(page.locator('.story-stage-slot')).toHaveCount(0);
});
