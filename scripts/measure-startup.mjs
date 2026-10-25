// Real-clock production startup probe. Does not mark story completion or alter app clocks.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';
import { preview } from 'vite';
import { chromium, devices } from 'playwright';
import { loadingPolicy } from './art/loading-policy.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
function option(name, fallback) { const index = args.indexOf(name); return index === -1 ? fallback : args[index + 1]; }
const samples = Number(option('--samples', '3'));
const pattern = option('--pattern', 'fresh');
if(!['fresh','cloud-v1','wave-v1','flower-v1'].includes(pattern)) throw new Error('Unsupported --pattern');
const forcePNG = args.includes('--force-png');
if (!Number.isInteger(samples) || samples < 1 || samples > 10) throw new Error('--samples must be 1..10');
const output = path.resolve(root, option('--output', 'docs/evidence/startup-measurement.json'));
if (!output.startsWith(root)) throw new Error('Output must stay within the project');
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const indexBytes = readFileSync(path.join(root, 'dist/index.html'));
const originalTorsoPath = '/'+JSON.parse(readFileSync(path.join(root,'src/content/manifest.json'),'utf8')).assets.find(asset=>asset.id==='chenxiang-v1-torso-color').path;
const networks = [
  { id: 'local', targetHomeMs: 2000, cdp: { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 } },
  { id: '5Mbps-150ms', targetHomeMs: 5000, cdp: { offline: false, latency: 150, downloadThroughput: 625000, uploadThroughput: 625000 } },
];
const profiles = [
  { id: 'desktop', context: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  { id: 'simulated-mobile', context: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
];
const results = [];
let browser, server;
const report = {
  recordedAtMachineUTC: new Date().toISOString(), kind: 'real-clock-production-startup', pattern, forcePNG,
  baseCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  dirtyProductionFiles: execFileSync('git', ['diff', '--name-only', 'HEAD', '--', 'src', 'public', 'index.html', 'vite.config.ts'], { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean),
  deliveryManifestSha256: sha(readFileSync(path.join(root,'src/content/delivery.json'))), indexSha256: sha(indexBytes), probeSha256: sha(readFileSync(fileURLToPath(import.meta.url))),
  host: { platform: os.platform(), release: os.release(), architecture: os.arch(), cpu: os.cpus()[0]?.model, logicalCores: os.cpus().length, totalMemoryBytes: os.totalmem(), node: process.version },
  definitions: {
    homeReady: 'First enabled visible background-entry button, formal save state saved, then two native animation frames; measured from navigation time origin.',
    homePresentationReady: 'Home content enabled, document load (including CSS background image) complete, local fonts settled, 2.6s opening finished, no guide overlay, then two native animation frames; separate 15s asset/presentation target. No mocked clocks.',
    introReady: 'Explicit full-story confirmation button click on the unstarted story page to paused intro with ready Canvas, nonempty pixel buffer and enabled play control, then two native animation frames.',
    cold: 'Fresh browser context per sample; pattern=fresh has no project; explicit --pattern preloads only a fixture draft with story=null in IndexedDB via study.html before recording requests. HTTP cache disabled through CDP, Service Workers blocked, no pre-existing project for pattern=fresh. OS/server filesystem caches are not cleared.',
    network: 'CDP Network.emulateNetworkConditions; 5Mbps is 625000 bytes/s aggregated download and upload, latency 150ms request-to-response-header minimum. No CPU throttle.',
    imageFontBudget: 'Image/font HTTP response encoded body sizes, verified against matching ResourceTiming, HTTP Content-Length and the built artifact; Playwright response.body may be empty for consumed fetches and is never treated as zero transfer. Unique URLs requested from navigation through first intro ready. Includes resources loaded ahead for later shots within that intro. Inline SVG is part of HTML/JS, not a separate image transfer.',
  },
  loadingPolicy,
  limitations: ['This host and Chromium emulation are not physical phones/IE/Safari or a remote deployment.', 'Music/effects use product default-on behavior; this probe measures Canvas readiness, not audible readiness, WebGL, FPS or full performance duration.', 'Image/font bytes are historical diagnostics only; current author target is complete intro readiness within about 15 seconds, with original pixels retained.', 'The optional entry rehearsal is explicitly skipped by this measurement before observing the real paused intro; teaching/reading time is not an asset-download measurement.', 'The 2s/5s targets refer to home interaction and remain separate from the new explicit-opening resource target. Music readiness is measured independently.'],
};

try {
  server = await preview({ root, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('Preview did not bind a TCP address');
  const base = `http://127.0.0.1:${address.port}`;
  browser = await chromium.launch(); report.browserVersion = browser.version();
  for (const profile of profiles) for (const network of networks) for (let sample = 1; sample <= samples; sample++) {
    const context = await browser.newContext({ ...profile.context, serviceWorkers: 'block' });
    const page = await context.newPage(), errors = [], externalRequests = [], failedRequests = [], payloadResponses = [];
    if(forcePNG) await page.addInitScript(()=>{Object.defineProperty(window,'createImageBitmap',{value:undefined});});
    if(pattern !== 'fresh') {
      const project=JSON.parse(readFileSync(path.join(root,'tests/fixtures/project-v1.json'),'utf8'));project.story=null;project.appearance.patternId=pattern;
      await page.goto(base+'/study.html');
      await page.evaluate(async value=>{
        const db=await new Promise((yes,no)=>{const r=indexedDB.open('yingzuo-v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('snapshots');r.onsuccess=()=>yes(r.result);r.onerror=()=>no(r.error);});
        try{await new Promise((yes,no)=>{const tx=db.transaction('snapshots','readwrite');tx.objectStore('snapshots').put(JSON.stringify(value),'draft');tx.oncomplete=()=>yes();tx.onabort=()=>no(tx.error);});}finally{db.close();}
      },project);
    }
    const item = { profile: profile.id, viewport: profile.context.viewport, network: network.id, conditions: network.cdp, sample };
    try {
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== base) externalRequests.push(request.url()); });
      page.on('requestfailed', request => failedRequests.push({ url: request.url().replace(base, ''), error: request.failure()?.errorText }));
      page.on('response', response => {
        const mime = response.headers()['content-type'] ?? '';
        if (/^https?:/.test(response.url()) && (/^(image|font)\//.test(mime) || ['image', 'font'].includes(response.request().resourceType()))) payloadResponses.push(response);
      });
      const cdp = await context.newCDPSession(page); await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
      await cdp.send('Network.emulateNetworkConditions', network.cdp);
      await page.addInitScript(() => {
        performance.setResourceTimingBufferSize(2000);
        const measurement = { homeReadyMs: null, homePresentationReadyMs: null, startClickedAtMs: null, introReadyMs: null, homeResources: [] };
        Reflect.set(window, '__startupMeasurement', measurement);
        let homeQueued = false, introQueued = false, presentationQueued = false;
        const visibleEnabled = button => !!button && !button.disabled && !button.hidden && button.getBoundingClientRect().width > 0;
        function homeReady() { return document.querySelector('#app-view')?.getAttribute('data-route') === '/' && document.querySelector('#save-state')?.getAttribute('data-state') === 'saved' && visibleEnabled(document.querySelector('.opening-actions button')); }
        function introReady() {
          const runtime = document.querySelector('#story-runtime'), canvas = document.querySelector('.shadow-stage');
          return !document.documentElement.hasAttribute('data-guiding') && runtime?.getAttribute('data-node') === 'intro' && runtime.getAttribute('data-state') === 'paused' &&
            document.querySelector('.canvas-stage-status')?.getAttribute('data-state') === 'ready' &&
            document.querySelector('#save-state')?.getAttribute('data-state') === 'saved' && canvas?.width > 0 && canvas.height > 0 && visibleEnabled(document.querySelector('#story-play'));
        }
        function inspect() {
          document.querySelector('#guide-skip')?.click();
          if(!presentationQueued && homeReady() && document.readyState==='complete' && document.documentElement.getAttribute('data-intro')==='done' && (!document.fonts || document.fonts.status==='loaded')){presentationQueued=true;requestAnimationFrame(()=>requestAnimationFrame(()=>{measurement.homePresentationReadyMs=performance.now();}));}
          if (!homeQueued && homeReady()) {
            homeQueued = true;
            requestAnimationFrame(() => requestAnimationFrame(() => {
              if (homeReady()) { measurement.homeReadyMs = performance.now(); measurement.homeResources = performance.getEntriesByType('resource').map(entry => entry.toJSON()); }
              else homeQueued = false;
            }));
          }
          if (!introQueued && measurement.startClickedAtMs !== null && introReady()) {
            introQueued = true;
            requestAnimationFrame(() => requestAnimationFrame(() => { if (introReady()) measurement.introReadyMs = performance.now(); else introQueued = false; }));
          }
        }
        new MutationObserver(inspect).observe(document, { childList: true, subtree: true, attributes: true });
        document.addEventListener('click', event => { if (event.target?.closest?.('#story-start')) measurement.startClickedAtMs = performance.now(); }, true);
        document.addEventListener('DOMContentLoaded', inspect);window.addEventListener('load',inspect);document.fonts?.addEventListener('loadingdone',inspect);
      });
      await page.goto(base + '/#/', { waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => Reflect.get(window, '__startupMeasurement').homePresentationReadyMs !== null, null, { timeout: 45_000 });
      await page.evaluate(()=>{window.location.hash='#/story';});
      await page.getByRole('button', { name: '确认开始这一场', exact: true }).click();
      await page.waitForFunction(() => Reflect.get(window, '__startupMeasurement').introReadyMs !== null, null, { timeout: 45_000 });
      const observed = await page.evaluate(() => ({
        ...Reflect.get(window, '__startupMeasurement'),
        navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
        resources: performance.getEntriesByType('resource').map(entry => entry.toJSON()),
        story: { node: document.querySelector('#story-runtime')?.getAttribute('data-node'), state: document.querySelector('#story-runtime')?.getAttribute('data-state') },
        device: { userAgent: navigator.userAgent, dpr: devicePixelRatio, hardwareConcurrency: navigator.hardwareConcurrency, deviceMemory: Reflect.get(navigator, 'deviceMemory') },
      }));
      const unique = new Map();
      for (const response of payloadResponses) {
        const url = new URL(response.url()), key = url.origin + url.pathname;
        if (!response.ok()) throw new Error(`Asset HTTP ${response.status()}: ${url.pathname}`);
        const body = await response.body(), mime = response.headers()['content-type'] ?? '';
        const timing = observed.resources.find(item => item.name === response.url());
        const headerBytes = Number(response.headers()['content-length']);
        if (!timing || !Number.isInteger(headerBytes) || headerBytes <= 0 || timing.encodedBodySize !== headerBytes || timing.decodedBodySize !== headerBytes) throw new Error('Image/font transfer size lacks matching ResourceTiming and Content-Length: '+url.pathname);
        const artifactPath=path.resolve(root,'dist',decodeURIComponent(url.pathname).replace(/^\//,''));
        if(!artifactPath.startsWith(path.join(root,'dist')+path.sep)) throw new Error('Asset escapes dist');
        const artifact=readFileSync(artifactPath);
        if(artifact.length !== headerBytes || (body.length && (body.length !== headerBytes || sha(body)!==sha(artifact)))) throw new Error('Response and built artifact disagree: '+url.pathname);
        unique.set(key, { path: url.pathname, type: mime.startsWith('image/') ? 'image' : 'font', requestedAs: response.request().resourceType(), mime,
          bytes: timing.encodedBodySize, headerContentLength: headerBytes, decodedBodySize: timing.decodedBodySize,
          playwrightBodyBytes:body.length, bodySha256:body.length?sha(body):null, artifactSha256:sha(artifact),
          byteEvidence:'ResourceTiming encodedBodySize = decodedBodySize = HTTP Content-Length = built file bytes; Playwright body hash included only when nonempty' });
      }
      const imageFonts = [...unique.values()], imageFontBytes = imageFonts.reduce((sum, asset) => sum + asset.bytes, 0);
      if(!imageFontBytes) throw new Error('No real image/font transfer bytes recorded');
      // New v4 intentionally ignores legacy pattern fields and keeps the authored costume.
      const observedPattern=imageFonts.some(asset=>/\/(cloud|wave|flower)-v1-cut-\d\.(webp|png)$/.test(asset.path))?'legacy-overlay':null;
      const observedOriginalCostume=imageFonts.some(asset=>asset.path===originalTorsoPath||asset.path==='/assets/delivery/chenxiang-v1-torso-color.webp');
      const deliveryRequests=imageFonts.filter(asset=>asset.path.startsWith('/assets/delivery/')).length;
      if(observedPattern !== null || !observedOriginalCostume || (forcePNG && deliveryRequests)) throw new Error('Original costume/compatibility path not actually observed');
      Object.assign(item, observed, { introReadyFromClickMs: observed.introReadyMs - observed.startClickedAtMs,
        homePresentationWithinTarget: observed.homePresentationReadyMs <= loadingPolicy.assetReadyTargetMs, imageFonts, imageFontBytes, observedPattern, observedOriginalCostume, deliveryRequests, homeWithinTarget: observed.homeReadyMs <= network.targetHomeMs,
        homeTargetMs: network.targetHomeMs, introWithinTarget: observed.introReadyMs-observed.startClickedAtMs<=loadingPolicy.assetReadyTargetMs,
        imageFontWithinHistoricalReference: imageFontBytes <= loadingPolicy.historicalImageFontReferenceBytes,
        errors, externalRequests, failedRequests });
      if (errors.length || externalRequests.length || failedRequests.length) item.error = 'Page errors, external dependencies or failed requests observed';
      console.log(`${profile.id}/${network.id}/${sample}: home ${item.homeReadyMs.toFixed(1)}ms; intro after click ${item.introReadyFromClickMs.toFixed(1)}ms; images/fonts ${imageFontBytes} bytes`);
    } catch (error) { Object.assign(item, { error: error instanceof Error ? error.message : String(error), errors, externalRequests, failedRequests }); console.error(`${profile.id}/${network.id}/${sample}: ${item.error}`); }
    finally { results.push(item); await context.close(); }
  }
} finally {
  await browser?.close();
  if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}

const summary = [];
for (const profile of profiles) for (const network of networks) {
  const runs = results.filter(item => item.profile === profile.id && item.network === network.id);
  const home = runs.map(item => item.homeReadyMs).filter(Number.isFinite).sort((a, b) => a - b);
  const intro = runs.map(item => item.introReadyFromClickMs).filter(Number.isFinite).sort((a, b) => a - b);
  summary.push({ profile: profile.id, network: network.id, samples: runs.length, errors: runs.filter(item => item.error).length,
    homePresentationMaxMs: Math.max(0,...runs.map(item=>item.homePresentationReadyMs??0)), allHomePresentationWithinTarget: runs.length===samples&&runs.every(item=>item.homePresentationWithinTarget&&!item.error),
    homeTargetMs: network.targetHomeMs, homeMedianMs: home.length ? home[Math.floor(home.length / 2)] : null, homeMaxMs: home.length ? Math.max(...home) : null,
    introMedianFromClickMs: intro.length ? intro[Math.floor(intro.length / 2)] : null, introMaxFromClickMs: intro.length ? Math.max(...intro) : null,
    imageFontMaxBytes: Math.max(0, ...runs.map(item => item.imageFontBytes ?? 0)),
    allHomeWithinTarget: runs.length === samples && runs.every(item => item.homeWithinTarget && !item.error),
    assetReadyTargetMs: loadingPolicy.assetReadyTargetMs,
    allIntroWithinTarget: runs.length === samples && runs.every(item => item.introWithinTarget && !item.error),
    allImageFontWithinHistoricalReference: runs.length === samples && runs.every(item => item.imageFontWithinHistoricalReference && !item.error) });
}
Object.assign(report, { samplesPerCondition: samples, summary, results });
mkdirSync(path.dirname(output), { recursive: true }); writeFileSync(output, JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ output: path.relative(root, output), summary }, null, 2));
if (summary.some(item => !item.allHomeWithinTarget || !item.allIntroWithinTarget || !item.allHomePresentationWithinTarget)) process.exitCode = 1;
