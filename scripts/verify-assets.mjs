import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const expected = ['docs/assets.csv', 'src/content/manifest.json'];
const missing = expected.filter(file => !existsSync(path.join(root, file)));
if (missing.length) {
  console.log(`NOT_READY: 资产清单尚未建立（${missing.join(', ')}）。T00 仅使用代码绘制的原创占位图形；未进行正式素材、许可或文化审定。`);
  // A distinct nonzero result prevents release checks from treating absence as approval.
  process.exitCode = 2;
} else {
  console.error('NOT_READY: TODO(T01) implement manifest/schema/path/hash checks once the actual asset contract exists; TODO(T10) add release review checks. No asset approval has been performed.');
  process.exitCode = 2;
}
