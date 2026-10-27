import {test,expect} from './formal-fixture';
import type {Page} from '@playwright/test';
import type {ProjectV1,StoryNodeId} from '../../src/domain/types';
import choiceDefinition from '../../src/content/stories/reunion-v5.json' with {type:'json'};
import fixture from '../fixtures/project-v1.json' with {type:'json'};
import {arrangeVoiceNode} from '../../src/content/voice-arrangement';
import type {StoryNode} from '../../src/domain/story-types';
import {CHOICE_RUNS} from '../helpers/choice-cases';
import type {ChoiceRun} from '../helpers/choice-cases';
function choiceAt(id:StoryNodeId,run:ChoiceRun=CHOICE_RUNS[1]!,mode:'full'|'guided'='guided'):ProjectV1 {
 const project=structuredClone(fixture) as ProjectV1,cast=project.story!.castSnapshot;
 Object.assign(project.story!,{definitionVersion:5,nodeId:'intro',revision:0,mode,approach:null,approachSource:null,ending:null,endingSource:null,choices:{journeyIntent:null,mountainPact:null,finalAction:null},castSnapshot:null,assistedNodeIds:[],completedAt:null});
 delete project.story!.skippedNodeIds;
 for(let n=0;project.story!.nodeId!==id&&n<38;n++){
  const s=project.story!,node=choiceDefinition.nodes.find(node=>node.id===s.nodeId)!;
  if(s.nodeId==='craft')s.castSnapshot=cast;
  if(s.nodeId==='journey-choice')s.choices!.journeyIntent=run.journeyIntent;
  if(s.nodeId==='mountain-pact-choice')s.choices!.mountainPact=run.mountainPact;
  if(s.nodeId==='approach-choice'){s.approach=run.approach;s.approachSource='user';}
  if(s.nodeId==='ending-choice'){s.choices!.finalAction=run.finalAction;s.ending=run.ending;s.endingSource='choices';}
  const edges=node.next as unknown as Record<string,StoryNodeId>;s.nodeId=edges.default??edges[s.nodeId==='ending-choice'?run.ending:run.approach]!;s.revision++;
  if(s.nodeId==='curtain')s.completedAt='2026-10-26T12:00:00.000Z';
 }
 if(project.story!.nodeId!==id)throw new Error('Unreachable fixture '+id);return project;
}
const runtime=(p:Page)=>p.locator('#story-runtime');
async function clock(p:Page){await p.addInitScript(()=>{let now=0,id=0;const callbacks=new Map<number,FrameRequestCallback>();Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};window.cancelAnimationFrame=id=>callbacks.delete(id);Reflect.set(window,'__choiceAdvance',async(ms:number)=>{while(ms>0){const dt=Math.min(200,ms);ms-=dt;now+=dt;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(now));await Promise.resolve();}});});}
const advance=(p:Page,ms:number)=>p.evaluate(ms=>Reflect.get(window,'__choiceAdvance')(ms),ms);
async function seed(p:Page,project:ProjectV1){await p.goto('/study.html');await p.evaluate(async value=>{const db=await new Promise<IDBDatabase>((yes,no)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();},project);await p.goto('/#/story');}
async function ready(p:Page,id:string,state:'paused'|'playing'='playing'){await expect(runtime(p)).toHaveAttribute('data-node',id);await expect(p.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready',{timeout:15000});await expect(runtime(p)).toHaveAttribute('data-state',state);}
const duration=(id:StoryNodeId,mode:'full'|'guided')=>arrangeVoiceNode(choiceDefinition.nodes.find(n=>n.id===id)! as unknown as StoryNode,5)[mode==='full'?'fullTiming':'guidedTiming'].targetMs;
const chosenButton=(id:string,r:ChoiceRun)=>id==='journey-choice'?'#story-choice-journey-'+r.journeyIntent:id==='mountain-pact-choice'?'#story-choice-pact-'+r.mountainPact:id==='approach-choice'?'#story-'+r.approach:'#story-choice-final-'+r.finalAction;
async function saved(p:Page){return p.evaluate(async()=>{const db=await new Promise<IDBDatabase>((yes,no)=>{const r=indexedDB.open('yingzuo-v1',1);r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});const text=await new Promise<string>((yes,no)=>{const r=db.transaction('snapshots','readonly').objectStore('snapshots').get('draft');r.onsuccess=()=>yes(r.result as string);r.onerror=()=>no(r.error);});db.close();return JSON.parse(text) as ProjectV1;});}

for(const run of CHOICE_RUNS)for(const mode of ['full','guided'] as const)test(`${run.journeyIntent}/${run.mountainPact}/${run.approach}/${run.finalAction}/${mode}: four decisions produce ${run.ending}`,async({page})=>{
 test.setTimeout(120000);await page.emulateMedia({reducedMotion:'reduce'});await clock(page);await seed(page,choiceAt('intro',run,mode));let choices=0;
 for(let index=0;index<23;index++){
  const id=await runtime(page).getAttribute('data-node') as StoryNodeId;const node=choiceDefinition.nodes.find(n=>n.id===id)!;
  if(id==='completed')break;
  if(id==='craft'){await ready(page,id,'paused');await page.locator('#story-confirm-craft').click();}
  else{
   await ready(page,id);await advance(page,duration(id,mode)+200);
   if(node.kind==='choice'){choices++;await ready(page,id,'paused');const button=page.locator(chosenButton(id,run));await expect(button).toBeEnabled();await button.click();}
   else if(node.kind==='interaction'){await page.locator('#story-assist').click();await advance(page,20000);}
   else if(node.completion.kind==='scene'&&node.completion.activation==='user')await page.locator('#story-finish').click();
  }
  await expect(runtime(page)).not.toHaveAttribute('data-node',id);
 }
 await ready(page,'completed','paused');expect(choices).toBe(4);const project=await saved(page);expect(project.story).toMatchObject({definitionVersion:5,ending:run.ending,endingSource:'choices',approach:run.approach,choices:{journeyIntent:run.journeyIntent,mountainPact:run.mountainPact,finalAction:run.finalAction}});
 await page.locator('a[href="#/result"]:visible').first().click();await expect(page.locator('.reunion-artifact')).toHaveAttribute('data-state','ready',{timeout:15000});await expect(page.getByText('行路愿望',{exact:true})).toBeVisible();
});

test('new opening, refresh and museum return play automatically; same-page pause/reset/mode stay paused',async({page})=>{
 await clock(page);await page.goto('/#/story');await page.locator('#story-start').click();await ready(page,'intro');expect((await saved(page)).story?.definitionVersion).toBe(5);
 await page.locator('#story-pause').click();await ready(page,'intro','paused');await advance(page,1000);await ready(page,'intro','paused');
 await page.reload();await ready(page,'intro');await page.locator('a[href="#/museum"]:visible').first().click();await expect(page.locator('[data-route="/museum"]')).toBeVisible();await page.locator('a[href="#/story"]:visible').first().click();await ready(page,'intro');
 await page.locator('#story-reset').click();await ready(page,'intro','paused');await page.locator('#story-mode').selectOption('guided');await ready(page,'intro','paused');
 await page.locator('#story-next-node').click();await ready(page,'craft','paused');await page.locator('#story-confirm-craft').click();await ready(page,'memory-wave');
});
test('choice after an explicit pause starts its successor without a play click',async({page})=>{
 await clock(page);await seed(page,choiceAt('journey-choice'));await ready(page,'journey-choice');await advance(page,duration('journey-choice','guided')+200);await page.evaluate(()=>dispatchEvent(new Event('blur')));await page.locator('#story-choice-journey-home').click();await ready(page,'training');
});
test('save failure retry stays paused, while refresh grants a fresh entry',async({page})=>{
 await clock(page);await seed(page,choiceAt('journey-choice'));await ready(page,'journey-choice');await advance(page,duration('journey-choice','guided')+200);
 await page.evaluate(()=>{const put=IDBObjectStore.prototype.put;let fail=true;IDBObjectStore.prototype.put=function(value:unknown,key?:IDBValidKey){if(key==='draft'&&fail){fail=false;throw new DOMException('Injected save failure','QuotaExceededError');}return put.call(this,value,key);};});
 await page.locator('#story-choice-journey-home').click();await expect(page.locator('#save-state')).toHaveAttribute('data-state','error');await page.locator('#retry-save').click();await ready(page,'training','paused');await page.reload();await ready(page,'training');
});
test('blur while entry resources load revokes autoplay and late resources cannot revive it',async({page})=>{
 await clock(page);const held:(()=>Promise<void>)[]=[];let releasing=false;const pattern=/guardian.*\.(png|webp)/;
 await page.route(pattern,route=>releasing?route.continue():new Promise<void>(resolve=>{held.push(async()=>{await route.continue();resolve();});}));await seed(page,choiceAt('guardian'));
 await expect(runtime(page)).toHaveAttribute('data-state','loading');await page.evaluate(()=>dispatchEvent(new Event('blur')));releasing=true;await Promise.all(held.map(release=>release()));await page.unroute(pattern);await ready(page,'guardian','paused');await page.locator('#story-play').click();await ready(page,'guardian');
});
test('a document hidden before initialization stays paused until a fresh visible entry',async({page})=>{
 await clock(page);await page.addInitScript(()=>{let hidden=true;Object.defineProperty(document,'hidden',{configurable:true,get:()=>hidden});Reflect.set(window,'__showChoicePage',()=>{hidden=false;document.dispatchEvent(new Event('visibilitychange'));dispatchEvent(new Event('focus'));});});
 await seed(page,choiceAt('memory-words'));await ready(page,'memory-words','paused');const before=await saved(page);await advance(page,40000);expect((await saved(page)).story).toEqual(before.story);
 await page.evaluate(()=>Reflect.get(window,'__showChoicePage')());await ready(page,'memory-words','paused');await page.locator('a[href="#/museum"]:visible').first().click();await page.locator('a[href="#/story"]:visible').first().click();await ready(page,'memory-words');
});
for(const version of [1,2,3,4] as const)test(`restored v${version} uses its own story and enters automatically`,async({page})=>{
 await clock(page);const project=structuredClone(fixture) as ProjectV1;Object.assign(project.story!,{definitionVersion:version,nodeId:'memory-separate',approach:null,approachSource:null,assistedNodeIds:[],completedAt:null});if(version!==1)Object.assign(project.story!,{ending:null,endingSource:null});await seed(page,project);await ready(page,'memory-separate');expect((await saved(page)).story?.definitionVersion).toBe(version);await page.locator('#story-pause').click();await ready(page,'memory-separate','paused');
});
test('v5 guardian staff and result decisions have native wide/narrow visual evidence',async({page},info)=>{
 test.setTimeout(90000);await clock(page);await seed(page,choiceAt('guardian'));await ready(page,'guardian');await page.locator('#story-pause').click();await expect(page.locator('html')).toHaveAttribute('data-intro','done');await page.locator('.guide-complete').waitFor({state:'hidden',timeout:6000});await page.locator('.canvas-stage-screen').screenshot({path:`docs/evidence/t37/staff-entry-${info.project.name}.png`});
 await page.locator('#story-play').click();await advance(page,duration('guardian','guided')+200);await page.locator('#story-assist').click();await advance(page,3600);await expect(runtime(page)).toHaveAttribute('data-showcase','playing');await advance(page,2200);await page.locator('#story-pause').click();await page.locator('.canvas-stage-screen').screenshot({path:`docs/evidence/t37/staff-action-${info.project.name}.png`});
 await page.locator('.spatial-toggle').click();await expect(page.locator('.three-stage')).toHaveAttribute('data-state','ready',{timeout:20000});await page.locator('.three-stage').screenshot({path:`docs/evidence/t37/staff-spatial-${info.project.name}.png`});
 await seed(page,choiceAt('completed'));await page.locator('a[href="#/result"]:visible').first().click();const canvas=page.locator('.reunion-artifact');await expect(canvas).toHaveAttribute('data-state','ready',{timeout:15000});await expect(page.locator('html')).toHaveAttribute('data-intro','done');await canvas.screenshot({path:`docs/evidence/t37/ending-summary-${info.project.name}.png`});
});
