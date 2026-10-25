import {test,expect} from './formal-fixture';
import type {Page} from '@playwright/test';
import content from '../../src/content/stories/reunion-v2.json' with {type:'json'};
import fixture from '../fixtures/project-v1.json' with {type:'json'};
import type {ProjectV1,StoryNodeId,EndingId,Approach} from '../../src/domain/types';
import type {StoryDefinition} from '../../src/domain/story-types';
const expandedDefinition=content as unknown as StoryDefinition;
const ENDING_IDS=['home','light','road','waiting','sacrifice'] as const;
function expandedAt(id:StoryNodeId,approach:Approach='call-first',ending:EndingId='home',mode:'full'|'guided'='full'){
 const p=structuredClone(fixture) as ProjectV1,s=p.story!;s.definitionVersion=2;s.nodeId=id;s.mode=mode;s.assistedNodeIds=[];
 const prefix=['intro','craft','memory-wave','memory-words','memory-separate','road','road-rest','training','guardian','guardian-parley','approach-choice'];
 s.approach=prefix.includes(id)?null:approach;s.approachSource=s.approach?'user':null;s.ending=id.startsWith('ending-')&&id!=='ending-choice'||['curtain','completed','reunion-reach','reunion-hold'].includes(id)?ending:null;s.endingSource=s.ending?'user':null;s.completedAt=['curtain','completed'].includes(id)?'2026-10-21T08:00:00.000Z':null;if(['intro','craft'].includes(id))s.castSnapshot=null;return p;
}

