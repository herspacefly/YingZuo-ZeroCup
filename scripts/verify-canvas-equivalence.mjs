// Actual prior production bundle versus candidate; no renderer copy or test hook.
import {readFileSync,writeFileSync,realpathSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {preview} from 'vite';
import {chromium,devices} from 'playwright';
const arg=process.argv.indexOf('--baseline-dist');if(arg<0)throw new Error('--baseline-dist is required');
const root=process.cwd(),baseline=realpathSync(process.argv[arg+1]);
if(!baseline.startsWith(realpathSync('.preflight')+path.sep))throw new Error('Baseline must be inside project .preflight');
const sha=x=>createHash('sha256').update(x).digest('hex'),fixture=JSON.parse(readFileSync('tests/fixtures/project-v1.json','utf8'));
const report={kind:'previous-bundle-versus-candidate-native-canvas-rgba-sha256',baselineIndexSha256:sha(readFileSync(path.join(baseline,'index.html'))),candidateIndexSha256:sha(readFileSync('dist/index.html')),probeSha256:sha(readFileSync(new URL(import.meta.url))),clock:'controlled story time, not a runtime/FPS/duration measurement',records:[],failures:[]};
if(report.baselineIndexSha256===report.candidateIndexSha256)throw new Error('Expected different actual builds');
let browser;const servers=[];
try{
  for(const outDir of [baseline,path.join(root,'dist')])servers.push(await preview({root,build:{outDir},preview:{host:'127.0.0.1',port:0,strictPort:true}}));
  const origins=servers.map(s=>'http://127.0.0.1:'+s.httpServer.address().port);
  browser=await chromium.launch();report.browserVersion=browser.version();
  for(const profile of [{id:'desktop',use:{...devices['Desktop Chrome'],viewport:{width:1440,height:900}}},{id:'simulated-mobile',use:{...devices['Pixel 7'],viewport:{width:390,height:844}}}]){
    const outputs=[];
    for(const origin of origins){
      const context=await browser.newContext({...profile.use,serviceWorkers:'block'}),page=await context.newPage(),records=[],errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(()=>{
        let now=0,id=0;const callbacks=new Map();
        Object.defineProperty(performance,'now',{value:()=>now});window.requestAnimationFrame=cb=>{callbacks.set(++id,cb);return id;};window.cancelAnimationFrame=id=>callbacks.delete(id);
        Reflect.set(window,'__pixelAdvance',async ms=>{while(ms>0){const delta=Math.min(ms,100);ms-=delta;now+=delta;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(cb=>cb(now));await Promise.resolve();}});
        let resizes=0;window.addEventListener('resize',()=>resizes++);Reflect.set(window,'__pixelResizes',()=>resizes);
      });
      async function ready(){
        try{await page.waitForFunction(()=>document.querySelector('.canvas-stage-status')?.getAttribute('data-state')==='ready',null,{timeout:15000,polling:20});}
        catch(error){report.lastPage=await page.evaluate(()=>({url:location.href,runtime:document.querySelector('#story-runtime')?.outerHTML,status:document.querySelector('.canvas-stage-status')?.outerHTML,body:document.body.innerText.slice(0,1200)}));throw error;}
      }
      async function seed(project,route){
        await page.goto(origin+'/study.html');
        await page.evaluate(async value=>{const db=await new Promise((yes,no)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
          try{await new Promise((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=yes;tx.onabort=()=>no(tx.error);});}finally{db.close();}},project);
        await page.goto(origin+route);await ready();
      }
      async function capture(label){
        await ready();const record=await page.locator('.shadow-stage').first().evaluate(async c=>({width:c.width,height:c.height,scene:c.getAttribute('data-scene'),rgbaSha256:Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',c.getContext('2d').getImageData(0,0,c.width,c.height).data))).map(x=>x.toString(16).padStart(2,'0')).join('')}));
        records.push({label,...record});
      }
      async function advance(ms){await page.evaluate(ms=>Reflect.get(window,'__pixelAdvance')(ms),ms);}
      async function range(id,value){await page.locator(id).evaluate((input,value)=>{input.value=String(value);input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));},value);}
      try{
        for(const nodeId of ['intro','memory-wave','guardian','call-light','split-axe','reunion-hold']){
          report.executing={profile:profile.id,origin:origin===origins[0]?'baseline':'candidate',nodeId};
          const project=structuredClone(fixture),early=['intro','memory-wave','guardian'].includes(nodeId);Object.assign(project.story,{nodeId,assistedNodeIds:[],revision:nodeId==='intro'?0:8,approach:early?null:nodeId==='split-axe'?'split-first':'call-first',approachSource:early?null:'user'});if(nodeId==='intro')project.story.castSnapshot=null;
          await seed(project,'/#/story');await capture(nodeId+'/entry');
          await page.locator(nodeId==='split-axe'?'#story-assist':'#story-play').click();
          const deltas=nodeId==='intro'?[100,1400,3000,4000,5000,3500]:nodeId==='split-axe'?[100,1900,1000,500,1200,1800]:nodeId==='reunion-hold'?[100,400,1500,1900]:[100,400,900,1000];
          let elapsed=0;for(const delta of deltas){await advance(delta);elapsed+=delta;if(await page.locator('#story-runtime').getAttribute('data-node')!==nodeId)throw new Error('Unexpected scene transition in pixel matrix: '+nodeId);await capture(nodeId+'/'+elapsed);}
          if(nodeId==='call-light')for(const lamp of [-.4,.4,.4]){await range('#story-lamp',lamp);await advance(1);await capture(nodeId+'/lamp-'+lamp+'/'+records.length);}
        }
        for(const scene of ['plain-v1','home-v1','road-v1','mountain-v1']){
          report.executing={profile:profile.id,origin:origin===origins[0]?'baseline':'candidate',scene};
          const project=structuredClone(fixture);project.story=null;project.stage.backgroundId=scene;
          await seed(project,'/#/light');await capture('light/'+scene+'/entry');
          for(const lamp of [-.4,.4]){await range('#light-lamp',lamp);await capture('light/'+scene+'/lamp-'+lamp);}
          await range('#light-distance',.3);await capture('light/'+scene+'/distance');
        }
        if(profile.id==='desktop')for(const viewport of [{width:1025,height:769},{width:1441,height:901},{width:1440,height:900}]){
          const previous=await page.evaluate(()=>Reflect.get(window,'__pixelResizes')());await page.setViewportSize(viewport);
          await page.waitForFunction(previous=>Reflect.get(window,'__pixelResizes')()>previous,previous,{polling:20,timeout:15000});
          await capture('resize/'+viewport.width+'x'+viewport.height);
        }
        // Exercise each carved motif under distinct clothing palettes in the real craft page.
        const craft=structuredClone(fixture);craft.story=null;craft.appearance.carvedSegments=[true,true,true];
        await seed(craft,'/#/craft');
        for(const pattern of ['cloud-v1','wave-v1','flower-v1'])for(const palette of ['vermilion-v1','woodland-v1']){
          await page.locator('#craft-pattern').selectOption(pattern);
          await page.locator('#craft-palette').selectOption(palette);
          await capture('craft/'+pattern+'/'+palette);
        }
        if(errors.length)throw new Error(errors.join('; '));outputs.push(records);
      }finally{await context.close();}
    }
    if(outputs[0].length!==outputs[1].length)throw new Error('Pixel matrix count differs');
    for(let i=0;i<outputs[0].length;i++){
      const before=outputs[0][i],after=outputs[1][i],equal=JSON.stringify(before)===JSON.stringify(after);const record={profile:profile.id,before,after,equal};report.records.push(record);if(!equal)report.failures.push(record);
    }
    console.log(profile.id+': '+outputs[0].length+' full-buffer RGBA comparisons');
  }
}catch(error){report.error=error.stack??String(error);throw error;}
finally{
  await browser?.close();for(const server of servers)await new Promise(resolve=>server.httpServer.close(resolve));
  writeFileSync('docs/evidence/t10-backdrop-pixel-proof.json',JSON.stringify(report,null,2)+'\n');
}
if(report.failures.length)throw new Error(report.failures.length+' baseline pixel comparisons differ');
console.log('PASS: '+report.records.length+' actual previous/candidate Canvas buffers have identical RGBA SHA-256.');
