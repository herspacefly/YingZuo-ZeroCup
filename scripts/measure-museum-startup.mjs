// Native network/decode measurement of the optional museum media; isolated browser contexts.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { preview } from 'vite';
import { chromium } from 'playwright';
const sha = value => createHash('sha256').update(value).digest('hex');
const report = { kind:'native-production-museum-loading', clientReviewDate:'2026-10-24', machineUTC:new Date().toISOString(), indexSha256:sha(readFileSync('dist/index.html')), definition:'Fresh context, HTTP cache disabled, native timers. Home must request no external museum photos. Open E07, scroll its gallery into view, decode all photos in that exhibit. Times include navigation and image decode. Local server and Chromium emulation, not physical devices.', runs:[] };
let server, browser;
try {
  server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true,open:false}});browser=await chromium.launch();
  const baseURL='http://127.0.0.1:'+server.httpServer.address().port;
  for(const [profile,width,height]of [['desktop',1440,900],['narrow',390,844]]) for(const slow of [false,true]) {
    const context=await browser.newContext({baseURL,viewport:{width,height},serviceWorkers:'block'}),page=await context.newPage(),cdp=await context.newCDPSession(page);
    await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:slow?150:0,downloadThroughput:slow?625000:-1,uploadThroughput:slow?625000:-1});
    const row={profile,network:slow?'5Mbps-150ms':'local',requests:[],errors:[],passed:false};report.runs.push(row);
    page.on('request',r=>{if(r.url().includes('/assets/museum/'))row.requests.push(r.url().split('/').pop());});page.on('pageerror',e=>row.errors.push(e.message));
    await page.goto('/');await page.getByRole('button',{name:'从故事缘起开始',exact:true}).waitFor();row.homeMuseumRequests=[...row.requests];
    const started=performance.now();await page.goto('/#/museum/E07');await page.locator('#museum-gallery').waitFor();await page.locator('#museum-gallery').scrollIntoViewIfNeeded();
    // Scroll each real lazy image into view, retaining its production loading policy.
    for(const image of await page.locator('#museum-gallery img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(image=>image.decode());}
    row.galleryReadyMs=performance.now()-started;row.images=await page.locator('#museum-gallery img').evaluateAll(images=>images.map(image=>({path:new URL(image.src).pathname,width:image.naturalWidth,height:image.naturalHeight,loading:image.loading})));
    row.passed=row.homeMuseumRequests.length===0&&row.images.length>=2&&row.images.every((i,index)=>i.width>0&&i.loading===(index===0?'eager':'lazy'))&&row.galleryReadyMs<=15000&&!row.errors.length;
    console.log(JSON.stringify(row));await context.close();
  }
}finally{await browser?.close();await server?.close();writeFileSync(process.argv.includes('--output')?process.argv[process.argv.indexOf('--output')+1]:'docs/evidence/t25-t28/museum-loading.json',JSON.stringify(report,null,2)+'\n');}
if(report.runs.length!==4||report.runs.some(r=>!r.passed))process.exitCode=1;