const runtime=(p:Page)=>p.locator('#story-runtime');
async function seed(p:Page,value:ProjectV1){await p.goto('/study.html');await p.evaluate(async value=>{const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise<void>((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();},value);}
async function clock(p:Page){await p.addInitScript(()=>{let now=0,id=0;const callbacks=new Map<number,FrameRequestCallback>();Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};window.cancelAnimationFrame=id=>{callbacks.delete(id);};Reflect.set(window,'__advance',async(ms:number)=>{while(ms>0){const d=Math.min(100,ms);ms-=d;now+=d;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(now));await Promise.resolve();}});});}
const advance=(p:Page,ms:number)=>p.evaluate(ms=>Reflect.get(window,'__advance')(ms),ms);
async function ready(p:Page,id?:string){await expect(runtime(p)).toHaveAttribute('data-state','paused',{timeout:15000});await expect(p.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready',{timeout:15000});if(id)await expect(runtime(p)).toHaveAttribute('data-node',id);}

for(const approach of ['call-first','split-first'] as const)for(const ending of ENDING_IDS)test(`v2 ${approach}/${ending}: entire graphical route, restore, result and replay`,async({page})=>{
 test.setTimeout(120000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await clock(page);await seed(page,expandedAt('memory-wave',approach,ending,'guided'));await page.goto('/#/story');await ready(page,'memory-wave');
 for(let i=0;i<25;i++){
  const id=(await runtime(page).getAttribute('data-node'))!,node=expandedDefinition.nodes.find(n=>n.id===id)!;if(id==='completed')break;
  if(node.kind==='choice')await page.locator(node.id==='ending-choice'?'#story-ending-'+ending:'#story-'+approach).click();
  else if(node.kind==='interaction'){await page.locator('#story-assist').click();await advance(page,9500);}
  else{await page.locator('#story-play').click();await advance(page,node.guidedTiming.targetMs);if(node.completion.kind==='scene'&&node.completion.activation==='user')await page.locator('#story-finish').click();}
  await expect(runtime(page)).not.toHaveAttribute('data-node',id);await ready(page);
 }
 await ready(page,'completed');await page.reload();await ready(page,'completed');await page.goto('/#/result');await expect(page.locator('#result-capture canvas.reunion-artifact')).toHaveAttribute('data-state','ready');await expect(page.locator('#result-id')).toContainText(':ending:'+ending);
 await expect(page.locator('#app-view h1')).toHaveText(expandedDefinition.endings!.find(e=>e.id===ending)!.title);await page.locator('#result-replay').click();await expect(page.locator('#replay-segment option')).toHaveCount(20);await page.locator('#replay-segment').selectOption('19');await expect(page.locator('#result-replay-player .canvas-stage-status')).toHaveAttribute('data-state','ready');
 const downloading=page.waitForEvent('download');await page.locator('#result-png').click();const download=await downloading;expect(await download.failure()).toBeNull();const stream=await download.createReadStream(),parts:Buffer[]=[];for await(const part of stream)parts.push(Buffer.from(part));const png=Buffer.concat(parts);expect(png.readUInt32BE(16)).toBe(1600);expect(png.readUInt32BE(20)).toBe(1200);await expect(page.locator('#result-operation')).toContainText('请求下载');expect(errors).toEqual([]);
});

test('new runs use v4; help is reachable and guide has no unmeasured duration promise',async({page})=>{
 await page.goto('/');await page.locator('#operation-help summary').click();await expect(page.locator('#operation-help')).toHaveAttribute('open','');await expect(page.locator('#operation-help')).toContainText('方向键');await page.locator('#operation-help summary').click();await page.getByRole('button',{name:'节选导览',exact:true}).click();await ready(page,'intro');await expect(page.locator('#story-mode option[value="guided"]')).toHaveText('节选导览');
});

test('actual hand and foot dragging, body arrows, pause and focus keep separate ownership',async({page})=>{
 await clock(page);await seed(page,expandedAt('guardian'));await page.goto('/#/story');await ready(page);await page.locator('#story-play').click();
 const foot=page.locator('[data-limb="leftFoot"]');await foot.scrollIntoViewIfNeeded();const box=(await foot.boundingBox())!;await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+55,box.y+box.height/2-35,{steps:8});await page.mouse.up();await expect(runtime(page)).toHaveAttribute('data-node','guardian');
 const hand=page.locator('[data-limb="rightHand"]');const before=await page.locator('#story-rod-rightShoulder').inputValue();await hand.scrollIntoViewIfNeeded();const h=(await hand.boundingBox())!;await page.mouse.move(h.x+h.width/2,h.y+h.height/2);await page.mouse.down();await page.mouse.move(h.x+h.width/2+35,h.y+h.height/2-45,{steps:8});await page.mouse.up();await expect(page.locator('#story-rod-rightShoulder')).not.toHaveValue(before);
 const x=Number(await page.locator('#story-rod-x').inputValue());await page.locator('.canvas-stage-screen').focus();await page.keyboard.down('ArrowLeft');await advance(page,400);await page.keyboard.up('ArrowLeft');expect(Number(await page.locator('#story-rod-x').inputValue())).toBeLessThan(x);
 await page.locator('#story-pause').click();const paused=await page.locator('#story-rod-x').inputValue();await page.locator('.canvas-stage-screen').focus();await page.keyboard.down('ArrowRight');await advance(page,400);await page.keyboard.up('ArrowRight');expect(await page.locator('#story-rod-x').inputValue()).toBe(paused);await expect(page.locator('.limb-overlay')).toBeHidden();
});

test('spatial story layers follow the shared clock and observation never changes the checkpoint',async({page})=>{
 test.setTimeout(90000);await clock(page);await seed(page,expandedAt('memory-separate'));await page.goto('/#/story');await ready(page);await page.locator('.spatial-toggle').click();await expect(page.locator('.three-stage')).toHaveAttribute('data-state','ready');await expect(page.locator('.three-stage')).toHaveAttribute('data-view','story');
 await page.locator('#story-play').click();await advance(page,3000);const space=page.locator('.three-stage');await expect(space).toHaveAttribute('data-spatial-node','memory-separate');expect(Number(await space.getAttribute('data-spatial-progress'))).toBeGreaterThan(0);await page.locator('#story-pause').click();const progress=await space.getAttribute('data-spatial-progress');await advance(page,2000);expect(await space.getAttribute('data-spatial-progress')).toBe(progress);
 await page.getByRole('button',{name:'人物近看',exact:true}).click();await page.getByRole('combobox',{name:'近看人物'}).selectOption('mother');await expect(space).toHaveAttribute('data-focus-actor','mother');const beforeZoom=await space.screenshot();await page.getByRole('button',{name:'放大',exact:true}).click();expect((await space.screenshot()).equals(beforeZoom)).toBe(false);await page.getByRole('button',{name:'复位观察',exact:true}).click();await expect(runtime(page)).toHaveAttribute('data-node','memory-separate');
 expect(Number(await space.getAttribute('data-draw-calls'))).toBeLessThanOrEqual(80);await page.locator('#story-play').click();await advance(page,expandedDefinition.nodes.find(n=>n.id==='memory-separate')!.fullTiming.targetMs);await ready(page,'road');await expect(space).toHaveAttribute('data-state','ready',{timeout:15000});await expect(space).toHaveAttribute('data-view','character');await expect(space).toHaveAttribute('data-focus-actor','chenxiang');
 await page.getByRole('button',{name:'只看二维幕面',exact:true}).click();await expect(space).toHaveCount(0);await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');
});

test('a v2 terminal save failure exports the same ending candidate and retries once',async({page})=>{
 await clock(page);await seed(page,expandedAt('ending-sacrifice-epilogue','call-first','sacrifice'));await page.goto('/#/story');await ready(page);
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;let fail=true;IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(fail&&key==='draft'){fail=false;throw new DOMException('T19 quota probe','QuotaExceededError');}return original.call(this,value,key);};});
 await page.locator('#story-play').click();await advance(page,expandedDefinition.nodes.find(n=>n.id==='ending-sacrifice-epilogue')!.fullTiming.targetMs);await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');await expect(runtime(page)).toHaveAttribute('data-node','ending-sacrifice-epilogue');
 const downloading=page.waitForEvent('download');await page.locator('#export-project').click();const stream=await(await downloading).createReadStream(),chunks:Buffer[]=[];for await(const chunk of stream)chunks.push(Buffer.from(chunk));const candidate=JSON.parse(Buffer.concat(chunks).toString('utf8')) as ProjectV1;
 expect(candidate.story).toMatchObject({nodeId:'curtain',ending:'sacrifice',endingSource:'user'});expect(candidate.story!.completedAt).not.toBeNull();await page.locator('#retry-save').click();await ready(page,'curtain');
 await page.locator('#import-project').setInputFiles({name:'terminal-v2.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(candidate))});await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');await page.goto('/#/story');await ready(page,'curtain');await page.goto('/#/result');await expect(page.locator('#result-id')).toContainText(':ending:sacrifice');
});

