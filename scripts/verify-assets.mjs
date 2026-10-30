import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { validateAssetCatalog } from '../src/content/asset-contract.ts';
import { releaseProblems } from './review-gate.mjs';
import { startupAssetBudget } from './art/startup-budget.mjs';
import { deliveryFiles } from './art/delivery-files.mjs';
import { referencePuppets,referenceGeometry } from './art/reference-puppets.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const json = file => JSON.parse(readFileSync(path.join(root,file),'utf8'));
if (!existsSync(path.join(root,'src/content/manifest.json')) || !existsSync(path.join(root,'docs/assets.csv'))) {
  console.error('NOT_READY: T01 asset manifest or CSV absent.'); process.exit(2);
}
const catalog = {
  manifest: json('src/content/manifest.json'), palettes: json('src/content/palettes.json'), patterns: json('src/content/patterns.json'), scenes: json('src/content/scenes.json'),
  puppets: ['chenxiang-v1','mother-v1','guardian-v1'].map(id => json(`src/content/puppets/${id}.json`)),
};
const errors = validateAssetCatalog(catalog);
errors.push(...deliveryFiles(root,json('src/content/delivery.json'),catalog.manifest).errors);
// Preserve size diagnostics; the author now accepts full resources ready in about 15s.
// Integrity still fails below; actual readiness is measured separately.
startupAssetBudget(root);
const check = (ok, message) => { if (!ok) errors.push(message); };
const columns = ['id','type','path','creator','sourceUrl','license','credit','usage','reviewStatus','sha256'];
const rows = readFileSync(path.join(root,'docs/assets.csv'),'utf8').trimEnd().split(/\r?\n/);
check(rows.shift() === columns.join(','), 'CSV columns do not match contract');
const csvEntries = new Map();
for (const row of rows) {
  const cells = [...row.matchAll(/(?:^|,)"((?:[^"]|"")*)"(?=,|$)/g)].map(match => match[1].replaceAll('""','"'));
  check(cells.length === columns.length, 'Malformed CSV row');
  check(row === cells.map(value=>'"'+value.replaceAll('"','""')+'"').join(','), 'Noncanonical CSV row');
  check(!csvEntries.has(cells[0]), `Duplicate CSV id ${cells[0]}`); csvEntries.set(cells[0], cells);
}
check(csvEntries.size === catalog.manifest.assets.length, 'CSV/manifest count mismatch');

