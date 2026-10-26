import {test,expect} from './formal-fixture';
import type {Page,Download} from '@playwright/test';
import type {ProjectV1} from '../../src/domain/types';
import story from '../../src/content/stories/reunion-v3.json' with {type:'json'};
import museum from '../../src/content/exhibits.json' with {type:'json'};
const runtime=(page:Page)=>page.locator('#story-runtime');
const saved=async(page:Page)=>expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
async function layout(page:Page){expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
async function ready(page:Page,id?:string){await expect(runtime(page)).toHaveAttribute('data-state','paused');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');if(id)await expect(runtime(page)).toHaveAttribute('data-node',id);await saved(page);await layout(page);}
async function stored(page:Page):Promise<ProjectV1>{return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((yes,no)=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
  try{return JSON.parse(await new Promise<string>((yes,no)=>{const r=db.transaction('snapshots').objectStore('snapshots').get('draft');r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);}));}finally{db.close();}
});}
async function clockAndMedia(page:Page){await page.addInitScript(()=>{
  let now=0,id=0;const frames=new Map<number,FrameRequestCallback>();Object.defineProperty(performance,'now',{value:()=>now});
  window.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};window.cancelAnimationFrame=id=>{frames.delete(id);};
  Reflect.set(window,'__environmentFrame',(delta:number)=>{now+=delta;const list=[...frames.values()];frames.clear();list.forEach(cb=>cb(now));});
  const Native=window.Audio,players:HTMLAudioElement[]=[];class TrackedAudio extends Native{constructor(src?:string){super(src);players.push(this);}}
  Object.defineProperty(window,'Audio',{value:TrackedAudio});Reflect.set(window,'__environmentAudio',players);
});}
async function advance(page:Page,ms:number){await page.evaluate(async ms=>{while(ms>0){const delta=Math.min(ms,100);Reflect.get(window,'__environmentFrame')(delta);ms-=delta;await Promise.resolve();}},ms);}
async function range(page:Page,id:string,value:number){await page.locator(id).evaluate((input:HTMLInputElement,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);}
async function hand(page:Page,reduced=false){
 await page.locator('#story-play').click();const mode=await page.locator('#story-mode').inputValue(),reach=story.nodes.find(n=>n.id==='reunion-reach')!;await advance(page,(mode==='full'?reach.fullTiming:reach.guidedTiming).targetMs+2000);
 if(!reduced){await range(page,'#story-rod-x',.47);await range(page,'#story-rod-y',.555);await range(page,'#story-rod-rightShoulder',.01);}
 else{
  // Match the visible hand target; a still storyboard has a different mother pose.
  const alignment=await page.evaluate(()=>{
   const target=document.querySelector('.story-target')!.getBoundingClientRect(),region=document.querySelector('.story-region')!.getBoundingClientRect(),canvas=document.querySelector('.shadow-stage')!.getBoundingClientRect();
   const value=(id:string)=>Number((document.querySelector(id) as HTMLInputElement).value),width=Math.min(canvas.width,canvas.height*4/3),height=width*.75,mag=1.2/(1.2-value('#story-distance'));
   return {x:value('#story-rod-x')+(target.x+target.width/2-region.x-region.width/2)/width/mag,y:value('#story-rod-y')+(target.y+target.height/2-region.y-region.height/2)/height/mag};
  });
  await range(page,'#story-rod-x',Math.max(0,Math.min(1,alignment.x)));await range(page,'#story-rod-y',Math.max(0,Math.min(1,alignment.y)));
  for(let attempt=0;attempt<2;attempt++){
   const handle=page.locator('button[data-story-rod="rightHand"]');await handle.scrollIntoViewIfNeeded();const box=(await handle.boundingBox())!;
   const delta=await page.evaluate(()=>{const a=document.querySelector('.story-target')!.getBoundingClientRect(),b=document.querySelector('.story-region')!.getBoundingClientRect();return {x:a.x+a.width/2-b.x-b.width/2,y:a.y+a.height/2-b.y-b.height/2};});
   const x=box.x+box.width/2,y=box.y+box.height/2;await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x+(Math.abs(delta.x)+Math.abs(delta.y)<1?2:delta.x),y+delta.y,{steps:5});await page.mouse.up();
  }
 }
 await advance(page,7800);
}
async function playing(page:Page,filename:string){await expect.poll(()=>page.evaluate(filename=>(Reflect.get(window,'__environmentAudio') as HTMLAudioElement[]).some(a=>a.src.endsWith(filename)&&!a.paused&&a.readyState>=2&&a.currentTime>.05),filename)).toBe(true);}
async function bytes(file:Download){expect(await file.failure()).toBeNull();const chunks:Buffer[]=[];for await(const c of await file.createReadStream())chunks.push(Buffer.from(c));return Buffer.concat(chunks);}

