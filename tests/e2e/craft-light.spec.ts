import { expect,test } from '@playwright/test';
import type { Download,Page } from '@playwright/test';
import type { ProjectV1 } from '../../src/domain/types';
import { defaultAppearance } from '../../src/domain/defaults';
import fixture from '../fixtures/project-v1.json' with {type:'json'};
const unstarted={...fixture,story:null,appearance:defaultAppearance(),lastRoute:'/craft'};
const craft={...fixture,story:{...fixture.story,nodeId:'craft',revision:1,approach:null,approachSource:null,castSnapshot:null,assistedNodeIds:[],presetAppearanceUsed:false,completedAt:null},lastRoute:'/craft'};
const ready=async(page:Page)=>expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');
const saved=async(page:Page)=>expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
async function seed(page:Page,project:unknown,previous?:unknown){await page.goto('/study.html');await page.evaluate(async({project,previous})=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(project),'draft');if(previous)tx.objectStore('snapshots').put(JSON.stringify(previous),'previous-project');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
},{project,previous});}
async function record(page:Page,key='draft'):Promise<ProjectV1>{return page.evaluate(async key=>{
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const value=await new Promise<string>((resolve,reject)=>{const r=db.transaction('snapshots').objectStore('snapshots').get(key);r.onsuccess=()=>resolve(r.result as string);r.onerror=()=>reject(r.error);});db.close();return JSON.parse(value);
},key);}
async function go(page:Page,path:string){await page.evaluate(path=>{location.hash=`#${path}`;},path);await expect(page.locator('#app-view')).toHaveAttribute('data-route',path);}
async function pixels(page:Page,side:'all'|'left'|'right'='all'){return page.locator('.shadow-stage').evaluate((canvas:HTMLCanvasElement,side)=>{
  const x=side==='right'?Math.floor(canvas.width*.55):0,w=side==='left'?Math.floor(canvas.width*.45):canvas.width-x,data=canvas.getContext('2d')!.getImageData(x,0,w,canvas.height).data;
  let hash=2166136261,opaque=0;for(let i=0;i<data.length;i++)hash=Math.imul(hash^data[i]!,16777619);for(let i=3;i<data.length;i+=4)if(data[i])opaque++;return {hash,opaque};
},side);}
async function range(page:Page,id:string,value:string){await page.locator(id).evaluate((input:HTMLInputElement,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);}
async function downloadJSON(download:Download):Promise<ProjectV1>{expect(await download.failure()).toBeNull();const stream=await download.createReadStream(),chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
async function failOneSave(page:Page){await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let fail=true,writes=0;IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(key==='draft'){writes++;if(fail){fail=false;throw new DOMException('Injected quota','QuotaExceededError');}}return put.call(this,value,key);};Object.defineProperty(window,'__writes',{get:()=>writes});});}

