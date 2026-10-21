// Reproducible visual evidence from the current production artifact, using isolated synthetic saves.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {preview} from 'vite';
import {chromium} from 'playwright';
const definition=JSON.parse(readFileSync('src/content/stories/reunion-v2.json','utf8'));
const fixture=JSON.parse(readFileSync('tests/fixtures/project-v1.json','utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
const report={recordedAt:new Date().toISOString(),indexSha256:sha(readFileSync('dist/index.html')),kind:'isolated-current-production-visual-check',clock:'Held RAF for deterministic paused compositions; not native timing or FPS evidence.',screens:[],spatial:[]};
mkdirSync('docs/evidence',{recursive:true});let server,browser;
async function seed(page,nodeId,ending=null){const p=structuredClone(fixture),s=p.story;s.definitionVersion=2;s.nodeId=nodeId;s.ending=ending;s.endingSource=ending?'user':null;s.assistedNodeIds=[];s.completedAt=nodeId==='completed'?'2026-10-21T08:00:00.000Z':null;if(nodeId==='guardian'){s.approach=null;s.approachSource=null;}
 await page.goto('/study.html');await page.evaluate(async value=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const t=db.transaction('snapshots','readwrite');t.objectStore('snapshots').put(JSON.stringify(value),'draft');t.oncomplete=resolve;t.onabort=()=>reject(t.error);});db.close();},p);
}
try{
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});const origin='http://127.0.0.1:'+server.httpServer.address().port;
 browser=await chromium.launch();report.browser=browser.version();
 for(const [profile,width,height] of [['desktop',1440,1000],['narrow',390,844]]){
  const context=await browser.newContext({viewport:{width,height},baseURL:origin});const page=await context.newPage();await page.addInitScript(()=>{let captureFrameId=0;window.requestAnimationFrame=()=>++captureFrameId;window.cancelAnimationFrame=()=>{};});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const end of definition.endings){await seed(page,'completed',end.id);await page.goto('/#/result');await page.locator('.reunion-artifact[data-state="ready"]').waitFor({timeout:15000});await page.locator('#save-state[data-state="saved"]').waitFor();const path=`docs/evidence/t19-${profile}-ending-${end.id}.png`;await page.locator('.result-layout').screenshot({path});report.screens.push({profile,ending:end.id,path,sha256:sha(readFileSync(path)),overflow:await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth)});}
  await seed(page,'ending-choice');await page.goto('/#/story');await page.locator('#story-runtime[data-state="paused"]').waitFor({timeout:15000});const start=Date.now();await page.locator('.spatial-toggle').click();await page.locator('.three-stage[data-state="ready"]').waitFor({timeout:15000});
  for(const view of ['story','character','backstage']){await page.locator(`.spatial-views button[data-view="${view}"]`).click();await page.locator('.three-stage[data-state="ready"]').waitFor();const path=`docs/evidence/t20-${profile}-${view}.png`;await page.locator('.spatial-panel').screenshot({path});const state=await page.locator('.three-stage').evaluate(c=>({...c.dataset}));report.spatial.push({profile,view,path,readyMs:Date.now()-start,state});}
  await seed(page,'guardian');await page.goto('/#/practice');await page.locator('.canvas-stage-status[data-state="ready"]').waitFor({timeout:15000});
  const limbValues=[];
  for(const [id,joint,dx]of [['leftHand','leftShoulder',-25],['rightFoot','rightHip',25]]){const input=page.locator('#practice-'+joint),before=await input.inputValue(),grip=page.locator('[data-limb="'+id+'"]');await grip.scrollIntoViewIfNeeded();const box=await grip.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+box.width/2+dx,box.y+box.height/2-30,{steps:6});await page.mouse.up();const after=await input.inputValue();if(after===before)throw new Error('Capture drag did not move '+id);limbValues.push({id,before,after});}
  const controlsPath=`docs/evidence/t19-${profile}-controls.png`;await page.locator('.stage-figure').screenshot({path:controlsPath});report.screens.push({profile,path:controlsPath,sha256:sha(readFileSync(controlsPath)),limbValues});
  await seed(page,'call-split');await page.goto('/#/story');await page.locator('#story-runtime[data-state="paused"]').waitFor({timeout:15000});await page.locator('#story-play').click();await page.locator('#story-rod-rightShoulder').evaluate(input=>{input.value='1.1';input.dispatchEvent(new Event('input',{bubbles:true}));});await page.locator('#story-pause').click();const path=`docs/evidence/t19-${profile}-axe.png`;await page.locator('.stage-figure').screenshot({path});report.screens.push({profile,path,sha256:sha(readFileSync(path))});
  if(errors.length)throw new Error(errors.join('\n'));await context.close();
 }
}finally{await browser?.close();await server?.close();writeFileSync('docs/evidence/t19-visual-check.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({screens:report.screens.length,spatial:report.spatial.length,maxDrawCalls:Math.max(...report.spatial.map(s=>Number(s.state.drawCalls))),output:'docs/evidence/t19-visual-check.json'}));
if(report.screens.some(s=>s.overflow)||report.spatial.some(s=>Number(s.state.drawCalls)>80))process.exitCode=1;