function decodePNG(bytes) {
  if (bytes.subarray(0,8).toString('hex') !== '89504e470d0a1a0a') throw new Error('PNG signature');
  let width, height, offset = 8; const chunks = []; let ended = false;
  while (offset+12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset), type = bytes.toString('ascii',offset+4,offset+8);
    if (offset+12+size > bytes.length) throw new Error('PNG truncated');
    if (type === 'IHDR') {
      width=bytes.readUInt32BE(offset+8);height=bytes.readUInt32BE(offset+12);
      if (size !== 13 || bytes[offset+16] !== 8 || bytes[offset+17] !== 6 || bytes[offset+18] !== 0 || bytes[offset+19] !== 0 || bytes[offset+20] !== 0) throw new Error('Expected noninterlaced RGBA8 PNG');
    }
    if (type === 'IDAT') chunks.push(bytes.subarray(offset+8,offset+8+size));
    if (type === 'IEND') { ended = true; break; }
    offset += 12+size;
  }
  if (!ended || !width || !height || width > 2048 || height > 2048) throw new Error('PNG header/end/dimensions');
  const stride=width*4, raw=inflateSync(Buffer.concat(chunks), { maxOutputLength: (stride+1)*height });
  if (raw.length !== (stride+1)*height) throw new Error('PNG scanline length');
  const pixels=Buffer.alloc(stride*height);
  const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};
  for(let y=0;y<height;y++) {
    const filter=raw[y*(stride+1)]; if(filter>4) throw new Error('PNG filter');
    for(let x=0;x<stride;x++) {
      const a=x>=4?pixels[y*stride+x-4]:0,b=y?pixels[(y-1)*stride+x]:0,c=y&&x>=4?pixels[(y-1)*stride+x-4]:0;
      pixels[y*stride+x]=(raw[y*(stride+1)+1+x]+([0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][filter]))&255;
    }
  }
  return {width,height,pixels};
}
const decoded = new Map(); const actualPaths = new Set();
const publicRoot = realpathSync(path.join(root,'public'))+path.sep;
for (const asset of catalog.manifest.assets) {
  const cells = csvEntries.get(asset.id);
  check(cells && columns.every((key,i) => cells[i] === String(asset[key])), `CSV differs from manifest: ${asset.id}`);
  if (!/^assets\/(puppets|masks|scenes)\/[a-zA-Z0-9/_-]+\.png$/.test(asset.path)) continue;
  try {
    const target=realpathSync(path.join(root,'public',asset.path));
    if (!target.startsWith(publicRoot)) throw new Error('asset symlink escapes public');
    const bytes=readFileSync(target); actualPaths.add(asset.path);
    check(createHash('sha256').update(bytes).digest('hex') === asset.sha256, `hash mismatch: ${asset.id}`);
    const image=decodePNG(bytes); decoded.set(asset.id,image);
    check(image.width === asset.width && image.height === asset.height, `PNG dimensions: ${asset.id}`);
    let visible=0, transparent=0, validCodes=true;
    const colorCodes = new Set(['255,0,0','0,255,0','0,0,255','255,255,0']);
    for(let i=0;i<image.pixels.length;i+=4) {
      const [r,g,b,a] = image.pixels.subarray(i,i+4);
      if(a) {
        visible++;
        if (asset.type === 'color-map' && !colorCodes.has(`${r},${g},${b}`)) validCodes=false;
        if (['alpha-mask','carving-mask'].includes(asset.type) && !(r === 255 && g === 255 && b === 255)) validCodes=false;
      } else transparent++;
    }
    check(validCodes, `PNG mask/region RGB encoding: ${asset.id}`);
    check(visible>0 && transparent>0, `PNG must have visible content and transparency: ${asset.id}`);
  } catch(error) { errors.push(`file ${asset.id}: ${error.message}`); }
}
for(const puppet of catalog.puppets) for(const part of puppet.parts) {
  const images=[part.maskAssetId,part.colorAssetId,part.colorMapAssetId].map(id=>decoded.get(id));
  if(images.every(Boolean) && images.every(image=>image.pixels.length === images[0].pixels.length)) {
    let match=true;
    for(let i=3;i<images[0].pixels.length;i+=4) if(images.some(image=>image.pixels[i] !== images[0].pixels[i])) { match=false;break; }
    check(match, `color/mask/region alpha differs: ${puppet.id}/${part.partId}`);
    if(catalog.manifest.provenance.kind==='original-ai-reference-cutout'){
      const counts=new Map(),regions=images[2].pixels;
      for(let i=0;i<regions.length;i+=4)if(regions[i+3]){const key=`${regions[i]},${regions[i+1]},${regions[i+2]}`;counts.set(key,(counts.get(key)??0)+1);}
      const editable=[...counts.keys()].filter(code=>code!=='255,255,0');
      if(part.partId==='head')check(editable.length===0,`face and head edges must retain source colors: ${puppet.id}`);
      else if(/UpperArm|Forearm/.test(part.partId)){
        check(editable.every(code=>code==='0,255,0'),`arm cloth must use sleeve slot: ${puppet.id}/${part.partId}`);
        if(puppet.control==='user')check((counts.get('0,255,0')??0)>=32,`sleeve control has no cloth surface: ${puppet.id}/${part.partId}`);
      }else if(part.partId==='torso')check(!counts.has('0,255,0'),`torso cannot use sleeve slot: ${puppet.id}`);
      else check(editable.every(code=>code==='0,0,255'),`leg costume must use hem slot: ${puppet.id}/${part.partId}`);
    }
  }
}
if(catalog.manifest.provenance.kind==='original-ai-reference-cutout'){
  const samples=[['chenxiang-v1',334,200,false],['mother-v1',778,197,false],['guardian-v1',1324,183,false],['mother-v1',776,210,true],['guardian-v1',1318,186,true]];
  for(const [role,x,y,keep]of samples){
    const head=catalog.puppets.find(p=>p.id===role).parts.find(p=>p.partId==='head'),image=decoded.get(head.maskAssetId),spec=referencePuppets[role].pieces.head,g=referenceGeometry(spec);
    const factor=(head.bounds.maxX-head.bounds.minX)/(g.bounds.maxX-g.bounds.minX);
    const lx=g.s*((x-spec.a[0])*g.uy-(y-spec.a[1])*g.ux)*factor,ly=-g.s*((x-spec.a[0])*g.ux+(y-spec.a[1])*g.uy)*factor;
    const px=Math.floor((lx-head.bounds.minX)/(head.bounds.maxX-head.bounds.minX)*image.width),py=Math.floor((head.bounds.maxY-ly)/(head.bounds.maxY-head.bounds.minY)*image.height),alpha=image.pixels[(py*image.width+px)*4+3];
    check(keep?alpha>100:alpha<10,`neck paper/collar preservation ${role} source(${x},${y}) alpha=${alpha}`);
  }
}
const walk=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);
// Exhibit reference photographs have their own media manifest and verifier.
const museumRoot=path.join(root,'public/assets/museum')+path.sep;
const presentation=json('public/assets/presentation/manifest.json');const presentationPaths=new Set();
for(const asset of presentation.assets){const file=path.join(root,'public',asset.path),bytes=readFileSync(file);check(asset.path.startsWith('assets/presentation/')&&!asset.path.includes('..'),'Presentation path');check(bytes.length===asset.bytes&&createHash('sha256').update(bytes).digest('hex')===asset.sha256,'Presentation integrity '+asset.path);presentationPaths.add(file);if(asset.path.endsWith('.png'))check(bytes.readUInt32BE(16)===asset.width&&bytes.readUInt32BE(20)===asset.height,'Presentation dimensions');}
const kai=json('public/assets/typography/manifest.json');
check(kai.family==='Yingzuo Kai'&&kai.license==='OFL-1.1'&&kai.missingCharacters===''&&kai.characters.length>1000,'Regular Kai font metadata/coverage');
const kaiCharacters=new Set(kai.characters),kaiMissing=new Set();
for(const file of [...walk(path.join(root,'src')).filter(file=>/\.(ts|json|html)$/.test(file)),...readdirSync(root).filter(file=>file.endsWith('.html')).map(file=>path.join(root,file))]){
  for(const character of readFileSync(file,'utf8'))if(character.codePointAt(0)>=128&&!kaiCharacters.has(character))kaiMissing.add(character);
}
check(kaiMissing.size===0,'Regular Kai subset missing source characters: '+[...kaiMissing].join(''));
for(const asset of kai.assets){
  const safe=asset.path.startsWith('assets/typography/')&&!asset.path.includes('..');check(safe,'Kai path');if(!safe)continue;
  const bytes=readFileSync(path.join(root,'public',asset.path));check(bytes.length===asset.bytes&&createHash('sha256').update(bytes).digest('hex')===asset.sha256,'Kai integrity '+asset.path);
  if(asset.path.endsWith('.woff2'))check(bytes.toString('ascii',0,4)==='wOF2','Kai WOFF2 signature');
  if(asset.path.endsWith('.woff'))check(bytes.toString('ascii',0,4)==='wOFF','Kai WOFF signature');
}
const files=walk(path.join(root,'public/assets')).filter(file=>file.endsWith('.png')&&!file.startsWith(museumRoot)&&!presentationPaths.has(file));
check(files.length === actualPaths.size && files.every(file=>actualPaths.has(path.relative(path.join(root,'public'),file).split(path.sep).join('/'))), 'unlisted PNG files under public/assets');
const sources=json('src/content/sources.json');
check(sources.schemaVersion === 1 && sources.sources.map(s=>s.id).sort().join(',') === 'C1,C2,C3,C4,C5,C6,C7,C8,C9', 'source registry IDs/version');
for(const source of sources.sources) check(source.title && source.publisher && /^https?:\/\//.test(source.url) && source.checkedAt && ['readable','blocked'].includes(source.accessStatus) && ['page','official-search-index','unverified'].includes(source.verificationMethod) && source.verificationNote && source.usage === 'reference-only' && source.textLicense === 'unknown' && source.imageLicense === 'unknown' && source.audioLicense === 'unknown' && Array.isArray(source.supportedFacts) && Array.isArray(source.excludedClaims), `source metadata ${source.id}`);
if(errors.length) { console.error(errors.slice(0,40).join('\n')); console.error(`FAIL: ${errors.length} asset error(s).`);process.exitCode=1; }
else if(process.argv.includes('--release')) {
  const issues=releaseProblems('assets');
  for(const asset of catalog.manifest.assets)if(asset.reviewStatus!=='reviewed'||asset.license==='unknown')issues.push(`${asset.id}: asset review or license pending`);
  if(issues.length){console.error(`NOT_READY: ${issues.length} release review/rights items pending:\n${issues.slice(0,8).join('\n')}`);process.exitCode=2;}
  else console.log(`PASS: ${decoded.size} PNGs and their current author review/rights evidence agree.`);
} else console.log(`PASS: ${decoded.size} PNGs decoded; alpha/region maps, references, paths, CSV and SHA-256 agree; 7 reference records. DRAFT ONLY: no release/art/cultural/license approval.`);