test('three cut segments, per-part colors and candidate mother motif render and survive SAVE-01',async({page})=>{
  await seed(page,unstarted);await page.goto('/#/craft');await ready(page);const left=await pixels(page,'left'),right=await pixels(page,'right');
  await page.locator('#craft-cut-next').focus();for(let i=0;i<3;i++)await page.keyboard.press('Enter');await expect(page.locator('#craft-cut-status')).toContainText('3/3');await expect(page.locator('#craft-cut-next')).toBeDisabled();
  expect((await pixels(page,'left')).hash).not.toBe(left.hash);expect((await pixels(page)).opaque).toBeGreaterThan(1000);
  await page.getByLabel('衣上的纹样').selectOption('flower-v1');await ready(page);await expect.poll(async()=>(await pixels(page,'right')).hash).not.toBe(right.hash);
  await page.getByLabel('这一套颜色').selectOption('indigo-v1');await page.getByRole('button',{name:'分别给衣身、袖、下摆着色',exact:true}).click();
  await page.getByLabel('衣身颜色',{exact:true}).selectOption('4');await page.getByLabel('袖的颜色',{exact:true}).selectOption('3');await page.getByLabel('下摆颜色',{exact:true}).selectOption('1');
  await page.getByRole('button',{name:'保存这身行装',exact:true}).click();await saved(page);const project=await record(page);
  expect(project.appearance).toMatchObject({patternId:'flower-v1',paletteId:'indigo-v1',carvedSegments:[true,true,true],colorSlots:{body:4,sleeve:3,hem:1}});expect(project.story).toBeNull();
  await page.reload();await ready(page);await expect(page.locator('#craft-cut-status')).toContainText('3/3');await expect(page.locator('#craft-body')).toHaveValue('4');await expect(page.locator('#craft-palette')).toHaveValue('indigo-v1');
  await page.locator('#craft-apply-palette').click();await page.getByRole('button',{name:'保存这身行装',exact:true}).click();await saved(page);expect((await record(page)).appearance.colorSlots).toEqual({body:0,sleeve:1,hem:2});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('immediate direct-craft opening freezes queued unsaved edits once and keeps guided intent',async({page})=>{
  await page.goto('/#/craft');await ready(page);await saved(page);await page.locator('#craft-mode').selectOption('guided');
  await page.evaluate(()=>{
    const palette=document.getElementById('craft-palette') as HTMLSelectElement;palette.value='indigo-v1';palette.dispatchEvent(new Event('change',{bubbles:true}));
    document.getElementById('craft-cut-next')!.click();document.getElementById('craft-confirm')!.click();document.getElementById('craft-confirm')!.click();
  });
  await expect(page.locator('#app-view')).toHaveAttribute('data-route','/story');await saved(page);const project=await record(page);
  expect(project.story).toMatchObject({nodeId:'memory-wave',revision:2,mode:'guided',presetAppearanceUsed:false});expect(project.story!.castSnapshot!.appearance).toEqual(project.appearance);expect(project.appearance.paletteId).toBe('indigo-v1');expect(project.appearance.carvedSegments).toEqual([true,false,false]);
  const frozen=project.story;await page.reload();await saved(page);expect((await record(page)).story).toEqual(frozen);await expect(page.locator('#app-view')).toContainText('暂停接续');
});

test('default opening uses the existing craft run, marks preset and preserves editor work',async({page})=>{
  await seed(page,craft);await page.goto('/#/craft');await ready(page);await page.locator('#craft-pattern').selectOption('flower-v1');await ready(page);await page.locator('#craft-preset').click();
  await expect(page.locator('#app-view')).toHaveAttribute('data-route','/story');await saved(page);const project=await record(page);
  expect(project.story).toMatchObject({runId:fixture.story.runId,nodeId:'memory-wave',revision:2,presetAppearanceUsed:true});expect(project.story!.castSnapshot!.appearance).toEqual(defaultAppearance());expect(project.appearance.patternId).toBe('flower-v1');
});

test('failed confirmation exports the frozen candidate while later edits queue separately and retry preserves it',async({page})=>{
  await seed(page,craft);await page.goto('/#/craft');await ready(page);await saved(page);await failOneSave(page);await page.locator('#craft-confirm').click();
  await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');await expect(page.locator('#app-view')).toHaveAttribute('data-route','/craft');expect((await record(page)).story!.nodeId).toBe('craft');
  await page.locator('#craft-pattern').selectOption('flower-v1');await ready(page);await expect(page.locator('#craft-summary')).toContainText('后续修改排队');
  const downloading=page.waitForEvent('download');await page.locator('#export-project').click();const candidate=await downloadJSON(await downloading);
  expect(candidate.appearance.patternId).toBe('flower-v1');expect(candidate.story!.castSnapshot!.appearance.patternId).toBe('wave-v1');
  await page.locator('#retry-save').click();await saved(page);expect((await record(page)).story).toEqual(candidate.story);expect((await record(page)).appearance.patternId).toBe('flower-v1');await expect(page.locator('#craft-return')).toContainText('已冻结');
});

test('editing and explicit archive-rehearsal preserve the old frozen run and the new editor',async({page})=>{
  await seed(page,fixture);await page.goto('/#/craft');await ready(page);const mother=await pixels(page,'right');await page.locator('#craft-pattern').selectOption('flower-v1');await ready(page);
  expect((await pixels(page,'right')).hash).toBe(mother.hash);await expect(page.locator('#craft-confirm')).toBeHidden();await page.locator('#craft-restart').click();await saved(page);
  await expect.poll(async()=>(await record(page)).projectId).not.toBe(fixture.projectId);const fresh=await record(page),old=await record(page,'previous-project');expect(fresh.story).toBeNull();expect(fresh.appearance.patternId).toBe('flower-v1');expect(old.story).toEqual(fixture.story);expect(old.appearance.patternId).toBe('flower-v1');
  await expect(page.locator('#craft-confirm')).toBeEnabled();await page.locator('#craft-confirm').click();await expect(page.locator('#app-view')).toHaveAttribute('data-route','/story');await saved(page);
  expect((await record(page)).story!.runId).not.toBe(fixture.story.runId);expect((await record(page)).story!.castSnapshot!.sharedMotif).toBe('flower-v1');expect((await record(page,'previous-project')).story).toEqual(fixture.story);
});

test('existing archive protection preserves both projects until explicit retry acknowledgement',async({page})=>{
  const previous={...fixture,projectId:'older-project'};await seed(page,fixture,previous);await page.goto('/#/craft');await ready(page);await page.locator('#craft-restart').click();
  await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');expect((await record(page)).projectId).toBe(fixture.projectId);expect((await record(page,'previous-project')).projectId).toBe('older-project');
  await page.locator('#archive-ack').check();await page.locator('#retry-save').click();await saved(page);expect((await record(page)).story).toBeNull();expect((await record(page,'previous-project')).story).toEqual(fixture.story);
});

test('lamp ranges, native keyboard, step buttons and reset save without changing story or practice pose',async({page})=>{
  await seed(page,fixture);await page.goto('/#/story');await ready(page);const storyImage=await pixels(page);await go(page,'/light');await ready(page);const before=await pixels(page);
  await range(page,'#light-lamp','.65');await range(page,'#light-distance','.39');await expect.poll(async()=>(await pixels(page)).hash).not.toBe(before.hash);await page.locator('#light-distance').focus();await page.keyboard.press('ArrowRight');await expect(page.locator('#light-distance')).toHaveValue('0.4');
  await page.getByRole('button',{name:'灯向右',exact:true}).click();await page.getByRole('button',{name:'影偶远离幕',exact:true}).click();await page.getByRole('button',{name:'保存灯影设置',exact:true}).click();await saved(page);
  const project=await record(page);expect(project.stage).toMatchObject({lampX:.7,puppetDistance:.4});expect(project.pose).toEqual(fixture.pose);expect(project.story).toEqual(fixture.story);await expect(page.locator('#light-summary')).toContainText('1.50×');
  await page.reload();await ready(page);await expect(page.locator('#light-lamp')).toHaveValue('0.7');await expect(page.locator('#light-distance')).toHaveValue('0.4');await go(page,'/story');await ready(page);expect((await pixels(page)).hash).toBe(storyImage.hash);
  await go(page,'/light');await ready(page);await page.getByRole('button',{name:'重置灯位与距离',exact:true}).click();await page.getByRole('button',{name:'保存灯影设置',exact:true}).click();await saved(page);expect((await record(page)).stage).toEqual({...fixture.stage,lampX:0,puppetDistance:.2});
});

test('memory-only craft and lamp edits never retry writes until explicit save',async({page})=>{
  await seed(page,craft);await page.goto('/#/craft');await ready(page);await saved(page);await failOneSave(page);await page.locator('#craft-confirm').click();await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');await page.locator('#continue-memory').click();await expect(page.locator('#save-state')).toHaveAttribute('data-state','memory');const writes=await page.evaluate(()=>Reflect.get(window,'__writes'));
  await page.locator('#craft-cut-next').click();await go(page,'/light');await ready(page);await range(page,'#light-lamp','-.7');await range(page,'#light-distance','.1');await page.waitForTimeout(650);await expect(page.locator('#save-state')).toHaveAttribute('data-state','memory');expect(await page.evaluate(()=>Reflect.get(window,'__writes'))).toBe(writes);
  const downloading=page.waitForEvent('download');await page.locator('#export-project').click();const project=await downloadJSON(await downloading);expect(project.stage).toMatchObject({lampX:-.7,puppetDistance:.1});expect(project.appearance.carvedSegments).toEqual([true,true,true]);
  await page.getByRole('button',{name:'保存灯影设置',exact:true}).click();await saved(page);expect((await record(page)).stage).toEqual(project.stage);
});

test('body trial mouse, keyboard and touch are reversible and never replace the saved practice pose',async({page,context})=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await seed(page,fixture);await page.goto('/#/craft');await ready(page);const original=await pixels(page),grip=page.locator('[data-craft-rod="body"]');await expect(grip).toBeEnabled();await grip.scrollIntoViewIfNeeded();let box=(await grip.boundingBox())!;
  await page.mouse.move(box.x+24,box.y+24);await page.mouse.down();await page.mouse.move(box.x+50,box.y+16,{steps:3});await page.mouse.up();expect((await pixels(page)).hash).not.toBe(original.hash);await page.getByRole('button',{name:'重置试提',exact:true}).click();expect((await pixels(page)).hash).toBe(original.hash);
  await grip.focus();await page.keyboard.press('ArrowRight');expect((await pixels(page)).hash).not.toBe(original.hash);await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await grip.scrollIntoViewIfNeeded();box=(await grip.boundingBox())!;
  const cdp=await context.newCDPSession(page);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+24,y:box.y+24}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+45,y:box.y+18}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});await cdp.detach();
  await page.addInitScript(()=>Object.defineProperty(window,'PointerEvent',{configurable:true,value:undefined}));await page.reload();await ready(page);await grip.scrollIntoViewIfNeeded();box=(await grip.boundingBox())!;
  const dispatch=async(type:string,target:'handle'|'window',points:{identifier:number;clientX:number;clientY:number}[])=>page.evaluate(({type,target,points})=>{const event=new Event(type,{bubbles:true,cancelable:true});Object.defineProperty(event,'changedTouches',{value:points});(target==='handle'?document.querySelector('[data-craft-rod="body"]')!:window).dispatchEvent(event);},{type,target,points});
  const point={identifier:7,clientX:box.x+24,clientY:box.y+24},initial=await pixels(page);await dispatch('touchstart','handle',[point]);await dispatch('touchmove','window',[{...point,identifier:9,clientX:point.clientX+25}]);expect((await pixels(page)).hash).toBe(initial.hash);
  await dispatch('touchmove','window',[{...point,clientX:point.clientX+25}]);expect((await pixels(page)).hash).not.toBe(initial.hash);await dispatch('touchcancel','window',[point,{...point,identifier:9}]);
  await saved(page);expect((await record(page)).pose).toEqual(fixture.pose);expect((await record(page)).story).toEqual(fixture.story);expect(errors).toEqual([]);
});