for(const mode of ['full','guided'] as const)for(const approach of ['call-first','split-first'] as const)test(`${mode}/${approach}: complete local experience with outside HTTP blocked`,async({page,context},info)=>{
  const forced2D=info.project.metadata.forced2D===true;
  if(forced2D)await page.addInitScript(()=>{Object.defineProperty(window,'WebGL2RenderingContext',{value:undefined,configurable:true});const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,id,...args){if(id==='webgl2'||id==='webgl'||id==='experimental-webgl')return null;return Reflect.apply(get,this,[id,...args]);} as typeof get;});
  const productExternal:string[]=[],failures:{url:string;error:string}[]=[],cancelled:{url:string;error:string}[]=[],errors:string[]=[],responses:string[]=[];let probeBlocked=false;
  await context.route('**/*',async route=>{const url=new URL(route.request().url());if(!/^https?:$/.test(url.protocol)||url.origin==='http://127.0.0.1:4173'){await route.continue();return;}
    if(url.hostname==='example.invalid')probeBlocked=true;else productExternal.push(url.href);await route.abort('internetdisconnected');});
  page.on('pageerror',error=>errors.push(error.message));page.on('requestfailed',r=>{if(r.url().startsWith('http://127.0.0.1:4173')){const item={url:r.url(),error:r.failure()?.errorText??'unknown'};if(item.error==='net::ERR_ABORTED'&&/\/(?:assets\/delivery|audio)\//.test(new URL(item.url).pathname))cancelled.push(item);else failures.push(item);}});page.on('response',r=>{if(r.status()<400)responses.push(new URL(r.url()).pathname);});
  await clockAndMedia(page);await page.goto('/');await saved(page);await layout(page);
  if(forced2D)expect(await page.evaluate(()=>matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  expect(await page.evaluate(()=>fetch('https://example.invalid/preflight-network-proof').then(()=>false,()=>true))).toBe(true);expect(probeBlocked).toBe(true);
  expect(await page.evaluate(()=>(Reflect.get(window,'__environmentAudio') as HTMLAudioElement[]).length)).toBe(0);
  await page.locator('#site-music-toggle').click();await playing(page,'jinghu-instrumental.mp3');
  await page.evaluate(()=>{location.hash='#/story';});await page.locator('#story-start').click();if(mode==='guided')await page.locator('#story-mode').selectOption('guided');await ready(page,'intro');const runId=(await stored(page)).story!.runId;
  await page.locator('#story-play').click();await advance(page,(mode==='full'?story.nodes[0]!.fullTiming:story.nodes[0]!.guidedTiming).targetMs);await ready(page,'craft');await page.evaluate(()=>{location.hash='#/craft';});await expect(page.locator('#app-view')).toHaveAttribute('data-route','/craft');await layout(page);
  await page.locator('#craft-pattern').selectOption('wave-v1');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');
  if(forced2D){await expect(page.locator('.spatial-toggle').first()).toBeDisabled();await expect(page.locator('canvas.three-stage')).toHaveCount(0);}
  else{await page.locator('.spatial-toggle').first().click();await expect(page.locator('.spatial-stage').first()).toHaveAttribute('data-state','ready');await expect(page.locator('canvas.three-stage')).toBeVisible();}
  await page.locator('#craft-confirm').click();await ready(page,'memory-wave');const cast=(await stored(page)).story!.castSnapshot;const seen=['intro','craft'];
  for(let index=0;index<25;index++){
    const id=(await runtime(page).getAttribute('data-node'))!;seen.push(id);if(id==='completed')break;
    const definition=story.nodes.find(n=>n.id===id)!;if(forced2D)await expect(runtime(page)).toHaveAttribute('data-reduced-motion','true');
    if(id==='reunion-reach')await hand(page,forced2D);
    else if(definition.kind==='interaction'){await page.locator('#story-play').click();await advance(page,(mode==='full'?definition.fullTiming:definition.guidedTiming).targetMs);await page.locator('#story-assist').click();await advance(page,11500);}
    else if(definition.kind==='choice'){await page.locator('#story-play').click();await advance(page,(mode==='full'?definition.fullTiming:definition.guidedTiming).targetMs);await page.locator(id==='ending-choice'?'#story-ending-home':approach==='call-first'?'#story-call-first':'#story-split-first').click();}
    else{
      await page.locator('#story-play').click();if(id==='curtain')await playing(page,'jingju-curtain.mp3');
      await advance(page,mode==='full'?definition.fullTiming.targetMs:definition.guidedTiming.targetMs);
      if(definition.completion.kind==='scene'&&definition.completion.activation==='user'){expect((await stored(page)).story!.completedAt).toBeNull();await page.locator('#story-finish').click();}
    }
    await expect(runtime(page)).not.toHaveAttribute('data-node',id);await ready(page);expect((await stored(page)).story!.castSnapshot).toEqual(cast);
  }
  await ready(page,'completed');const completed=await stored(page);expect(completed.story).toMatchObject({runId,approach,mode,nodeId:'completed',castSnapshot:cast});expect(completed.story!.completedAt).not.toBeNull();
  expect(seen).toEqual(['intro','craft','memory-wave','memory-words','memory-separate','road','road-rest','training','guardian','guardian-parley','approach-choice',...(approach==='call-first'?['call-light','call-response','call-split']:['split-axe','split-search','split-response']),'mountain-listen','ending-choice','reunion-reach','reunion-hold','ending-home-epilogue','curtain','completed']);
  await page.reload();await ready(page,'completed');expect((await stored(page)).story).toEqual(completed.story);
  await page.evaluate(()=>{location.hash='#/museum';});await expect(page.locator('.museum-section')).toHaveCount(5);await expect(page.locator('[data-exhibit]')).toHaveCount(7);await layout(page);
  for(const item of museum.exhibits){
    await page.evaluate(id=>{location.hash='#/museum/'+id;},item.id);await expect(page.locator('#app-view h1')).toHaveText(item.title);await page.locator('#exhibit-reading-toggle').click();await expect(page.locator('.exhibit-detail-copy')).toHaveText(item.detail);
    for(const sourceId of item.sourceIds)await expect(page.locator('#exhibit-reading .source-list')).toContainText(sourceId);
    await page.locator('img').evaluateAll(images=>images.forEach(image=>{(image as HTMLImageElement).loading='eager';}));await expect.poll(()=>page.locator('img').evaluateAll(images=>images.every(image=>(image as HTMLImageElement).complete&&(image as HTMLImageElement).naturalWidth>0))).toBe(true);await layout(page);
  }
  await saved(page);expect((await stored(page)).story).toEqual(completed.story);expect((await stored(page)).museum.visitedExhibitIds.length).toBe(8);
  await page.evaluate(()=>{location.hash='#/result';});await expect(page.locator('#result-png')).toBeEnabled();await layout(page);await expect(page.locator('.programme-list')).not.toContainText('SpaceFly');
  const pngWait=page.waitForEvent('download');await page.locator('#result-png').click();const png=await bytes(await pngWait);expect(png.subarray(0,8)).toEqual(Buffer.from([137,80,78,71,13,10,26,10]));expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([1600,1200]);
  const jsonWait=page.waitForEvent('download');await page.locator('#result-json').click();const exported=JSON.parse((await bytes(await jsonWait)).toString('utf8'));expect(exported).toEqual(await stored(page));
  expect(productExternal).toEqual([]);expect(failures).toEqual([]);expect(errors).toEqual([]);expect(responses).toContain('/audio/jinghu-instrumental.mp3');expect(responses).toContain('/audio/jingju-curtain.mp3');expect(responses.some(p=>/\/assets\/renderer-.*\.js$/.test(p))).toBe(!forced2D);
  await info.attach('environment-proof',{contentType:'application/json',body:Buffer.from(JSON.stringify({mode,approach,forced2D,reducedMotion:forced2D,viewport:page.viewportSize(),probeBlocked,productExternal,failures,cancelled,errors,runId,completedAt:completed.story!.completedAt,nodes:seen,localResponses:[...new Set(responses)],pngBytes:png.length,clock:'controlled director time; native media; not real user duration'}))});
});
