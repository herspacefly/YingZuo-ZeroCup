// Native-clock desktop runtime probe. No application RAF/performance replacement.
import {preview} from 'vite';import {chromium} from 'playwright';import {readFileSync,writeFileSync} from 'node:fs';import {createHash} from 'node:crypto';import os from 'node:os';
const sha=x=>createHash('sha256').update(x).digest('hex'),windows=[],staticViews=[],failures=[];let server,browser,lightweightObservation;
try {
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});const origin='http://127.0.0.1:'+server.httpServer.address().port;
 browser=await chromium.launch();const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:'block'}),page=await context.newPage();
 await page.addInitScript(()=>{
  const contexts=new Map();
  const state=gl=>{if(!contexts.has(gl))contexts.set(gl,{calls:0,frames:[],at:0,view:null});return contexts.get(gl);};
  for(const method of ['drawArrays','drawElements','drawArraysInstanced','drawElementsInstanced']){
   const original=WebGL2RenderingContext.prototype[method];if(!original)continue;
   WebGL2RenderingContext.prototype[method]=function(...args){state(this).calls++;return original.apply(this,args);};
  }
  const clear=WebGL2RenderingContext.prototype.clear;
  WebGL2RenderingContext.prototype.clear=function(...args){const s=state(this);if(s.calls)s.frames.push({at:s.at,calls:s.calls,view:s.view});s.calls=0;s.at=performance.now();s.view=this.canvas.getAttribute('data-view');return clear.apply(this,args);};
  Reflect.set(window,'__nativeGLFrames',()=>[...contexts].flatMap(([gl,s])=>[...s.frames,...(s.calls?[{at:s.at,calls:s.calls,view:s.view}]:[])]));
 });
 page.on('pageerror',e=>failures.push(e.message));
 async function openNode(nodeId){await page.goto(origin+'/study.html');const project=JSON.parse(readFileSync('tests/fixtures/project-v1.json','utf8'));project.story.nodeId=nodeId;if(nodeId==='guardian')project.story.approach=project.story.approachSource=null;project.story.assistedNodeIds=[];
 await page.evaluate(async value=>{const db=await new Promise((yes,no)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});try{await new Promise((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=yes;tx.onabort=()=>no(tx.error);});}finally{db.close();}},project);
 await page.goto(origin+'/#/story');await page.locator('.canvas-stage-status').waitFor();await page.waitForFunction(()=>document.querySelector('.canvas-stage-status')?.getAttribute('data-state')==='ready');
 }
 await openNode('guardian');
 const cdp=await context.newCDPSession(page),frameId=(await cdp.send('Page.getFrameTree')).frameTree.frame.id;
 await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing',transferMode:'ReturnAsStream'});
 async function sample(name,duration,expectedView=null){
  const before=await page.evaluate(name=>{performance.mark('runtime-start-'+name);return {at:performance.now(),draws:Number(document.querySelector('.shadow-stage').getAttribute('data-draws')),state:document.querySelector('#story-runtime').getAttribute('data-state'),node:document.querySelector('#story-runtime').getAttribute('data-node'),elapsed:Number(document.querySelector('#story-runtime').getAttribute('data-elapsed')),spatial:document.querySelector('.spatial-stage')?.getAttribute('data-state'),view:document.querySelector('canvas.three-stage')?.getAttribute('data-view'),message:document.querySelector('#story-runtime').textContent,focused:document.hasFocus(),visibility:document.visibilityState};},name);
  await page.waitForTimeout(duration);
  const after=await page.evaluate(name=>{performance.mark('runtime-end-'+name);return {at:performance.now(),draws:Number(document.querySelector('.shadow-stage').getAttribute('data-draws')),state:document.querySelector('#story-runtime').getAttribute('data-state'),node:document.querySelector('#story-runtime').getAttribute('data-node'),elapsed:Number(document.querySelector('#story-runtime').getAttribute('data-elapsed')),spatial:document.querySelector('.spatial-stage')?.getAttribute('data-state'),view:document.querySelector('canvas.three-stage')?.getAttribute('data-view'),message:document.querySelector('#story-runtime').textContent,focused:document.hasFocus(),visibility:document.visibilityState};},name);
  windows.push({name,expectedView,nodeId:before.node,requestedMs:duration,before,after,canvasDrawsPerSecond:(after.draws-before.draws)/((after.at-before.at)/1000)});
  console.log(`${name}: actual Canvas draws/s ${windows.at(-1).canvasDrawsPerSecond.toFixed(2)}; ${JSON.stringify(after)}`);
 }
 const allGlFrames=[];let gpu;
 for(const nodeId of ['guardian']) {
 if(nodeId!=='guardian')await openNode(nodeId);
 await page.bringToFront();await page.locator('#story-play').click();await sample(nodeId+'/canvas-2d',10000);if(await page.locator('#story-runtime').getAttribute('data-state')==='playing')await page.locator('#story-pause').click();
 await page.locator('.spatial-toggle').first().click();await page.waitForFunction(()=>document.querySelector('.spatial-stage')?.getAttribute('data-state')==='ready');
 gpu=await page.locator('canvas.three-stage').evaluate(c=>{const gl=c.getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {vendor:gl.getParameter(gl.VENDOR),renderer:gl.getParameter(gl.RENDERER),unmaskedVendor:ext?gl.getParameter(ext.UNMASKED_VENDOR_WEBGL):null,unmaskedRenderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,width:c.width,height:c.height};});
 for(const view of ['front','workshop','backstage','exhibit']){
  await page.locator(`.spatial-stage button[data-view="${view}"]`).click();
  if(await page.locator('#story-runtime').getAttribute('data-state')==='paused')await page.locator('#story-play').click();
  await sample(nodeId+'/webgl-'+view,4000,view);
  if(await page.locator('#story-runtime').getAttribute('data-state')==='playing')await page.locator('#story-pause').click();
 }
 await page.locator('#story-reset').click();await page.waitForFunction(()=>document.querySelector('.canvas-stage-status')?.getAttribute('data-state')==='ready');
 await page.locator('.spatial-toggle').first().click();await page.waitForFunction(()=>document.querySelector('.spatial-stage')?.getAttribute('data-state')==='ready');
 await page.locator('.spatial-stage button[data-view="workshop"]').click();await page.locator('#story-play').click();await sample('guardian/webgl-sustained',12000,'workshop');
 if(await page.locator('.performance-lightweight').isVisible()) {
  lightweightObservation={measured:true,reason:'Native sustained low-rate suggestion appeared; user-facing button clicked.'};
  await page.locator('.performance-lightweight').click();await page.waitForFunction(()=>document.querySelector('.shadow-stage')?.getAttribute('data-quality')==='lightweight');
  await sample('guardian/lightweight-2d',8000);
 } else lightweightObservation={measured:false,reason:'No native sustained low-rate suggestion; lightweight sample is N/A, no clocks or private quality state forced.'};
 if(await page.locator('#story-runtime').getAttribute('data-state')==='playing')await page.locator('#story-pause').click();
 allGlFrames.push(...(await page.evaluate(()=>Reflect.get(window,'__nativeGLFrames')())).map(frame=>({...frame,nodeId})));
 }
 await openNode('call-light');
 await page.locator('.spatial-toggle').first().click();await page.waitForFunction(()=>document.querySelector('.spatial-stage')?.getAttribute('data-state')==='ready');
 for(const view of ['front','workshop','backstage','exhibit']) {
  await page.locator(`.spatial-stage button[data-view="${view}"]`).click();
  const calls=(await page.evaluate(()=>Reflect.get(window,'__nativeGLFrames')())).filter(frame=>frame.view===view).map(frame=>frame.calls);
  const current=await page.locator('canvas.three-stage').getAttribute('data-view');
  const record={nodeId:'call-light',view,actualView:current,observedRenders:calls.length,callsPerRenderMax:calls.length?Math.max(...calls):null,fps:null,reason:'paused highest-object frame: measure actual draw calls, not inactive animation callbacks'};
  staticViews.push(record);if(!calls.length||current!==view||record.callsPerRenderMax>80)failures.push('Static draw-call budget/observation: '+view);
 }
 const glFrames=allGlFrames;
 const complete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const {stream}=await complete;let trace='';
 while(true){const chunk=await cdp.send('IO.read',{handle:stream});trace+=chunk.base64Encoded?Buffer.from(chunk.data,'base64').toString('utf8'):chunk.data;if(chunk.eof)break;}await cdp.send('IO.close',{handle:stream});
 const events=JSON.parse(trace).traceEvents,animationEvents=events.filter(e=>e.name==='FireAnimationFrame'&&e.ph==='X'),frameKeys=[...new Set(animationEvents.map(e=>e.args?.data?.frame??null))];
 for(const window of windows){
  const start=events.find(e=>e.name==='runtime-start-'+window.name),end=events.find(e=>e.name==='runtime-end-'+window.name);
  if(!start||!end)throw new Error('Missing native timing markers');
  const frames=animationEvents.filter(e=>e.ts>=start.ts&&e.ts<=end.ts&&e.args?.data?.frame===frameId).map(e=>({atTraceUs:e.ts,durationUs:e.dur??0}));
  const deltas=frames.slice(1).map((f,i)=>(f.atTraceUs-frames[i].atTraceUs)/1000).sort((a,b)=>a-b);
  Object.assign(window,{nativeAnimationCallbacks:frames.length,nativeCallbackRateHz:frames.length/((end.ts-start.ts)/1e6),frameIntervalMedianMs:deltas[Math.floor(deltas.length/2)]??null,frameIntervalP95Ms:deltas[Math.floor(deltas.length*.95)]??null,maxFrameIntervalMs:Math.max(0,...deltas),frames});
  const calls=glFrames.filter(f=>f.nodeId===window.nodeId&&f.at>=window.before.at&&f.at<=window.after.at).map(f=>f.calls);const spatial=window.name.includes('/webgl-');window.webglCallsPerRenderMax=spatial&&calls.length?Math.max(...calls):null;window.observedWebglRenders=calls.length;
  window.reached60HzTarget=window.nativeCallbackRateHz>=59;window.withinDrawCallBudget=spatial?window.webglCallsPerRenderMax!==null&&window.webglCallsPerRenderMax<=80:null;
  if(spatial&&(!calls.length||window.before.spatial!=='ready'||window.after.spatial!=='ready'||window.before.view!==window.expectedView||window.after.view!==window.before.view))failures.push('WebGL rendering/view not observed: '+window.name);
  if(window.before.state!=='playing'||window.after.state!=='playing'||window.before.node!==window.nodeId||window.after.node!==window.nodeId||!frames.length||window.after.draws<=window.before.draws||window.after.elapsed<=window.before.elapsed||window.after.elapsed>=35000)failures.push('Incomplete valid playback window: '+window.name);
 }
 const result={kind:'native-clock-desktop-runtime-preflight',recordedAtMachineUTC:new Date().toISOString(),indexSha256:sha(readFileSync('dist/index.html')),probeSha256:sha(readFileSync(new URL(import.meta.url))),browserVersion:browser.version(),host:{cpu:os.cpus()[0]?.model,logicalCores:os.cpus().length,memoryBytes:os.totalmem(),platform:os.platform(),release:os.release()},viewport:{width:1440,height:900},gpu,frameId,observedTraceFrameKeys:frameKeys,windows,staticViews,lightweightObservation,failures,
  definitions:{frames:'Chrome native FireAnimationFrame callbacks belonging to the product main frame; no RAF or performance clock replacement. Counted over native performance marks. 59Hz threshold allows native 60Hz scheduling/window boundaries.',draws:'Actual WebGL2 drawArrays/drawElements including instanced methods, delimited by renderer auto-clear with start timestamp/view fixed before drawing; production uses one render pass. Probe wrappers count calls without altering clock.',limitations:'This host/headless Chromium/SwiftShader GPU only; Trace recording and API counters add overhead. Static call-light frames have draw-call records and FPS N/A.  not physical phones or representative user devices; native callback rate and Canvas draws are not display-panel presentation FPS. No full-story duration, long-term memory, hearing or external user acceptance.'}};
 writeFileSync('docs/evidence/runtime-desktop-preflight.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({gpu,summary:windows.map(({frames,...w})=>w),staticViews,failures},null,2));
 if(failures.length||windows.some(w=>!w.reached60HzTarget||w.withinDrawCallBudget===false))process.exitCode=1;
}catch(error){writeFileSync('docs/evidence/runtime-desktop-probe-failure.json',JSON.stringify({validPerformanceAcceptance:false,windows,error:error.stack??String(error)},null,2)+'\n');throw error;}finally{await browser?.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));}