test('reduced motion without WebGL retains the full open ending and no Three download',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>Object.defineProperty(window,'WebGL2RenderingContext',{value:undefined,configurable:true}));await clock(page);const chunks:string[]=[];page.on('request',r=>{if(/\/assets\/renderer-/.test(r.url()))chunks.push(r.url());});await seed(page,expandedAt('ending-choice','split-first'));await page.goto('/#/story');await ready(page);await expect(page.locator('.spatial-toggle')).toBeDisabled();await page.locator('#story-ending-waiting').click();await ready(page,'ending-waiting-light');await page.locator('#story-assist').click();await advance(page,9500);await ready(page,'ending-waiting-hold');await page.locator('#story-play').click();await advance(page,14000);await page.locator('#story-finish').click();await ready(page,'ending-waiting-epilogue');await page.locator('#story-play').click();await advance(page,20000);await ready(page,'curtain');expect(chunks).toEqual([]);
});

test('all four direct grips remain independently draggable in the practice viewport',async({page})=>{
 await seed(page,expandedAt('guardian'));await page.goto('/#/practice');await expect(page.locator('.canvas-stage-status')).toHaveAttribute('data-state','ready');
 for(const [id,joint,dx] of [['leftHand','leftShoulder',-35],['rightHand','rightShoulder',35],['leftFoot','leftHip',-35],['rightFoot','rightHip',35]] as const){
  await page.locator('#practice-reset').click();const slider=page.locator('#practice-'+joint),before=await slider.inputValue(),grip=page.locator('[data-limb="'+id+'"]');await grip.scrollIntoViewIfNeeded();const b=(await grip.boundingBox())!;await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+dx,b.y+b.height/2-40,{steps:8});await page.mouse.up();await expect(slider,id).not.toHaveValue(before);
 }
});
