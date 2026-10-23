// Focused native-frame correction for an early async image in the controlled visual capture.
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {preview} from 'vite';
import {chromium} from 'playwright';
const sha=x=>createHash('sha256').update(x).digest('hex');
const report={clientReviewDate:'2026-10-23',machineUTC:new Date().toISOString(),indexSha256:sha(readFileSync('dist/index.html')),definition:'Two static gallery screenshots, native browser timers, all images decoded and two native animation frames before capture. Original early controlled screenshots are retained.',screens:[],errors:[]};let server,browser;
try{
 server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true,open:false}});browser=await chromium.launch();
 for(const [profile,width,height]of [['desktop',1440,1000],['narrow',390,844]]){
  const context=await browser.newContext({viewport:{width,height}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.httpServer.address().port+'/#/museum/E07');await page.locator('#museum-gallery').scrollIntoViewIfNeeded();
  const images=await page.locator('#museum-gallery img').evaluateAll(async images=>{images.forEach(image=>image.loading='eager');await Promise.all(images.map(image=>image.decode()));return images.map(image=>({src:new URL(image.src).pathname,width:image.naturalWidth,height:image.naturalHeight}));});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const file='docs/evidence/t22-'+profile+'-museum-ready.png';await page.locator('#museum-gallery').screenshot({path:file,animations:'disabled'});report.screens.push({file,sha256:sha(readFileSync(file)),images});await context.close();
 }
}catch(error){report.errors.push(String(error));}finally{await browser?.close();await server?.close();writeFileSync('docs/evidence/t22-decoded-visual.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));if(report.errors.length||report.screens.length!==2)process.exitCode=1;
