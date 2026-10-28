import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
const [phase='before',mode='dev']=process.argv.slice(2),origin=mode==='dev'?'http://127.0.0.1:5173':'http://127.0.0.1:4173';
const output='docs/evidence/t42';fs.mkdirSync(output,{recursive:true});
const sizes=phase==='before'?[[1366,768],[1440,900],[1920,1080]]:[[320,740],[390,844],[980,900],[1180,900],[1181,900],[1366,768],[1440,900],[1920,1080]];
const browser=await chromium.launch(),rows=[];
try{for(const [width,height] of sizes){
  const context=await browser.newContext({viewport:{width,height},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>new MutationObserver(()=>document.querySelector('#guide-skip')?.click()).observe(document,{childList:true,subtree:true}));
  await page.goto(origin+'/#/',{waitUntil:'domcontentloaded'});await page.locator('.story-background').waitFor();await page.evaluate(()=>document.fonts.ready);
  const home=await page.evaluate(()=>{const r=s=>{const e=document.querySelector(s),b=e.getBoundingClientRect();return{x:b.x,width:b.width,right:b.right,height:b.height,maxWidth:getComputedStyle(e).maxWidth};};return{main:r('#main'),opening:r('.opening'),origin:r('.story-background'),features:r('.home-features'),overflow:document.documentElement.scrollWidth-innerWidth};});
  if([1440,390].includes(width))await page.locator('.story-background').screenshot({path:`${output}/${phase}-${mode}-${width}-home.png`});
  const fixture=JSON.parse(fs.readFileSync('tests/fixtures/project-v1.json','utf8'));
  Object.assign(fixture.story,{definitionVersion:5,nodeId:'memory-words',mode:'guided',approach:null,approachSource:null,ending:null,endingSource:null,choices:{journeyIntent:null,mountainPact:null,finalAction:null},assistedNodeIds:[],completedAt:null});
  await page.goto(origin+'/study.html',{waitUntil:'domcontentloaded'});
  await page.evaluate(async p=>{const db=await new Promise((resolve,reject)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>resolve(q.result);q.onerror=()=>reject(q.error);});await new Promise((resolve,reject)=>{const t=db.transaction('snapshots','readwrite');t.objectStore('snapshots').put(JSON.stringify(p),'draft');t.oncomplete=()=>resolve();t.onabort=()=>reject(t.error);});db.close();},fixture);
  await page.goto(origin+'/#/story',{waitUntil:'domcontentloaded'});await page.locator('.canvas-stage-status[data-state="ready"]').waitFor({state:'attached'});await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>!document.querySelector('.guide-banner'));if(await page.locator('#story-pause').isEnabled())await page.locator('#story-pause').click();
  const stage=await page.evaluate(()=>{const r=s=>{const e=document.querySelector(s),b=e.getBoundingClientRect();return{x:b.x,y:b.y,width:b.width,right:b.right,height:b.height,maxWidth:getComputedStyle(e).maxWidth,position:getComputedStyle(e).position};};const canvas=document.querySelector('.story-stage-slot .shadow-stage');return{workspace:r('.story-workspace'),slot:r('.story-stage-slot'),screen:r('.story-stage-slot .canvas-stage-screen'),canvas:r('.story-stage-slot .shadow-stage'),backing:{width:canvas.width,height:canvas.height},panel:r('.story-workspace>.control-panel'),subtitle:r('.story-workspace>.control-panel>.subtitles'),dock:r('.story-caption-dock'),overflow:document.documentElement.scrollWidth-innerWidth};});
  if([1440,390].includes(width)){await page.evaluate(()=>{const workspace=document.querySelector('.story-workspace').getBoundingClientRect(),dock=document.querySelector('.story-caption-dock').getBoundingClientRect();window.scrollTo(0,window.scrollY+workspace.top-dock.height-38);});await page.screenshot({path:`${output}/${phase}-${mode}-${width}-story.png`});}
  const row={width,height,home,stage,errors};rows.push(row);
  if(phase==='after'){
    assert(home.overflow<=1&&stage.overflow<=1,'Horizontal overflow');assert(errors.length===0,errors.join('\n'));
    assert(home.origin.width<=960.1,'Story background exceeds historical 960px width');assert(Math.abs((home.origin.x+home.origin.right)/2-(home.opening.x+home.opening.right)/2)<1,'Story background not centered');
    if(width>1180){assert(Math.abs(stage.screen.x-stage.workspace.x)<1,'Left boundary moved');assert(stage.panel.x-stage.screen.right>=16&&stage.panel.x-stage.screen.right<=28,'Unexpected curtain/reader gap');assert(Math.abs(stage.screen.width-stage.slot.width)<1,'Curtain does not fill its track');}
    else assert(stage.panel.y>=stage.slot.y+stage.slot.height-1,'Narrow reader overlaps stage');
    assert(Math.abs(stage.canvas.width/stage.canvas.height-stage.backing.width/stage.backing.height)<.01,'Canvas backing stretched');
  }
  console.log(JSON.stringify({width,height,home:home.origin.width,stage:stage.screen.width,left:stage.screen.x,gap:stage.panel.x-stage.screen.right,overflow:stage.overflow}));
  await context.close();
}}finally{await browser.close();fs.writeFileSync(`${output}/${phase}-${mode}.json`,JSON.stringify(rows,null,2)+'\n');}
process.exit(0);
