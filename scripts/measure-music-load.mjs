// Explicit product gestures to native playback readiness. No media or clock stubs.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {preview} from 'vite';
import {chromium,devices} from 'playwright';
import {loadingPolicy} from './art/loading-policy.mjs';
const args=process.argv.slice(2),option=(name,fallback)=>args.includes(name)?args[args.indexOf(name)+1]:fallback;
const samples=Number(option('--samples','1')),forcePNG=args.includes('--force-png');
if(!Number.isInteger(samples)||samples<1||samples>5)throw new Error('--samples must be 1..5');
const output=path.resolve(option('--output','docs/evidence/t10-music-readiness.json'));
if(!output.startsWith(path.resolve('docs/evidence')+path.sep))throw new Error('Output must stay in docs/evidence');
const sha=x=>createHash('sha256').update(x).digest('hex'),fixture=JSON.parse(readFileSync('tests/fixtures/project-v1.json','utf8'));
const profiles=[{id:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},{id:'simulated-mobile',use:{...devices['Pixel 7'],viewport:{width:390,height:844}}}];
const networks=[{id:'local',conditions:{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1}},{id:'5Mbps-150ms',conditions:{offline:false,latency:150,downloadThroughput:625000,uploadThroughput:625000}}];
const report={kind:'native-product-music-readiness',recordedAtMachineUTC:new Date().toISOString(),loadingPolicy,forcePNG,samplesPerCondition:samples,indexSha256:sha(readFileSync('dist/index.html')),probeSha256:sha(readFileSync(new URL(import.meta.url))),musicManifestSha256:sha(readFileSync('src/content/music.json')),host:{platform:os.platform(),release:os.release(),cpu:os.cpus()[0]?.model,node:process.version},definitions:{start:'Capture-phase timestamp of actual music-toggle click on home, or actual story-play click at an already prepared paused curtain after music preference enabled.',ready:'Native expected media !paused, readyState>=2, currentTime>0.05. No Audio/clock replacement; constructor subclass only observes real media. Buffered ranges and duration recorded. Not whole-file download completion or speaker hearing.',network:'Fresh context, Service Workers blocked, CDP cache disabled, no CPU throttle; 5Mbps/150ms CDP conditions.',limits:'This host/Chromium emulation, not physical phones/IE/Safari. Visual stage readiness before curtain play is reported separately; these samples are not full story duration.'},results:[]};
let server,browser;
try{
  server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true}});const origin='http://127.0.0.1:'+server.httpServer.address().port;
  browser=await chromium.launch();report.browserVersion=browser.version();
  for(const profile of profiles)for(const network of networks)for(const track of ['instrumental','curtain'])for(let sample=1;sample<=samples;sample++){
    const context=await browser.newContext({...profile.use,serviceWorkers:'block'}),page=await context.newPage(),errors=[],failed=[],external=[],mediaResponses=[];
    const row={profile:profile.id,network:network.id,track,sample,viewport:profile.use.viewport};
    try{
      if(forcePNG)await page.addInitScript(()=>Object.defineProperty(window,'createImageBitmap',{value:undefined}));
      await page.addInitScript(track=>{
        const Native=Audio,players=[];class ObservedAudio extends Native{constructor(src){super(src);players.push(this);}}
        Object.defineProperty(window,'Audio',{value:ObservedAudio});
        Reflect.set(window,'__musicLoad',{players,clickedAt:null,readyAt:null});
        document.addEventListener('click',event=>{if(event.target?.closest?.(track==='instrumental'?'#site-music-toggle':'#story-play'))Reflect.get(window,'__musicLoad').clickedAt=performance.now();},true);
      },track);
      if(track==='curtain'){
        await page.goto(origin+'/study.html');const project=structuredClone(fixture);Object.assign(project.story,{nodeId:'curtain',approach:'call-first',approachSource:'user',completedAt:'2026-10-20T00:00:00.000Z'});
        await page.evaluate(async value=>{const db=await new Promise((yes,no)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});try{await new Promise((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=yes;tx.onabort=()=>no(tx.error);});}finally{db.close();}},project);
      }
      const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',network.conditions);
      page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url().replace(origin,''),error:r.failure()?.errorText}));
      page.on('request',r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).origin!==origin)external.push(r.url());});
      page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/audio/'))mediaResponses.push({path:new URL(r.url()).pathname,status:r.status(),contentLength:r.headers()['content-length'],contentRange:r.headers()['content-range']??null});});
      await page.goto(origin+(track==='instrumental'?'/':'/#/story'),{waitUntil:'domcontentloaded'});
      await page.waitForFunction(track=>document.querySelector('#save-state')?.getAttribute('data-state')==='saved'&&(track==='instrumental'?!!document.querySelector('.opening-actions button:not([disabled])'):document.querySelector('#story-runtime')?.getAttribute('data-node')==='curtain'&&document.querySelector('.canvas-stage-status')?.getAttribute('data-state')==='ready'&&!document.querySelector('#story-play')?.disabled),track,{timeout:30000});
      row.pageReadyMs=await page.evaluate(()=>performance.now());
      if(await page.evaluate(()=>Reflect.get(window,'__musicLoad').players.length)!==0)throw new Error('Music created before explicit enabling');
      await page.locator('#site-music-toggle').click();
      if(track==='curtain'){
        if(await page.evaluate(()=>Reflect.get(window,'__musicLoad').players.length)!==0)throw new Error('Paused music preference unexpectedly loaded audio');
        await page.locator('#story-play').click();
      }
      const filename=track==='instrumental'?'jinghu-instrumental.mp3':'jingju-curtain.mp3';
      await page.waitForFunction(filename=>{
        const state=Reflect.get(window,'__musicLoad'),media=state.players.find(m=>m.currentSrc.endsWith(filename)&&!m.paused&&m.readyState>=2&&m.currentTime>.05);
        if(!media||state.clickedAt===null)return false;if(state.readyAt===null)state.readyAt=performance.now();return true;
      },filename,{timeout:loadingPolicy.assetReadyTargetMs+5000,polling:20});
      const observed=await page.evaluate(filename=>{const state=Reflect.get(window,'__musicLoad'),m=state.players.find(m=>m.currentSrc.endsWith(filename)&&!m.paused);return {clickedAt:state.clickedAt,readyAt:state.readyAt,currentTime:m.currentTime,readyState:m.readyState,duration:Number.isFinite(m.duration)?m.duration:null,buffered:Array.from({length:m.buffered.length},(_,i)=>[m.buffered.start(i),m.buffered.end(i)]),mediaError:m.error?{code:m.error.code,message:m.error.message}:null};},filename);
      Object.assign(row,observed,{readyFromClickMs:observed.readyAt-observed.clickedAt,withinTarget:observed.readyAt-observed.clickedAt<=loadingPolicy.assetReadyTargetMs,errors:[...errors],failedRequests:[...failed],externalRequests:[...external],mediaResponses:[...mediaResponses]});
      if(errors.length||failed.length||external.length||!mediaResponses.some(r=>r.path.endsWith(filename)&&[200,206].includes(r.status)))throw new Error('Native media errors/requests did not agree');
      console.log(profile.id+'/'+network.id+'/'+track+': '+row.readyFromClickMs.toFixed(1)+'ms');
    }catch(error){Object.assign(row,{error:error.stack??String(error),errors:[...errors],failedRequests:[...failed],externalRequests:[...external]});}
    finally{report.results.push(row);await context.close();}
  }
}finally{await browser?.close();if(server)await new Promise(resolve=>server.httpServer.close(resolve));writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
if(report.results.length!==8*samples||report.results.some(r=>r.error||!r.withinTarget))process.exitCode=1;
console.log(JSON.stringify({output,successful:report.results.filter(r=>!r.error&&r.withinTarget).length,total:report.results.length,maxMs:Math.max(...report.results.map(r=>r.readyFromClickMs??0))}));
