// Static production entry inspection. Does not measure time, FPS or network use.
import {readFileSync,realpathSync,existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';

const dist=fileURLToPath(new URL('../dist/',import.meta.url)),index=path.join(dist,'index.html');
if(!existsSync(index))throw new Error('Build dist/index.html before inspecting its static entry budget.');
const html=readFileSync(index,'utf8'),urls=new Set();
for(const tag of html.match(/<(?:script|link)\b[^>]*>/g)??[]){
  const attributes=Object.fromEntries([...tag.matchAll(/([\w-]+)\s*=\s*["']([^"']*)["']/g)].map(m=>[m[1],m[2]]));
  if(tag.startsWith('<script')&&attributes.type==='module'&&attributes.src)urls.add(attributes.src);
  if(tag.startsWith('<link')&&attributes.rel==='modulepreload'&&attributes.href)urls.add(attributes.href);
}
if(!urls.size)throw new Error('No modern entry or explicit modulepreload links found.');
const resolvedRoot=realpathSync(dist),files=[];
for(const url of urls){
  if(/^(?:[a-z]+:|\/\/)/i.test(url)||url.includes('?')||url.includes('#'))throw new Error('Expected local build reference: '+url);
  const file=realpathSync(path.join(dist,decodeURIComponent(url).replace(/^\//,''))),relative=path.relative(resolvedRoot,file);
  if(relative.startsWith('..')||path.isAbsolute(relative)||!relative.endsWith('.js'))throw new Error('Build reference escapes dist or is not JS: '+url);
  const bytes=readFileSync(file);files.push({path:relative.replaceAll(path.sep,'/'),bytes:bytes.length,gzipBytes:gzipSync(bytes).length,sha256:createHash('sha256').update(bytes).digest('hex')});
}
const total=files.reduce((n,f)=>n+f.gzipBytes,0),budget=200*1024;
console.log(JSON.stringify({kind:'static-modern-entry',indexSha256:createHash('sha256').update(html).digest('hex'),files,gzipBytes:total,budgetBytes:budget,withinBudget:total<=budget,
  scope:'Only modern entry and explicit modulepreload JS in dist/index.html. Lazy chunks, images, fonts and CSS are excluded. This is not a cold-start, network, FPS, memory, IE or device acceptance result.'},null,2));
if(total>budget)process.exitCode=1;
