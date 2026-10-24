// Controlled film frames for visual review; never measures native duration or FPS.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {preview} from 'vite';
import {chromium} from 'playwright';
const definition=JSON.parse(readFileSync('src/content/stories/reunion-v4.json','utf8')),fixture=JSON.parse(readFileSync('tests/fixtures/project-v1.json','utf8'));
const report={kind:'v4-controlled-grip-review',indexSha256:createHash('sha256').update(readFileSync('dist/index.html')).digest('hex'),method:'Synthetic isolated checkpoint and controlled RAF; CSS animations disabled only for screenshots. Not user history, timing, FPS or human artistic approval.',screens:[],errors:[]};
let server,browser;
try{
  server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true,open:false}});browser=await chromium.launch();const baseURL='http://127.0.0.1:'+server.httpServer.address().port;
  const page=await browser.newPage({baseURL,viewport:{width:1440,height:1000}});page.on('pageerror',e=>report.errors.push(e.message));
  await page.addInitScript(()=>{let now=0,id=0;const callbacks=new Map();Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};window.cancelAnimationFrame=id=>callbacks.delete(id);Reflect.set(window,'__frameAdvance',async ms=>{while(ms>0){const d=Math.min(200,ms);ms-=d;now+=d;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(now));await Promise.resolve();}});});
  await page.goto('/study.html');const project=structuredClone(fixture);Object.assign(project.story,{definitionVersion:4,nodeId:'call-split',mode:'guided',ending:null,endingSource:null,assistedNodeIds:[]});
  await page.evaluate(async value=>{const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});await new Promise((resolve,reject)=>{const t=db.transaction('snapshots','readwrite');t.objectStore('snapshots').put(JSON.stringify(value),'draft');t.oncomplete=resolve;t.onabort=()=>reject(t.error);});db.close();},project);
  await page.goto('/#/story');await page.locator('.canvas-stage-status[data-state="ready"]').first().waitFor({timeout:15000});const advance=ms=>page.evaluate(ms=>Reflect.get(window,'__frameAdvance')(ms),ms);
  await page.locator('#story-play').click();await advance(definition.nodes.find(n=>n.id==='call-split').guidedTiming.targetMs);await page.locator('#story-assist').click();await advance(3600);await page.locator('#story-runtime[data-showcase="playing"]').waitFor();
  for(const [label,time]of [['axe-lift',2200],['axe-strike',4200],['axe-recover',6500]]){
    await page.locator('#showcase-again').click();if(await page.locator('#story-play').isEnabled())await page.locator('#story-play').click();await advance(time);await page.locator('#story-pause').click();const path='docs/evidence/t25-t28/'+label+'.png';await page.locator('.canvas-stage-screen').screenshot({path,animations:'disabled'});report.screens.push({path,showcaseMs:time});
  }
  await page.locator('.spatial-toggle').click();await page.locator('.three-stage[data-state="ready"]').waitFor({timeout:15000});await page.getByRole('button',{name:'人物近看',exact:true}).click();
  const path='docs/evidence/t25-t28/axe-3d-closeup.png';await page.locator('.spatial-mount').screenshot({path,animations:'disabled'});report.screens.push({path});
}catch(error){report.errors.push(String(error));}finally{await browser?.close();await server?.close();writeFileSync('docs/evidence/t25-t28/grip-visual.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));if(report.errors.length)process.exitCode=1;
