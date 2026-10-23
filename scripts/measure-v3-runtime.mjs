// Native production clock: real authored dialogue, assistance, and complete showcases, no timer overrides.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { preview } from 'vite';
import { chromium } from 'playwright';
const root=fileURLToPath(new URL('../',import.meta.url)),args=process.argv.slice(2);
const option=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback;
const selected=option('--mode','both');if(!['both','full','guided'].includes(selected))throw new Error('Expected --mode full/guided/both');
const out=path.resolve(root,option('--output','docs/evidence/t21-native-runtime.json'));
if(path.relative(root,out).startsWith('..')||path.isAbsolute(path.relative(root,out)))throw new Error('Output must remain in workspace');
const json=file=>JSON.parse(readFileSync(path.join(root,file),'utf8'));
const definition=json('src/content/stories/reunion-v3.json'),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const report={kind:'native-production-v3-duration',clientReviewDate:'2026-10-23',machineUTC:new Date().toISOString(),baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),indexSha256:sha(readFileSync(path.join(root,'dist/index.html'))),scriptSha256:sha(readFileSync(fileURLToPath(import.meta.url))),storySha256:sha(readFileSync(path.join(root,'src/content/stories/reunion-v3.json'))),concurrentLoad:option('--concurrent-load','none declared'),definition:'Wall time from first intro play to completed, 21-node call-first/home route. Craft confirmation is immediate. Every other node plays native authored duration; interaction uses explicit assistance, then complete 5–8 second showcase. No skip, fake clock, stored trajectory, or director sampling shortcut.',limitations:['Chromium on this host, automated choices/assistance and immediate page handling; human reading/action/choice dwell varies.','Preparation, startup and result reading are outside performance duration.','Any native clock pauses are recorded and explicitly resumed; pause time remains in wall duration.'],runs:[]};
let server;
function persist(){mkdirSync(path.dirname(out),{recursive:true});writeFileSync(out,JSON.stringify(report,null,2)+'\n');}
async function run(mode){
  const browser=await chromium.launch(),context=await browser.newContext({viewport:mode==='full'?{width:1440,height:900}:{width:390,height:844}}),page=await context.newPage();
  const result={mode,viewport:page.viewportSize(),browser:browser.version(),nodes:[],pauses:[],pageErrors:[],passed:false};report.runs.push(result);
  page.on('pageerror',e=>result.pageErrors.push(e.message));
  const base=`http://127.0.0.1:${server.httpServer.address().port}`;
  try{
    await page.goto(base+'/study.html');const project=json('tests/fixtures/project-v1.json'),s=project.story;
    Object.assign(s,{definitionVersion:3,nodeId:'intro',mode,approach:null,approachSource:null,ending:null,endingSource:null,castSnapshot:null,assistedNodeIds:[],completedAt:null});
    await page.evaluate(async value=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();},project);
    await page.goto(base+'/#/story');await page.locator('#story-runtime[data-state="paused"]').waitFor({timeout:20000});
    const started=performance.now();
    for(let i=0;i<22;i++){
      const runtime=page.locator('#story-runtime'),id=await runtime.getAttribute('data-node');if(id==='completed')break;
      const node=definition.nodes.find(n=>n.id===id),entry={id,startedWallMs:performance.now()-started,authoredTargetMs:(mode==='full'?node.fullTiming:node.guidedTiming).targetMs,showcaseObserved:false};result.nodes.push(entry);
      console.log(`${mode}: ${id} at ${(entry.startedWallMs/1000).toFixed(1)}s`);persist();
      if(id==='craft')await page.locator('#story-confirm-craft').click();else await page.locator('#story-play').click();
      let assisted=false,decided=false,finished=false;
      const deadline=performance.now()+entry.authoredTargetMs+90000;
      while(await runtime.getAttribute('data-node')===id){
        if(performance.now()>deadline)throw new Error('Native segment timed out: '+id);
        const saveState=await page.locator('#save-state').getAttribute('data-state');if(['error','conflict','unsupported'].includes(saveState))throw new Error('Unexpected storage state '+saveState);
        const phase=await runtime.getAttribute('data-state'),elapsed=Number(await runtime.getAttribute('data-elapsed'));
        if(node.kind==='interaction'&&id!=='craft'&&!assisted&&await page.locator('#story-assist').isEnabled()){assisted=true;await page.locator('#story-assist').click();}
        if(await runtime.getAttribute('data-showcase')==='playing')entry.showcaseObserved=true;
        if(node.kind==='choice'&&!decided){const button=page.locator(id==='ending-choice'?'#story-ending-home':'#story-call-first');if(await button.isEnabled()){decided=true;await button.click();}}
        if(node.completion.activation==='user'&&!finished&&await page.locator('#story-finish').isVisible()){finished=true;await page.locator('#story-finish').click();}
        if(await runtime.getAttribute('data-node')===id&&phase==='paused'&&id!=='craft'&&await page.locator('#story-play').isEnabled()){
          result.pauses.push({id,elapsedMs:elapsed,message:await runtime.textContent()});if(result.pauses.length>10)throw new Error('Too many native clock pauses');await page.locator('#story-play').click();
        }
        await page.waitForTimeout(400);
      }
      entry.finishedWallMs=performance.now()-started;persist();
      await page.locator('#story-runtime[data-state="paused"]').waitFor({timeout:20000});
    }
    result.wallMs=performance.now()-started;result.finalNode=await page.locator('#story-runtime').getAttribute('data-node');
    result.passed=result.finalNode==='completed'&&result.nodes.length===20&&!result.pageErrors.length&&result.nodes.filter(n=>definition.nodes.find(v=>v.id===n.id).kind==='interaction'&&n.id!=='craft').every(n=>n.showcaseObserved);
    console.log(`${mode}: ${result.passed?'PASS':'FAIL'} ${(result.wallMs/60000).toFixed(2)} minutes`);
  }catch(error){result.error=String(error);console.error(`${mode}: ${result.error}`);}finally{await browser.close();}
}
try{
  server=await preview({root,preview:{host:'127.0.0.1',port:0,strictPort:true,open:false}});
  // Native scheduling must not compete with another active performance on this host.
  for(const mode of selected==='both'?['full','guided']:[selected])await run(mode);
}finally{await server?.close();persist();}
if(!report.runs.length||report.runs.some(r=>!r.passed))process.exitCode=1;
