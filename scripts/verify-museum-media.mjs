import path from 'node:path';
import { readFileSync, realpathSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { validateMuseumMedia } from '../src/content/museum-media.ts';

const root = new URL('../', import.meta.url), document = JSON.parse(readFileSync(new URL('src/content/museum-media.json', root), 'utf8'));
const errors = validateMuseumMedia(document), files = [];
function dimensions(bytes) {
  if (bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)];
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    for (let offset = 2; offset + 9 < bytes.length;) {
      if (bytes[offset] !== 0xff) throw new Error('malformed JPEG marker');
      const marker = bytes[offset + 1]; offset += 2;
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      const length = bytes.readUInt16BE(offset);
      if (length < 2 || offset + length > bytes.length) throw new Error('malformed JPEG segment');
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return [bytes.readUInt16BE(offset + 5), bytes.readUInt16BE(offset + 3)];
      offset += length;
    }
  }
  throw new Error('unsupported image header');
}
const publicRoot = realpathSync(new URL('public/', root));
for (const media of document.media ?? []) {
  try {
    const file = fileURLToPath(new URL(`public${media.localPath}`, root)), resolved = realpathSync(file);
    if (!resolved.startsWith(`${publicRoot}/`) && !resolved.startsWith(`${publicRoot}\\`)) throw new Error('image escaped public folder');
    const bytes = readFileSync(file), [width, height] = dimensions(bytes);
    if (createHash('sha256').update(bytes).digest('hex') !== media.sha256) throw new Error('SHA-256 differs from collected original');
    if (bytes.length !== media.bytes || width !== media.width || height !== media.height) throw new Error('declared size/dimensions differ');
    files.push(file);
  } catch (error) { errors.push(`museum image ${media.id}: ${error.message}`); }
}
try {
  const folder=fileURLToPath(new URL('public/assets/museum/',root));
  const walk=directory=>readdirSync(directory,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?walk(path.join(directory,entry.name)):[path.join(directory,entry.name)]);
  const listed=new Set(files),actual=walk(folder);
  if(actual.some(file=>!listed.has(realpathSync(file)))||actual.length!==document.media.filter(row=>row.kind==='external').length)errors.push('museum directory contains an unlisted file or is missing an original');
} catch(error){errors.push('museum directory inventory failed: '+error.message);}
if (process.argv.includes('--decode') && !errors.length) {
  const decode = spawnSync('python', ['-c', 'import json,sys; from PIL import Image; files=json.load(sys.stdin); [(lambda im: im.load())(Image.open(p)) for p in files]; print("Pillow decoded",len(files),"images")'], { input: JSON.stringify(files), encoding: 'utf8' });
  if (decode.error || decode.status !== 0) errors.push(`museum image decoding failed: ${decode.error?.message ?? decode.stderr}`);
  else console.log(decode.stdout.trim());
}
if (errors.length) { console.error(errors.join('\n')); process.exitCode = 1; }
else {
  const external = document.media.filter(row => row.kind === 'external');
  console.log(`PASS: ${document.exhibits.length} exhibits, ${document.exhibits.reduce((total,row) => total + row.mediaIds.length,0)} image placements, ${external.length} distinct external originals; source/credit/unknown rights, local SHA-256, bytes and dimensions checked (${external.reduce((total,row) => total + row.bytes,0)} external bytes).${process.argv.includes('--decode') ? ' Full image decoding passed.' : ' Use --decode for full Pillow decoding.'}`);
}
