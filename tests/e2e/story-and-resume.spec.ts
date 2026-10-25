import {test,expect} from './formal-fixture';
import type {Download,Page} from '@playwright/test';
import type {ProjectV1} from '../../src/domain/types';
import fixture from '../fixtures/project-v1.json' with {type:'json'};
import content from '../../src/content/stories/reunion-v1.json' with {type:'json'};

const runtime=(page:Page)=>page.locator('#story-runtime');
const ready=async(page:Page,id?:string)=>{await expect(runtime(page)).toHaveAttribute('data-state','paused');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');if(id)await expect(runtime(page)).toHaveAttribute('data-node',id);};
const saved=async(page:Page)=>expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
function projectAt(id:NonNullable<ProjectV1['story']>['nodeId'],mode:'full'|'guided'='full',approach:'call-first'|'split-first'='call-first'):ProjectV1{
  const project=structuredClone(fixture) as ProjectV1,story=project.story!;story.nodeId=id;story.mode=mode;story.assistedNodeIds=[];
  if(['intro','craft','memory-wave','memory-separate','road','training','guardian','approach-choice'].includes(id)){story.approach=null;story.approachSource=null;}else story.approach=approach;
  if(['intro','craft'].includes(id))story.castSnapshot=null;
  if(['curtain','completed'].includes(id))story.completedAt='2026-10-17T08:00:00.000Z';
  return project;
}
async function seed(page:Page,project:ProjectV1){await page.goto('/study.html');await page.evaluate(async value=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
},project);}
async function stored(page:Page):Promise<ProjectV1>{return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const value=await new Promise<string>((resolve,reject)=>{const r=db.transaction('snapshots').objectStore('snapshots').get('draft');r.onsuccess=()=>resolve(r.result as string);r.onerror=()=>reject(r.error);});db.close();return JSON.parse(value);
});}
async function fakeClock(page:Page){await page.addInitScript(()=>{
  let now=0,id=0;const callbacks=new Map<number,FrameRequestCallback>(),late:FrameRequestCallback[]=[];
  Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=callback=>{callbacks.set(++id,callback);return id;};
  window.cancelAnimationFrame=key=>{const callback=callbacks.get(key);if(callback)late.push(callback);callbacks.delete(key);};
  Reflect.set(window,'__frame',(delta:number)=>{now+=delta;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(callback=>callback(now));});
  Reflect.set(window,'__late',()=>late.splice(0).forEach(callback=>callback(now)));Object.defineProperty(window,'__rafCount',{get:()=>callbacks.size});
  const listeners=new Map<string,Set<EventListenerOrEventListenerObject>>();
  for(const [prefix,target]of [['w',window],['d',document]] as const){const add=target.addEventListener.bind(target),remove=target.removeEventListener.bind(target);
    target.addEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{if((new Error().stack??'').includes('http://127.0.0.1:4173/assets/')){const key=prefix+type;if(!listeners.has(key))listeners.set(key,new Set());listeners.get(key)!.add(listener);}add(type,listener,options);}) as typeof target.addEventListener;
    target.removeEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions)=>{listeners.get(prefix+type)?.delete(listener);remove(type,listener,options);}) as typeof target.removeEventListener;
  }
  Reflect.set(window,'__inputListeners',()=>[...listeners].filter(([name])=>/resize|pointer|mouse|touch|blur|keyup|visibility/.test(name)).reduce((count,[,set])=>count+set.size,0));
});}
async function advance(page:Page,ms:number){await page.evaluate(async ms=>{while(ms>0){const delta=Math.min(ms,100);Reflect.get(window,'__frame')(delta);ms-=delta;await Promise.resolve();}},ms);}
async function range(page:Page,id:string,value:number){await page.locator(id).evaluate((input:HTMLInputElement,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);}
async function go(page:Page,path:string){await page.evaluate(path=>{location.hash=`#${path}`;},path);await expect(page.locator('#app-view')).toHaveAttribute('data-route',path);}
async function failOneSave(page:Page){await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let fail=true,writes=0;
  IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(key==='draft'){writes++;if(fail){fail=false;throw new DOMException('Injected scene quota','QuotaExceededError');}}return put.call(this,value,key);};Object.defineProperty(window,'__writes',{get:()=>writes});});}
