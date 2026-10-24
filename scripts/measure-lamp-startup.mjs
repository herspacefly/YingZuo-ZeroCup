// Isolated production measurement: native browser clocks, original assets, no cue shortcuts.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {preview} from 'vite';
import {chromium} from 'playwright';
const report={kind:'native-production-lamp-workshop-loading',clientReviewDate:'2026-10-24',machineUTC:new Date().toISOString(),indexSha256:createHash('sha256').update(readFileSync('dist/index.html')).digest('hex'),definition:'Fresh contexts, cache disabled, native timers. Navigation to ready default 3D lamp workshop plus two native frames. Local and CDP 5Mbps/150ms; no CPU throttle. Chromium viewports are not physical devices.',runs:[]};
let server,browser;
try{
  server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true,open:false}});browser=await chromium.launch();const baseURL='http://127.0.0.1:'+server.httpServer.address().port;
  for(const [profile,width,height]of [['desktop',1440,900],['narrow',390,844]])for(const slow of [false,true]){
    const context=await browser.newContext({baseURL,viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
    const row={profile,network:slow?'5Mbps-150ms':'local',errors:[],passed:false};report.runs.push(row);page.on('pageerror',e=>row.errors.push(e.message));
    try{
      await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:slow?150:0,downloadThroughput:slow?625000:-1,uploadThroughput:slow?625000:-1});
      const start=performance.now();await page.goto('/#/light');await page.locator('.lamp-spatial-host .three-stage[data-state="ready"]').waitFor({timeout:20000});
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));row.readyMs=performance.now()-start;
      row.render=await page.locator('.three-stage').evaluate(el=>({width:el.width,height:el.height,drawCalls:Number(el.getAttribute('data-draw-calls')),softwareBudget:el.getAttribute('data-software-budget')}));
      row.passed=row.readyMs<=15000&&!row.errors.length&&row.render.drawCalls<=80;
    }catch(error){row.error=String(error);}finally{console.log(JSON.stringify(row));await context.close();}
  }
}finally{await browser?.close();await server?.close();writeFileSync('docs/evidence/t25-t28/lamp-loading.json',JSON.stringify(report,null,2)+'\n');}
if(report.runs.length!==4||report.runs.some(row=>!row.passed))process.exitCode=1;
