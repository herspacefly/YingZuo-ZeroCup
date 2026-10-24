// Native stills after visiting reveal targets and decoding the public photographs.
import {writeFileSync,readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {preview} from 'vite';
import {chromium} from 'playwright';
const report={kind:'native-v4-museum-stills',indexSha256:createHash('sha256').update(readFileSync('dist/index.html')).digest('hex'),method:'Fresh isolated contexts, native clocks. Scroll each reveal target into view before full-page capture; decode actual gallery images. Not user history, device performance or author approval.',screens:[],errors:[]};
let browser,server;
try{
  server=await preview({preview:{host:'127.0.0.1',port:0,strictPort:true,open:false}});browser=await chromium.launch();const baseURL='http://127.0.0.1:'+server.httpServer.address().port;
  for(const [profile,width,height]of [['desktop',1440,1000],['narrow',390,844]]){
    const context=await browser.newContext({baseURL,viewport:{width,height}}),page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
    for(const [label,url]of [['overview','/#/museum'],['reading','/#/museum/E07']]){
      await page.goto(url);await page.locator('.museum-catalogue').waitFor();
      for(const target of await page.locator('.motion-reveal').all()){
        await target.scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      }
      for(const image of await page.locator('.museum-hero-photo img,#museum-gallery img').all()){await image.scrollIntoViewIfNeeded();await image.evaluate(image=>image.decode());}
      await page.locator('.page-heading').scrollIntoViewIfNeeded();
      await page.waitForFunction(()=>[...document.querySelectorAll('.motion-reveal')].every(el=>!el.classList.contains('motion-awaiting')));
      const path=`docs/evidence/t25-t28/museum-native-${label}-${profile}.png`;await page.screenshot({path,fullPage:true,animations:'disabled'});report.screens.push({path,profile,url});
    }
    await context.close();
  }
}catch(error){report.errors.push(String(error));}finally{await browser?.close();await server?.close();writeFileSync('docs/evidence/t25-t28/museum-visual.json',JSON.stringify(report,null,2)+'\n');}
console.log(JSON.stringify(report));if(report.errors.length)process.exitCode=1;
