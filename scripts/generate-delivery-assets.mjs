// Lossless delivery copies; canonical PNGs remain the independent source/compatibility artifacts.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { compareImagePixels } from './art/image-pixel-proof.mjs';

const root = fileURLToPath(new URL('../', import.meta.url)), sha = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = JSON.parse(readFileSync(path.join(root, 'src/content/manifest.json'), 'utf8'));
const encoding = ['-pix_fmt', 'bgra', '-c:v', 'libwebp', '-lossless', '1', '-compression_level', '6', '-quality', '100', '-f', 'webp', 'pipe:1'];
const probeRgba = Buffer.from([135,42,218,131,12,231,65,91,219,81,27,191,255,0,0,0]);
const probeInput = ['-v','error','-f','rawvideo','-pixel_format','rgba','-video_size','2x2','-i','pipe:0','-frames:v','1'];
const probe = execFileSync('ffmpeg', [...probeInput, ...encoding], { input: probeRgba, maxBuffer: 1024 * 1024 });
const probePng = execFileSync('ffmpeg', [...probeInput, '-c:v','png','-f','image2pipe','pipe:1'], { input: probeRgba, maxBuffer: 1024 * 1024 });
const catalog = { schemaVersion: 1, assetVersion: 1, codec: 'webp-lossless',
  generator: 'scripts/generate-delivery-assets.mjs', ffmpeg: execFileSync('ffmpeg', ['-version'], { encoding: 'utf8' }).split('\n')[0].trim(),
  probe: { dataUrl: 'data:image/webp;base64,' + probe.toString('base64'), width: 2, height: 2, renderedRgba: [] }, records: [] };
const files = [], proof = [], browser = await chromium.launch();
try {
  const page = await browser.newPage();
  catalog.probe.renderedRgba = await page.evaluate(async url => {
    const image = new Image(); await new Promise((yes,no)=>{image.onload=yes;image.onerror=no;image.src=url;});
    const c=document.createElement('canvas');c.width=c.height=2;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
    return Array.from(ctx.getImageData(0,0,2,2).data);
  }, 'data:image/png;base64,'+probePng.toString('base64'));
  const probeProof = await compareImagePixels(page, 'data:image/png;base64,'+probePng.toString('base64'), catalog.probe.dataUrl, 2,2,'bitmap-none');
  if(probeProof.differingBytes) throw new Error('Capability probe does not preserve PNG RGBA');
  for (const asset of manifest.assets) {
    if (asset.type === 'alpha-mask') continue; // Verified duplicate alpha, retained as canonical PNG, not used by production composition.
    const source = readFileSync(path.join(root, 'public', asset.path));
    if (sha(source) !== asset.sha256) throw new Error('Canonical source changed: ' + asset.id);
    const bytes = execFileSync('ffmpeg', ['-v', 'error', '-i', path.join(root, 'public', asset.path), ...encoding], { maxBuffer: 20 * 1024 * 1024 });
    if (bytes.length >= source.length) continue;
    const pixels = await compareImagePixels(page, 'data:image/png;base64,' + source.toString('base64'), 'data:image/webp;base64,' + bytes.toString('base64'), asset.width, asset.height, 'bitmap-none-native-png');
    if (pixels.differingBytes) throw new Error(`Lossless delivery differs: ${asset.id}, ${pixels.differingBytes} bytes`);
    const record = { id: asset.id, path: `assets/delivery/${asset.id}.webp`, sourceSha256: asset.sha256, sha256: sha(bytes), width: asset.width, height: asset.height, bytes: bytes.length };
    catalog.records.push(record); files.push({ path: record.path, bytes }); proof.push({ ...record, ...pixels });
  }
} finally { await browser.close(); }
// Write only after every chosen derivative has passed independent rendered RGBA equality.
mkdirSync(path.join(root, 'public/assets/delivery'), { recursive: true });
for (const file of files) writeFileSync(path.join(root, 'public', file.path), file.bytes);
writeFileSync(path.join(root, 'src/content/delivery.json'), JSON.stringify(catalog, null, 2) + '\n');
writeFileSync(path.join(root, 'docs/evidence/delivery-pixel-proof.json'), JSON.stringify({ kind: 'browser-decoded-rgba-equality', browserVersion: browser.version(), codec: catalog.codec, ffmpeg: catalog.ffmpeg, records: proof }, null, 2) + '\n');
console.log(`Generated ${files.length} smaller lossless delivery files; all rendered RGBA bytes match their canonical PNG.`);