async function manual(page:Page,id:string){
  await page.locator('#story-play').click();
  if(id==='memory-wave'){await range(page,'#story-rod-rightShoulder',1.8);await range(page,'#story-rod-rightElbow',.52);await advance(page,3000);}
  else if(id==='road'){await range(page,'#story-rod-x',.775);await range(page,'#story-rod-y',.66);await advance(page,2400);}
  else if(id==='guardian'){await range(page,'#story-rod-x',.53);await range(page,'#story-rod-y',.58);await advance(page,2400);}
  else if(['call-light','split-search'].includes(id)){
    await range(page,'#story-distance',.4);await range(page,'#story-rod-x',.535);await range(page,'#story-rod-y',.565);await advance(page,2600);
  }else if(['call-split','split-axe'].includes(id)){
    await range(page,'#story-rod-rightShoulder',1.2);await advance(page,700);await expect(runtime(page)).toHaveAttribute('data-interaction','raised');
    await range(page,'#story-rod-rightShoulder',0);await advance(page,4300);
  }else if(id==='reunion-reach'){
    await advance(page,2000);await range(page,'#story-rod-x',.47);await range(page,'#story-rod-y',.555);await range(page,'#story-rod-rightShoulder',.01);await advance(page,1000);
  }else throw new Error(`Unknown interactive ${id}`);
}

for(const mode of ['full','guided'] as const)for(const approach of ['call-first','split-first'] as const)for(const assisted of [false,true]){
  test(`${mode}/${approach} real graphical controls reach reunion and one curtain with ${assisted?'explicit assistance':'manual input'}`,async({page})=>{
    test.setTimeout(90000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await fakeClock(page);
    const empty=projectAt('intro');await seed(page,empty);await page.goto('/#/story');await ready(page,'intro');
    if(mode==='guided'){await page.locator('#story-mode').selectOption('guided');await ready(page,'intro');}
    await page.locator('#story-play').click();await advance(page,mode==='full'?18000:10000);await expect(page.locator('#app-view')).toHaveAttribute('data-route','/craft');
    await page.locator('#craft-pattern').selectOption('flower-v1');await page.locator('#craft-confirm').click();await ready(page,'memory-wave');
    const cast=(await stored(page)).story!.castSnapshot;const seen:string[]=['intro','craft'];
    for(let index=0;index<18;index++){
      const id=(await runtime(page).getAttribute('data-node'))!;seen.push(id);if(id==='completed')break;
      const definition=content.nodes.find(node=>node.id===id)!;
      if(definition.kind==='interaction'){
        if(assisted){await page.locator('#story-assist').click();await advance(page,8500);}else await manual(page,id);
      }else if(definition.kind==='choice')await page.locator(approach==='call-first'?'#story-call-first':'#story-split-first').click();
      else {
        await page.locator('#story-play').click();await advance(page,mode==='full'?definition.fullTiming.targetMs:definition.guidedTiming.targetMs);
        if(id==='reunion-hold'){expect((await stored(page)).story!.completedAt).toBeNull();await expect(page.locator('#story-finish')).toHaveText('谢幕');await page.locator('#story-finish').click();}
      }
      await expect(runtime(page)).not.toHaveAttribute('data-node',id);await ready(page);
      expect((await stored(page)).story!.castSnapshot).toEqual(cast);
    }
    await ready(page,'completed');const result=await stored(page);expect(result.story).toMatchObject({approach,mode,nodeId:'completed',castSnapshot:cast});expect(result.story!.completedAt).not.toBeNull();
    expect(result.story!.assistedNodeIds).toEqual(assisted?['memory-wave','road','guardian',...(approach==='call-first'?['call-light','call-split']:['split-axe','split-search']),'reunion-reach']:[]);
    const path=approach==='call-first'?['call-light','call-response','call-split']:['split-axe','split-search','split-response'];expect(seen).toEqual(['intro','craft','memory-wave','memory-separate','road','training','guardian','approach-choice',...path,'reunion-reach','reunion-hold','curtain','completed']);
    await page.reload();await ready(page,'completed');expect((await stored(page)).story).toEqual(result.story);await go(page,'/result');await expect(page.locator('.programme-list')).toContainText(approach==='call-first'?'先举灯呼唤':'先挥斧开山');
    expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  });
}

test('manual light uses the motif rather than the whole puppet and failed progress is retried once',async({page})=>{
  await fakeClock(page);await seed(page,projectAt('call-light'));await page.goto('/#/story');await ready(page);await page.locator('#story-play').click();
  await range(page,'#story-rod-x',.52);await range(page,'#story-rod-y',.565);await advance(page,1000);
  expect(Number(await runtime(page).getAttribute('data-coverage'))).toBeLessThan(.35);expect((await stored(page)).story!.nodeId).toBe('call-light');
  await failOneSave(page);await range(page,'#story-distance',.4);await advance(page,800);expect(Number(await runtime(page).getAttribute('data-coverage'))).toBeGreaterThanOrEqual(.35);
  await page.screenshot({path:`docs/evidence/t17-light-${test.info().project.name.startsWith('desktop')?'desktop':'mobile'}.png`,fullPage:true});
  await advance(page,1600);await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');expect((await stored(page)).story!.nodeId).toBe('call-light');
  const writes=await page.evaluate(()=>Reflect.get(window,'__writes'));await advance(page,10000);expect(await page.evaluate(()=>Reflect.get(window,'__writes'))).toBe(writes);
  await page.locator('#retry-save').click();await ready(page,'call-response');const after=await stored(page);expect(after.story!.revision).toBe(fixture.story.revision+1);
});

test('holding a raised axe never auto-lowers and pause invalidates its continuous observation',async({page})=>{
  await fakeClock(page);await seed(page,projectAt('split-axe','full','split-first'));await page.goto('/#/story');await ready(page);await page.locator('#story-play').click();
  await range(page,'#story-rod-rightShoulder',1.2);await advance(page,700);await expect(runtime(page)).toHaveAttribute('data-interaction','raised');await advance(page,60000);
  expect((await stored(page)).story!.nodeId).toBe('split-axe');await page.locator('#story-pause').click();await advance(page,5000);await page.locator('#story-play').click();
  await range(page,'#story-rod-rightShoulder',0);await advance(page,1000);expect((await stored(page)).story!.nodeId).toBe('split-axe');
  await range(page,'#story-rod-rightShoulder',1.2);await advance(page,700);await range(page,'#story-rod-rightShoulder',0);await advance(page,4300);await ready(page,'split-search');
});

test('choice and operated node reload preserve the branch and reset only transient pose and time',async({page})=>{
  await fakeClock(page);await seed(page,projectAt('approach-choice'));await page.goto('/#/story');await ready(page);await advance(page,40000);expect((await stored(page)).story!.approach).toBeNull();
  await page.reload();await ready(page,'approach-choice');await page.locator('#story-split-first').click();await ready(page,'split-axe');
  await page.locator('#story-play').click();await range(page,'#story-rod-rightShoulder',1.2);await advance(page,300);await page.reload();await ready(page,'split-axe');await expect(runtime(page)).toHaveAttribute('data-elapsed','0');
  await expect(page.locator('#story-rod-rightShoulder')).toHaveValue('0');expect((await stored(page)).story).toMatchObject({approach:'split-first',nodeId:'split-axe'});
  await go(page,'/museum');await go(page,'/story');await ready(page,'split-axe');expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);
});