test('legacy product freezes carved colors and saves lamp controls through the same Store in Chromium',async({page})=>{
  await page.route('http://127.0.0.1:4173/',async route=>{const response=await route.fetch();const html=(await response.text()).replace(/<script\b[^>]*type="module"[^>]*>[\s\S]*?<\/script>/g,'').replace(/\snomodule\b/g,'');await route.fulfill({response,body:html});});
  await page.goto('/#/craft');await ready(page);await expect(page.locator('#app-runtime')).toHaveAttribute('data-entry','legacy');await page.locator('#craft-cut-next').click();await page.locator('#craft-confirm').click();await expect(page.locator('#app-view')).toHaveAttribute('data-route','/story');await saved(page);
  const cast=(await record(page)).story!.castSnapshot;expect(cast!.appearance.carvedSegments).toEqual([true,false,false]);await go(page,'/light');await ready(page);await range(page,'#light-lamp','.5');await page.getByRole('button',{name:'保存灯影设置',exact:true}).click();await saved(page);expect((await record(page)).stage.lampX).toBe(.5);expect((await record(page)).story!.castSnapshot).toEqual(cast);
});

test('ten craft/light remounts release input listeners and unavailable Canvas blocks freeze while editing stays available',async({page})=>{
  await page.addInitScript(()=>{const active=new Map<string,Set<EventListenerOrEventListenerObject>>();for(const [prefix,target]of [['w',window],['d',document]] as const){const add=target.addEventListener.bind(target),remove=target.removeEventListener.bind(target);target.addEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|AddEventListenerOptions)=>{if((new Error().stack??'').includes('http://127.0.0.1:4173/assets/')){const key=prefix+type;if(!active.has(key))active.set(key,new Set());active.get(key)!.add(listener);}add(type,listener,options);}) as typeof target.addEventListener;target.removeEventListener=((type:string,listener:EventListenerOrEventListenerObject,options?:boolean|EventListenerOptions)=>{active.get(prefix+type)?.delete(listener);remove(type,listener,options);}) as typeof target.removeEventListener;}
    Reflect.set(window,'__inputs',()=>[...active].filter(([name])=>/resize|pointer|mouse|touch|blur|visibility/.test(name)).reduce((sum,[,items])=>sum+items.size,0));});
  await page.goto('/#/museum');await saved(page);const baseline=await page.evaluate(()=>Reflect.get(window,'__inputs')());for(let i=0;i<10;i++){await go(page,'/craft');await ready(page);expect(await page.evaluate(()=>Reflect.get(window,'__inputs')())).toBeGreaterThan(baseline);await page.getByRole('button',{name:'身杆向右',exact:true}).click();await go(page,'/light');await ready(page);await go(page,'/museum');expect(await page.evaluate(()=>Reflect.get(window,'__inputs')())).toBe(baseline);}
  await page.addInitScript(()=>{HTMLCanvasElement.prototype.getContext=(()=>null) as typeof HTMLCanvasElement.prototype.getContext;});await page.goto('/#/craft');await page.reload();await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','error');await expect(page.locator('#craft-confirm')).toBeDisabled();await expect(page.locator('[data-craft-rod="body"]')).toBeHidden();await expect(page.getByLabel('衣上的纹样')).toBeEnabled();
});
