// Native clock, empty-cache direct museum entrance. No user browser or story data.
import {preview} from 'vite';
import {chromium} from 'playwright';
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const server=await preview({preview:{host:'127.0.0.1',port:4187,strictPort:true}});
let browser;const rows=[];
try{
 browser=await chromium.launch();
 for(const width of [1440,390])for(const slow of [false,true]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),cdp=await context.newCDPSession(page);
  await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:slow?150:0,downloadThroughput:slow?625000:-1,uploadThroughput:slow?625000:-1});
  await page.goto('http://127.0.0.1:4187/#/museum/E01',{waitUntil:'domcontentloaded'});
  await page.locator('.lamp-spatial-host .three-stage[data-state=ready]').waitFor({timeout:45000});
  await page.waitForFunction(()=>document.documentElement.getAttribute('data-intro')==='done'&&(!document.fonts||document.fonts.status==='loaded'));
  rows.push({width,network:slow?'5Mbps-150ms':'local',readyMs:await page.evaluate(()=>performance.now()),imageBytes:await page.evaluate(()=>performance.getEntriesByType('resource').filter(e=>/\.(png|webp|jpg|woff2?)(\?|$)/.test(e.name)).reduce((n,e)=>n+e.transferSize,0))});
  if(!slow)await page.screenshot({path:`docs/evidence/t35/site-positioning-${width}.png`,clip:{x:0,y:0,width,height:Math.ceil(await page.locator('.site-header').evaluate(el=>el.getBoundingClientRect().bottom))}});
  await context.close();
 }
}finally{await browser?.close();await new Promise(resolve=>server.httpServer.close(resolve));}
const report={recordedAt:new Date().toISOString(),sourceCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),indexSha256:sha(readFileSync('dist/index.html')),definition:'One native direct E01 navigation per condition, fresh temporary browser context and disabled cache; ready Three lamp scene plus fonts and opening. Software GPU, not physical-device FPS.',targetMs:15000,rows,allWithinTarget:rows.every(row=>row.readyMs<=15000)};
writeFileSync('docs/evidence/t35/loading.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));