test('pausing the assisted axe restarts a valid short gesture instead of losing its raised stage forever',async({page})=>{
  await fakeClock(page);await seed(page,projectAt('split-axe','full','split-first'));await page.goto('/#/story');await ready(page);await page.locator('#story-assist').click();await advance(page,2200);
  await page.locator('#story-pause').click();await advance(page,6000);expect((await stored(page)).story!.nodeId).toBe('split-axe');await page.locator('#story-play').click();await advance(page,8000);await ready(page,'split-search');
  expect((await stored(page)).story!.assistedNodeIds).toEqual(['split-axe']);
});

test('reunion requires a final hand operation, four quiet seconds and explicit curtain; retry keeps the same result',async({page})=>{
  await fakeClock(page);await seed(page,projectAt('reunion-reach'));await page.goto('/#/story');await ready(page);await page.locator('#story-play').click();await advance(page,2000);
  await range(page,'#story-rod-x',.47);await range(page,'#story-rod-y',.555);await advance(page,1000);expect((await stored(page)).story!.nodeId).toBe('reunion-reach');
  await range(page,'#story-rod-rightShoulder',.01);await advance(page,1000);await ready(page,'reunion-hold');await page.locator('#story-play').click();await advance(page,3900);await expect(page.locator('#story-finish')).toBeHidden();
  await page.screenshot({path:`docs/evidence/t17-reunion-${test.info().project.name.startsWith('desktop')?'desktop':'mobile'}.png`,fullPage:true});
  await advance(page,100);await expect(page.locator('#story-finish')).toHaveText('谢幕');expect((await stored(page)).story!.completedAt).toBeNull();await failOneSave(page);await page.locator('#story-finish').click();
  await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');expect((await stored(page)).story!.nodeId).toBe('reunion-hold');await page.locator('#retry-save').click();await ready(page,'curtain');const first=await stored(page);
  await page.reload();await ready(page,'curtain');await page.locator('#story-play').click();await advance(page,15000);await ready(page,'completed');expect((await stored(page)).story!.completedAt).toBe(first.story!.completedAt);
});

