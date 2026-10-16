import { readFileSync, readdirSync } from 'node:fs';
import { parse } from 'acorn';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const files = readdirSync(path.join(root, 'assets')).filter(name => name.endsWith('.js') && name.includes('-legacy'));
if (!files.length) throw new Error('No legacy production chunks found; run npm run build.');
for (const file of files) {
  try { parse(readFileSync(path.join(root, 'assets', file), 'utf8'), { ecmaVersion: 5, sourceType: 'script' }); }
  catch (error) { throw new Error(`${file} is not ES5: ${error.message}`, { cause: error }); }
}
for (const page of ['index.html', 'probe.html', 'project.html']) {
  const html = readFileSync(path.join(root, page), 'utf8');
  if (!html.includes('type="module"') || !html.includes('nomodule') || !html.includes('vite-legacy-polyfill') || !html.includes('vite-legacy-entry')) {
    throw new Error(`${page} does not contain both modern and legacy bootstraps.`);
  }
}
console.log(`PASS: ${files.length} legacy chunks parse as ES5; all production pages contain modern and legacy entry points. IE runtime remains UNTESTED.`);
