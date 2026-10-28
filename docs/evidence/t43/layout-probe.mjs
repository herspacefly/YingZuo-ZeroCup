import {chromium} from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';

const [origin='http://127.0.0.1:4173/',phase='production']=process.argv.slice(2);
const output='docs/evidence/t43',sizes=phase==='public'?[[390,844],[1366,768],[1440,900]]:[[390,844],[1180,900],[1181,900],[1366,768],[1440,900],[1920,1080]];
const browser=await chromium.launch(),rows=[];
try{for(const [width,height] of sizes){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>new MutationObserver(()=>document.querySelector('#guide-skip')?.click()).observe(document,{childList:true,subtree:true}));
  const response=await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.locator('.story-background').waitFor();await page.evaluate(()=>document.fonts.ready);
  const home=await page.evaluate(()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return{x:b.x,right:b.right,width:b.width};};return{card:r('.story-background'),features:r('.home-features'),overflow:document.documentElement.scrollWidth-innerWidth,entries:[...document.scripts].map(e=>e.src).filter(s=>s.includes('/assets/main-'))};});
  const project=JSON.parse(fs.readFileSync('tests/fixtures/project-v1.json','utf8'));
  Object.assign(project.story,{definitionVersion:5,nodeId:'memory-words',mode:'guided',approach:null,approachSource:null,ending:null,endingSource:null,choices:{journeyIntent:null,mountainPact:null,finalAction:null},assistedNodeIds:[],completedAt:null});
  await page.goto(new URL('study.html',origin).href);
  await page.evaluate(async value=>{const db=await new Promise((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});await new Promise((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();},project);
  await page.goto(new URL('#/story',origin).href);await page.locator('.canvas-stage-status[data-state="ready"]').waitFor({state:'attached'});await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>!document.querySelector('.guide-banner'));if(await page.locator('#story-pause').isEnabled())await page.locator('#story-pause').click();
  await page.waitForFunction(()=>{const c=document.querySelector('.story-stage-slot .shadow-stage'),b=c.getBoundingClientRect();return Math.abs(c.width/c.height-b.width/b.height)<.01;});
  const stage=await page.evaluate(()=>{const r=s=>{const b=document.querySelector(s).getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,width:b.width,height:b.height};};const c=document.querySelector('.story-stage-slot .shadow-stage');return{slot:r('.story-stage-slot'),screen:r('.story-stage-slot .canvas-stage-screen'),canvas:r('.story-stage-slot .shadow-stage'),backing:{width:c.width,height:c.height},panel:r('.story-workspace>.control-panel'),caption:r('.story-caption-dock'),overflow:document.documentElement.scrollWidth-innerWidth};});
  const row={width,height,indexStatus:response.status(),home,stage,errors};rows.push(row);
  assert.equal(row.indexStatus,200);assert(Math.abs(home.card.x-home.features.x)<1&&Math.abs(home.card.right-home.features.right)<1,'Home edges differ');assert(home.overflow<=1&&stage.overflow<=1,'Horizontal overflow');assert.deepEqual(errors,[]);
  assert(Math.abs(stage.screen.x-stage.slot.x)<1&&Math.abs(stage.screen.width-stage.slot.width)<1,'Curtain left edge or track width changed');
  if(width>1180){assert(Math.abs(stage.panel.x-stage.screen.right-24)<1,'Incorrect reading gap');assert(Math.abs(stage.screen.height-Math.min(stage.slot.width*.75+20,height-stage.caption.height-70))<1,'Pre-widening height changed');}
  else assert(stage.panel.y>=stage.slot.y+stage.slot.height-1,'Stacked reader overlaps curtain');
  console.log(JSON.stringify({width,height,home:home.card.width,curtain:stage.screen.width,curtainHeight:stage.screen.height,left:stage.screen.x,gap:stage.panel.x-stage.screen.right,overflow:stage.overflow}));await context.close();
}}finally{await browser.close();fs.writeFileSync(`${output}/layout-${phase}.json`,JSON.stringify(rows,null,2)+'\n');}