test('real mouse grip and native keyboard input can perform wave and body movement without editing the project',async({page})=>{
  await fakeClock(page);await seed(page,projectAt('memory-wave'));await page.goto('/#/story');await ready(page);await page.locator('#story-play').click();
  const hand=page.locator('button[data-story-rod="rightHand"]');await hand.scrollIntoViewIfNeeded();const box=(await hand.boundingBox())!;
  await page.mouse.move(box.x+24,box.y+24);await page.mouse.down();await page.mouse.move(box.x+60,box.y-60,{steps:5});await page.mouse.up();
  expect(Number(await page.locator('#story-rod-rightShoulder').inputValue())).not.toBe(0);
  await page.locator('#story-rod-rightShoulder').focus();await page.keyboard.press('End');await page.locator('#story-rod-rightElbow').focus();await page.keyboard.press('Home');
  for(let i=0;i<52;i++)await page.keyboard.press('ArrowRight');await advance(page,3000);await ready(page,'memory-separate');
  expect((await stored(page)).pose).toEqual(fixture.pose);
  await seed(page,projectAt('road'));await page.goto('/#/story');await ready(page);await page.locator('#story-play').click();await page.locator('button[data-story-rod="body"]').focus();await page.keyboard.down('ArrowRight');await advance(page,1300);await page.keyboard.up('ArrowRight');await advance(page,2100);await ready(page,'training');
});

test('explicit reduced-motion assistance, memory continuation and ten playing exits keep one clock',async({page})=>{
  test.setTimeout(90000);await page.emulateMedia({reducedMotion:'reduce'});await fakeClock(page);await seed(page,projectAt('road'));await page.goto('/#/story');await ready(page);await failOneSave(page);
  await page.locator('#story-mode').selectOption('guided');await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');await page.locator('#continue-memory').click();await ready(page);const writes=await page.evaluate(()=>Reflect.get(window,'__writes'));
  await page.locator('#story-assist').click();await advance(page,6000);await expect(page.locator('#story-finish')).toBeVisible();expect(await page.evaluate(()=>Reflect.get(window,'__writes'))).toBe(writes);
  await page.locator('#story-finish').click();await ready(page,'training');expect((await stored(page)).story!.assistedNodeIds).toEqual(['road']);
  await seed(page,projectAt('road'));await page.goto('/#/museum');const baseline=await page.evaluate(()=>Reflect.get(window,'__inputListeners')());
  for(let i=0;i<10;i++){
    await go(page,'/story');await ready(page);expect(await page.evaluate(()=>Reflect.get(window,'__inputListeners')())).toBeGreaterThan(baseline);
    const old=await page.locator('.shadow-stage').elementHandle();await page.locator('#story-play').click();await page.locator('button[data-story-rod="body"]').focus();await page.keyboard.down('ArrowRight');await advance(page,100);
    await go(page,'/museum');await page.keyboard.up('ArrowRight');await page.evaluate(()=>Reflect.get(window,'__late')());
    expect(await page.evaluate(()=>Reflect.get(window,'__rafCount'))).toBe(0);expect(await page.evaluate(()=>Reflect.get(window,'__inputListeners')())).toBe(baseline);await expect(page.locator('[data-story-rod]')).toHaveCount(0);
    expect(await old!.evaluate((canvas:HTMLCanvasElement)=>({connected:canvas.isConnected,width:canvas.width}))).toEqual({connected:false,width:0});
  }
});

