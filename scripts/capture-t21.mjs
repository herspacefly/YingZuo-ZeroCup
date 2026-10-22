// Current production visual evidence; synthetic saves and controlled frames, not native duration/FPS.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {preview} from 'vite';
import {chromium} from 'playwright';
const json=p=>JSON.parse(readFileSync(p,'utf8')),definition=json('src/content/stories/reunion-v3.json'),fixture=json('tests/fixtures/project-v1.json');
const sha=x=>createHash('sha256').update(x).digest('hex');
const report={clientReviewDate:'2026-10-22',machineUTC:new Date().toISOString(),kind:'current-production-v3-visual-capture',indexSha256:sha(readFileSync('dist/index.html')),clock:'Controlled RAF; CSS animations disabled only for screenshots. Isolated synthetic saves; no user project accessed. Not real-time or FPS evidence.',screens:[],errors:[]};
mkdirSync('docs/evidence',{recursive:true});let browser,server;
async function shot(page,selector,name){const file='docs/evidence/t21-'+name+'.png';await page.locator(selector).screenshot({path:file,animations:'disabled'});report.screens.push({file,sha256:sha(readFileSync(file)),viewport:page.viewportSize()});}
async function seed(page,id,ending=null){const p=structuredClone(fixture),s=p.story;Object.assign(s,{definitionVersion:3,nodeId:id,mode:'guided',ending,endingSource:ending?'user':null,assistedNodeIds:[],completedAt:id==='completed'?'2026-10-22T08:00:00.000Z':null});if(['memory-wave','road','guardian'].includes(id)){s.approach=null;s.approachSource=null;}
 await page.goto('/study.html');await page.evaluate(async value=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error);});db.close();},p);}
async function ready(page){await page.locator('#story-runtime[data-state="paused"]').waitFor({timeout:20000});await page.locator('.canvas-stage-status[data-state="ready"]').first().waitFor({timeout:20000});}
const advance=(page,ms)=>page.evaluate(ms=>Reflect.get(window,'__captureAdvance')(ms),ms);
try{
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true,open:false}});browser=await chromium.launch();const baseURL='http://127.0.0.1:'+server.httpServer.address().port;
 for(const [profile,width,height]of [['desktop',1440,1000],['narrow',390,844]]){
  const context=await browser.newContext({viewport:{width,height},baseURL}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{let now=0,id=0;const frames=new Map();Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};window.cancelAnimationFrame=id=>frames.delete(id);Reflect.set(window,'__captureAdvance',async ms=>{while(ms>0){const d=Math.min(ms,200);ms-=d;now+=d;const batch=[...frames.values()];frames.clear();batch.forEach(cb=>cb(now));await Promise.resolve();}});});
  await page.goto('/');await page.locator('#save-state[data-state="saved"]').waitFor();const primary=page.getByRole('button',{name:'从故事缘起开始',exact:true}),b=await primary.boundingBox();report.screens.push({kind:'home-primary-position',profile,button:b,insideInitialViewport:!!b&&b.y+b.height<=height});
  const home='docs/evidence/t21-'+profile+'-home.png';await page.screenshot({path:home,animations:'disabled'});report.screens.push({file:home,sha256:sha(readFileSync(home)),viewport:page.viewportSize()});
  if(profile==='desktop')await shot(page,'#story-background',profile+'-background');
  await page.emulateMedia({reducedMotion:'reduce'});const animation=await primary.evaluate(node=>getComputedStyle(node).animationName);if(animation!=='none')throw new Error('Reduced motion still animates the recommended button');report.screens.push({kind:'reduced-motion-guidance',profile,animation});await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/#/museum/E07');await page.locator('#museum-gallery').waitFor();await page.locator('#museum-gallery img').evaluateAll(images=>images.forEach(image=>image.loading='eager'));await page.waitForFunction(()=>[...document.querySelectorAll('#museum-gallery img')].every(image=>image.complete&&image.naturalWidth>0));await shot(page,'#museum-gallery',profile+'-museum');
  await page.locator('.museum-photo-enlarge').first().click();await page.getByRole('dialog').locator('img').evaluate(image=>image.decode());await shot(page,'.museum-lightbox-panel',profile+'-photo-detail');await page.getByRole('button',{name:'关闭大图 ×'}).click();
  for(const ending of ['home','light','road','waiting','sacrifice']){
   await seed(page,'completed',ending);await page.goto('/#/result');await page.locator('canvas.reunion-artifact[data-state="ready"]').waitFor({timeout:20000});
   if(profile==='desktop'){const file='docs/evidence/t21-ending-'+ending+'.png',data=await page.locator('canvas.reunion-artifact').evaluate(canvas=>canvas.toDataURL());writeFileSync(file,Buffer.from(data.split(',')[1],'base64'));report.screens.push({file,sha256:sha(readFileSync(file)),ending});}
   else if(ending==='waiting')await shot(page,'#app-view','narrow-result');
  }
  for(const id of profile==='desktop'?['memory-wave','road','guardian','call-light','call-split','reunion-reach']:['call-split','reunion-reach']){
   await seed(page,id,id==='reunion-reach'?'home':null);await page.goto('/#/story');await ready(page);const node=definition.nodes.find(n=>n.id===id);
   await page.locator('#story-play').click();await advance(page,node.guidedTiming.targetMs);await page.locator('#story-assist').click();await advance(page,3600);await page.locator('#showcase-again').click();await advance(page,id==='call-split'?2500:4000);await page.locator('#story-pause').click();
   await shot(page,'.canvas-stage-screen',profile+'-showcase-'+id);
   if(id==='call-split'){
    await page.locator('.spatial-toggle').click();await page.locator('.three-stage[data-state="ready"]').waitFor({timeout:20000});await page.getByRole('button',{name:'人物近看',exact:true}).click();await shot(page,'.spatial-mount',profile+'-axe-closeup');
   }
  }
  await page.goto('/#/practice');await page.locator('.canvas-stage-status[data-state="ready"]').waitFor({timeout:20000});
  const gripBoxes=await page.locator('.limb-handle').evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {id:node.getAttribute('data-limb'),x:r.x,y:r.y,width:r.width,height:r.height};}));
  report.screens.push({kind:'direct-grip-layout',profile,gripBoxes});await shot(page,'.canvas-stage-screen',profile+'-grips');
  await page.emulateMedia({reducedMotion:'reduce'});await page.addInitScript(()=>Object.defineProperty(window,'WebGL2RenderingContext',{value:undefined,configurable:true}));await seed(page,'ending-waiting-light','waiting');await page.goto('/#/story');await ready(page);if(!await page.locator('.spatial-toggle').isDisabled())throw new Error('No-WebGL fallback unexpectedly exposes 3D');await page.locator('#story-play').click();await advance(page,definition.nodes.find(n=>n.id==='ending-waiting-light').guidedTiming.targetMs);await page.locator('#story-assist').click();await advance(page,11500);await page.locator('#story-runtime[data-node="ending-waiting-hold"][data-state="paused"]').waitFor();report.screens.push({kind:'v3-reduced-motion-no-webgl',profile,nextNode:'ending-waiting-hold'});
  await context.close();console.log('Captured '+profile);
 }
}finally{await browser?.close();await server?.close();writeFileSync('docs/evidence/t21-visual-check.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify({screens:report.screens.filter(s=>s.file).length,errors:report.errors,report:'docs/evidence/t21-visual-check.json'}));if(report.errors.length||report.screens.some(s=>s.insideInitialViewport===false))process.exitCode=1;
