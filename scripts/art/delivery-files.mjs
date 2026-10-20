import { readFileSync, readdirSync, realpathSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { validateDeliveryManifest } from '../../src/content/asset-delivery.ts';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
/** Static integrity check; normal asset verification needs neither FFmpeg nor a browser. */
export function deliveryFiles(root, catalog, source) {
  const errors = validateDeliveryManifest(catalog, source), publicRoot = realpathSync(path.join(root,'public')) + path.sep;
  const records = [];
  for (const item of catalog.records ?? []) {
    try {
      if (!/^assets\/delivery\/[a-z0-9-]+\.webp$/.test(item.path)) throw new Error('unsafe path');
      const canonical = source.assets.find(asset => asset.id === item.id);
      if (!canonical) throw new Error('unknown canonical asset');
      const file = realpathSync(path.join(root,'public',item.path));
      if (!file.startsWith(publicRoot)) throw new Error('delivery symlink escapes public');
      const bytes = readFileSync(file), png = readFileSync(path.join(root,'public',canonical.path));
      if (sha(png) !== item.sourceSha256 || sha(bytes) !== item.sha256 || bytes.length !== item.bytes || bytes.length >= png.length) throw new Error('stale source/hash/size');
      if (bytes.toString('ascii',0,4) !== 'RIFF' || bytes.toString('ascii',8,12) !== 'WEBP' || bytes.readUInt32LE(4)+8 !== bytes.length) throw new Error('RIFF signature/length');
      let offset = 12, dimensions;
      while (offset+8 <= bytes.length) {
        const type = bytes.toString('ascii',offset,offset+4), size = bytes.readUInt32LE(offset+4);
        if (offset+8+size > bytes.length) throw new Error('truncated chunk');
        if(type === 'VP8 ') throw new Error('lossy WebP is not permitted');
        if(type === 'VP8L') {
          if(size < 5 || bytes[offset+8] !== 0x2f) throw new Error('VP8L signature');
          const bits=bytes.readUInt32LE(offset+9);
          if(bits>>>29) throw new Error('VP8L version');
          dimensions={width:(bits&0x3fff)+1,height:((bits>>>14)&0x3fff)+1};
        }
        offset+=8+size+(size&1);
      }
      if(offset !== bytes.length || dimensions?.width !== item.width || dimensions?.height !== item.height) throw new Error('lossless dimensions/chunks');
      records.push({item,bytes,png});
    } catch(error) {errors.push(`delivery ${item.id}: ${error.message}`);}
  }
  try {
    const listed = new Set(catalog.records.map(item=>path.basename(item.path)));
    const actual = readdirSync(path.join(root,'public/assets/delivery'),{withFileTypes:true});
    if(actual.length !== listed.size || actual.some(entry=>!entry.isFile() || !listed.has(entry.name))) errors.push('unlisted delivery files');
  } catch(error) {errors.push('delivery inventory: '+error.message);}
  return {errors,records};
}