test('actual touch, cancellation and legacy Touch identifiers move only the active story body',async({page,context})=>{
  await fakeClock(page);await seed(page,projectAt('road'));await page.goto('/#/story');await ready(page);await page.locator('#story-play').click();
  const grip=page.locator('button[data-story-rod="body"]');await grip.scrollIntoViewIfNeeded();let box=(await grip.boundingBox())!,x=box.x+24,y=box.y+24;
  const cdp=await context.newCDPSession(page),before=Number(await page.locator('#story-rod-x').inputValue());
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+20,y:y-5}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
  expect(Number(await page.locator('#story-rod-x').inputValue())).toBeGreaterThan(before);expect((await stored(page)).pose).toEqual(fixture.pose);
  await page.addInitScript(()=>{Object.defineProperty(window,'PointerEvent',{configurable:true,value:undefined});});await page.reload();await ready(page);await page.locator('#story-play').click();await grip.scrollIntoViewIfNeeded();box=(await grip.boundingBox())!;x=box.x+24;y=box.y+24;
  await grip.evaluate((el,{x,y})=>{const make=(identifier:number,cx:number)=>new Touch({identifier,target:el,clientX:cx,clientY:y});const active=make(4,x);el.dispatchEvent(new TouchEvent('touchstart',{bubbles:true,cancelable:true,touches:[active],targetTouches:[active],changedTouches:[active]}));window.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[active,make(9,x+60)],changedTouches:[make(9,x+60)]}));},{x,y});
  const unchanged=await page.locator('#story-rod-x').inputValue();
  expect(Number(unchanged)).toBe(.5);
  await grip.evaluate((el,{x,y})=>{const make=(identifier:number,cx:number)=>new Touch({identifier,target:el,clientX:cx,clientY:y});const moved=make(4,x+20);window.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[moved],targetTouches:[moved],changedTouches:[moved]}));window.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[make(9,x),moved]}));window.dispatchEvent(new TouchEvent('touchmove',{bubbles:true,cancelable:true,touches:[make(4,x+60)],changedTouches:[make(4,x+60)]}));},{x,y});
  expect(Number(await page.locator('#story-rod-x').inputValue())).toBeGreaterThan(Number(unchanged));const ended=await page.locator('#story-rod-x').inputValue();
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await advance(page,1000);expect(await page.locator('#story-rod-x').inputValue()).toBe(ended);await expect(runtime(page)).toHaveAttribute('data-state','paused');
});

test('legacy product accepts real keyboard axe input and the same guarded graphical transition',async({page})=>{
  test.setTimeout(60000);
  await page.route('http://127.0.0.1:4173/',async route=>{const response=await route.fetch();await route.fulfill({response,body:(await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/\snomodule\b/g,'')});});
  await fakeClock(page);await seed(page,projectAt('split-axe','guided','split-first'));await page.goto('/#/story');await ready(page);await expect(page.locator('#app-runtime')).toHaveAttribute('data-entry','legacy');
  await page.locator('#story-play').click();const shoulder=page.locator('#story-rod-rightShoulder');await shoulder.focus();await page.keyboard.press('End');for(let i=0;i<60;i++)await page.keyboard.press('ArrowLeft');
  await advance(page,700);await expect(runtime(page)).toHaveAttribute('data-interaction','raised');await shoulder.focus();for(let i=0;i<120;i++)await page.keyboard.press('ArrowLeft');await advance(page,4300);await ready(page,'split-search');
});

async function downloaded(download:Download):Promise<ProjectV1>{expect(await download.failure()).toBeNull();const chunks:Buffer[]=[];for await(const chunk of await download.createReadStream())chunks.push(Buffer.from(chunk));return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
test('export and clean-browser import preserve a graphical checkpoint while dropping transient light and pose',async({page,browser})=>{
  await fakeClock(page);await seed(page,projectAt('split-search','guided','split-first'));await page.goto('/#/story');await ready(page);await page.locator('#story-play').click();await range(page,'#story-lamp',-.6);await range(page,'#story-rod-y',.59);await page.locator('#story-pause').click();
  await page.getByRole('button',{name:/我的作品/}).click();const waiting=page.waitForEvent('download');await page.locator('#export-project').click();const exported=await downloaded(await waiting);
  expect(exported.stage).toEqual(fixture.stage);expect(exported.pose).toEqual(fixture.pose);expect(exported.story).toMatchObject({nodeId:'split-search',approach:'split-first',mode:'guided'});
  const separate=await browser.newContext({viewport:page.viewportSize()!});try{
    const fresh=await separate.newPage();await fresh.goto('http://127.0.0.1:4173/');await saved(fresh);await fresh.getByRole('button',{name:/我的作品/}).click();
    await fresh.locator('#import-project').setInputFiles({name:'graphical-checkpoint.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(exported))});await saved(fresh);await go(fresh,'/story');await ready(fresh,'split-search');
    expect((await stored(fresh)).story).toEqual(exported.story);expect((await stored(fresh)).projectId).not.toBe(exported.projectId);await expect(fresh.locator('#story-lamp')).toHaveValue('0');await expect(runtime(fresh)).toHaveAttribute('data-elapsed','0');
  }finally{await separate.close();}
});
