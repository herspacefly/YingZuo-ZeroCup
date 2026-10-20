import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';
import { compareImagePixels } from './art/image-pixel-proof.mjs';
import { decodeRgbaPNG } from './art/png-lossless.ts';

const root = fileURLToPath(new URL('../', import.meta.url)), at = process.argv.indexOf('--base');
const requested = at === -1 ? 'HEAD' : process.argv[at + 1];
if (!requested || !/^[a-zA-Z0-9/_.~^-]+$/.test(requested) || requested.startsWith('-')) throw new Error('Invalid base ref');
const baseCommit = execFileSync('git', ['rev-parse', '--verify', requested + '^{commit}'], { cwd: root, encoding: 'utf8' }).trim();
const manifest = JSON.parse(readFileSync(path.join(root, 'src/content/manifest.json'), 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex'), rows = [], browser = await chromium.launch();
try {
  const page = await browser.newPage();
  for (const asset of manifest.assets) {
    if (!/^assets\/(puppets|masks|scenes)\/[a-zA-Z0-9/_-]+\.png$/.test(asset.path)) throw new Error('Unsafe canonical path');
    const before = execFileSync('git', ['show', baseCommit + ':public/' + asset.path], { cwd: root, maxBuffer: 20 * 1024 * 1024 });
    const after = readFileSync(path.join(root, 'public', asset.path));
    const a = decodeRgbaPNG(before), b = decodeRgbaPNG(after);
    if (a.width !== b.width || a.height !== b.height || !a.pixels.equals(b.pixels)) throw new Error('Raw PNG RGBA changed: ' + asset.id);
    const browserPixels = await compareImagePixels(page, 'data:image/png;base64,' + before.toString('base64'), 'data:image/png;base64,' + after.toString('base64'), asset.width, asset.height);
    if (browserPixels.differingBytes) throw new Error('Rendered PNG RGBA changed: ' + asset.id);
    rows.push({ id: asset.id, path: asset.path, beforeBytes: before.length, afterBytes: after.length, beforeSha256: sha(before), afterSha256: sha(after), rawRgbaSha256: sha(a.pixels), ...browserPixels });
  }
} finally { await browser.close(); }
const record = { baseCommit, kind: 'canonical-png-lossless-reencoding', browserVersion: browser.version(), beforeBytes: rows.reduce((n, r) => n + r.beforeBytes, 0), afterBytes: rows.reduce((n, r) => n + r.afterBytes, 0), records: rows };
writeFileSync(path.join(root, 'docs/evidence/png-reencode-pixel-proof.json'), JSON.stringify(record, null, 2) + '\n');
console.log(`PASS ${rows.length} canonical PNGs: raw and independently browser-rendered RGBA identical; ${record.beforeBytes} -> ${record.afterBytes} bytes.`);
