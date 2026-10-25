// Author review stills from production. Native loading; ornament animations are
// held at their complete state only for screenshots, not used as timing proof.
import {preview} from 'vite';
import {chromium} from 'playwright';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const output='docs/evidence/t29-t32',rows=[];let server,browser;
try{
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});const origin='http://127.0.0.1:'+server.httpServer.address().port;browser=await chromium.launch();
 for(const width of [1920,1440,1024,390,320]){
  const context=await browser.newContext({viewport:{width,height:1000},reducedMotion:'reduce'}),page=await context.newPage();await page.addInitScript(()=>new MutationObserver(()=>document.querySelector('#guide-skip')?.click()).observe(document,{childList:true,subtree:true}));
  const routes=width===1024||width===320?['/','/craft','/light','/practice','/story','/museum/E07','/about']:['/','/practice'];
  for(const route of routes){await page.goto(origin+'/#'+route,{waitUntil:'load'});await page.waitForFunction(()=>document.querySelector('#save-state')?.getAttribute('data-state')==='saved');await page.evaluate(()=>document.fonts?.ready);if(await page.locator('.canvas-stage-status').count())await page.locator('.canvas-stage-status').first().waitFor({state:'attached'});
   if(route==='/light')await page.waitForFunction(()=>document.querySelector('.three-stage')?.getAttribute('data-state')==='ready'||document.querySelector('.lamp-shadow-host canvas')?.getAttribute('data-state')==='ready',null,{timeout:20000});
   if(route==='/practice'||route==='/craft')await page.waitForFunction(()=>document.querySelector('.canvas-stage-status')?.getAttribute('data-state')==='ready');
   if(route.startsWith('/museum')){for(const img of await page.locator('.museum-photo-card img').all()){await img.scrollIntoViewIfNeeded();await img.evaluate(img=>img.decode());}}
   await page.locator('.guide-complete').waitFor({state:'hidden',timeout:6000});const target=route==='/'?'.opening':route==='/practice'?'.practice-workspace':route==='/craft'||route==='/light'?'.workspace':'#app-view';const file=`view-${width}-${route==='/'?'home':route.replace(/\//g,'-').slice(1)}.png`;await page.locator(target).screenshot({path:output+'/'+file,animations:'disabled'});rows.push({width,route,file,noOverflow:await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)});
  }await context.close();
 }

 for(const [profile,width] of [['desktop-chromium',1440],['mobile-chromium',390]]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage();
  for(const ending of ['home','light','road','waiting','sacrifice']){
   await page.goto(origin+'/study.html');const project=JSON.parse(readFileSync('tests/fixtures/project-v1.json','utf8'));Object.assign(project.story,{definitionVersion:4,nodeId:'completed',mode:'guided',approach:'call-first',approachSource:'user',ending,endingSource:'user',assistedNodeIds:[],completedAt:'2026-10-25T01:00:00.000Z'});
   await page.evaluate(async value=>{const db=await new Promise((yes,no)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});await new Promise((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();},project);
   await page.goto(origin+'/#/result',{waitUntil:'load'});await page.waitForFunction(()=>document.querySelector('canvas.reunion-artifact')?.getAttribute('data-state')==='ready');const file=`ending-${ending}-${profile}.png`;await page.locator('.result-capture').screenshot({path:output+'/'+file,animations:'disabled'});rows.push({width,route:'/result',ending,fixture:'canonical completed v4; route behavior verified separately by skip-routes.spec',file});
  }await context.close();
 }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));writeFileSync(output+'/visual.json',JSON.stringify({kind:'native-production-static-review',indexSha256:createHash('sha256').update(readFileSync('dist/index.html')).digest('hex'),note:'Reduced motion gives complete static headings and ornaments; not native animation duration or physical device proof.',rows},null,2)+'\n');}
