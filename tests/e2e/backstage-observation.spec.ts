import {test,expect} from './formal-fixture';
import type {Page} from '@playwright/test';
import fixture from '../fixtures/project.json' with {type:'json'};
import type {ProjectV1} from '../../src/domain/types';

test.use({reducedMotion:'reduce',launchOptions:{args:['--enable-unsafe-swiftshader']}});
async function seed(page:Page){
  await page.addInitScript(()=>{
    let now=0,id=0;const frames=new Map<number,FrameRequestCallback>();
    Object.defineProperty(performance,'now',{value:()=>now});
    window.requestAnimationFrame=cb=>{frames.set(++id,cb);return id;};window.cancelAnimationFrame=id=>{frames.delete(id);};
    Reflect.set(window,'__t45Frames',()=>frames.size);
    Reflect.set(window,'__t45Tick',(delta:number)=>{now+=delta;const batch=[...frames.values()];frames.clear();batch.forEach(cb=>cb(now));});
  });
  const project=structuredClone(fixture) as ProjectV1;project.story={storyId:'reunion',definitionVersion:5,runId:'backstage-run',revision:0,mode:'guided',nodeId:'intro',approach:null,approachSource:null,castSnapshot:null,assistedNodeIds:[],presetAppearanceUsed:false,completedAt:null,ending:null,endingSource:null,choices:{journeyIntent:null,mountainPact:null,finalAction:null}};
  await page.goto('/study.html');await page.evaluate(async value=>{
    const db=await new Promise<IDBDatabase>((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onupgradeneeded=()=>q.result.createObjectStore('snapshots');q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});
    await new Promise<void>((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});db.close();
  },project);
  await page.goto('/#/story');await expect(page.locator('.canvas-stage-status').first()).toHaveAttribute('data-state','ready',{timeout:20000});
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','playing');
}
async function stored(page:Page){return page.evaluate(async()=>{
  const db=await new Promise<IDBDatabase>((yes,no)=>{const q=indexedDB.open('yingzuo-v1',1);q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});
  const data=await new Promise<unknown>((yes,no)=>{const q=db.transaction('snapshots').objectStore('snapshots').get('draft');q.onsuccess=()=>yes(q.result);q.onerror=()=>no(q.error);});db.close();return data;
});}

test('backstage pauses the same instant, preserves source geometry and requires explicit resume',async({page})=>{
  await seed(page);await page.evaluate(()=>Reflect.get(window,'__t45Tick')(100));
  const runtime=page.locator('#story-runtime'),elapsed=await runtime.getAttribute('data-elapsed'),snapshot=await stored(page);
  const source=page.locator('.story-stage-slot .shadow-stage').first();
  const dimensions=await source.evaluate((c:HTMLCanvasElement)=>[c.width,c.height,c.getBoundingClientRect().width,c.getBoundingClientRect().height]);
  await page.getByRole('button',{name:'看看幕后',exact:true}).click();
  await expect(runtime).toHaveAttribute('data-state','paused');await expect(page.locator('.spatial-primary-mount .three-stage')).toHaveAttribute('data-state','ready',{timeout:20000});
  await expect(page.locator('.spatial-primary-mount .three-stage')).toHaveAttribute('data-view','backstage');
  expect(await source.evaluate((c:HTMLCanvasElement)=>[c.width,c.height,c.getBoundingClientRect().width,c.getBoundingClientRect().height])).toEqual(dimensions);
  await expect(page.locator('#story-play')).toBeDisabled();
  await page.locator('.guide-complete').waitFor({state:'hidden',timeout:6000});
  await page.locator('.story-stage-slot').screenshot({path:test.info().outputPath('backstage-observation.png')});
  await page.locator('.spatial-more > summary').click();await page.locator('.spatial-primary button[data-view=front]').click();
  await expect(runtime).toHaveAttribute('data-elapsed',elapsed!);expect(await stored(page)).toBe(snapshot);
  await page.getByRole('button',{name:'回到幕前',exact:true}).click();await expect(page.locator('.spatial-primary-mount canvas')).toHaveCount(0);
  await expect(runtime).toHaveAttribute('data-state','paused');await expect(runtime).toHaveAttribute('data-elapsed',elapsed!);
  await page.getByRole('button',{name:'看看幕后',exact:true}).click();await expect(page.locator('.spatial-primary-mount .three-stage')).toHaveAttribute('data-view','backstage');
  await page.getByRole('button',{name:'回到幕前',exact:true}).click();
  await page.locator('#story-play').click();await expect(runtime).toHaveAttribute('data-state','playing');
  await page.screenshot({path:test.info().outputPath('backstage-return.png')});
});

test('closing a pending backstage import rejects its late completion',async({page})=>{
  let release!:()=>void,requested=false;const held=new Promise<void>(yes=>{release=yes;});
  await page.route('**/assets/renderer-*.js',async route=>{requested=true;await held;await route.continue();});
  await seed(page);await page.getByRole('button',{name:'看看幕后',exact:true}).click();await expect.poll(()=>requested).toBe(true);
  await page.getByRole('button',{name:'回到幕前',exact:true}).click();release();
  await expect(page.locator('.spatial-primary')).toHaveAttribute('data-state','closed');await expect(page.locator('.spatial-primary-mount canvas')).toHaveCount(0);
  await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','paused');
});

test('failed backstage import returns to the operable curtain and can be retried',async({page})=>{
  await page.route('**/assets/renderer-*.js',route=>route.abort());await seed(page);
  await page.getByRole('button',{name:'看看幕后',exact:true}).click();await expect(page.locator('.spatial-primary')).toHaveAttribute('data-state','error');
  await expect(page.locator('.story-stage-slot .stage-figure')).not.toHaveClass(/observing-backstage/);await expect(page.locator('#story-play')).toBeEnabled();
  await expect(page.getByRole('button',{name:'重试幕后观察'})).toBeEnabled();
});

test('without WebGL, the formal curtain stays usable and no Three module is requested',async({page})=>{
  const modules:string[]=[];page.on('request',r=>{if(/\/assets\/renderer-/.test(r.url()))modules.push(r.url());});
  await page.addInitScript(()=>{Object.defineProperty(window,'WebGL2RenderingContext',{value:undefined,configurable:true});});
  await seed(page);await expect(page.getByRole('button',{name:'看看幕后',exact:true})).toBeDisabled();
  await page.locator('#story-pause').click();await page.locator('#story-play').click();await expect(page.locator('#story-runtime')).toHaveAttribute('data-state','playing');expect(modules).toEqual([]);
});
