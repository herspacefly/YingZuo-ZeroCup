// Erasable Node24 TypeScript. Re-encodes RGBA8 PNGs without changing any pixel or metadata.
import { deflateSync, inflateSync } from 'node:zlib';
import { Buffer } from 'node:buffer';

const signature = Buffer.from('89504e470d0a1a0a', 'hex');
const table = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});
function crc(bytes: Buffer): number {
  let result = 0xffffffff;
  for (const value of bytes) result = table[(result ^ value) & 255]! ^ (result >>> 8);
  return (result ^ 0xffffffff) >>> 0;
}
function paeth(a: number, b: number, c: number): number {
  const p = a + b - c, x = Math.abs(p - a), y = Math.abs(p - b), z = Math.abs(p - c);
  return x <= y && x <= z ? a : y <= z ? b : c;
}
function parse(bytes: Buffer) {
  if (!bytes.subarray(0, 8).equals(signature)) throw new Error('Invalid PNG signature');
  let offset = 8, width = 0, height = 0, ended = false;
  const chunks: { type: string; bytes: Buffer; data: Buffer }[] = [];
  while (offset + 12 <= bytes.length) {
    const size = bytes.readUInt32BE(offset), end = offset + size + 12;
    if (end > bytes.length) throw new Error('Truncated PNG chunk');
    const type = bytes.toString('ascii', offset + 4, offset + 8), data = bytes.subarray(offset + 8, end - 4);
    if (crc(bytes.subarray(offset + 4, end - 4)) !== bytes.readUInt32BE(end - 4)) throw new Error('Invalid PNG CRC');
    if (type === 'IHDR') {
      if (chunks.length || size !== 13 || data[8] !== 8 || data[9] !== 6 || data[10] !== 0 || data[11] !== 0 || data[12] !== 0) throw new Error('Only noninterlaced RGBA8 PNG is supported');
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
    }
    chunks.push({ type, data, bytes: bytes.subarray(offset, end) }); offset = end;
    if (type === 'IEND') { ended = true; break; }
  }
  if (!ended || offset !== bytes.length || !width || !height || width > 2048 || height > 2048 || !chunks.some(chunk => chunk.type === 'IDAT')) throw new Error('Invalid PNG structure/dimensions');
  const stride = width * 4, raw = inflateSync(Buffer.concat(chunks.filter(chunk => chunk.type === 'IDAT').map(chunk => chunk.data)), { maxOutputLength: (stride + 1) * height });
  if (raw.length !== (stride + 1) * height) throw new Error('Invalid PNG scanline length');
  const pixels = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (stride + 1)]!;
    if (filter > 4) throw new Error('Invalid PNG row filter');
    for (let x = 0; x < stride; x++) {
      const at = y * stride + x, a = x >= 4 ? pixels[at - 4]! : 0, b = y ? pixels[at - stride]! : 0, c = y && x >= 4 ? pixels[at - stride - 4]! : 0;
      const predicted = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : paeth(a, b, c);
      pixels[at] = (raw[y * (stride + 1) + x + 1]! + predicted) & 255;
    }
  }
  return { width, height, pixels, raw, chunks };
}
export function decodeRgbaPNG(bytes: Buffer) {
  const { width, height, pixels } = parse(bytes); return { width, height, pixels };
}
function idat(data: Buffer): Buffer {
  const body = Buffer.concat([Buffer.from('IDAT'), data]), chunk = Buffer.alloc(body.length + 8);
  chunk.writeUInt32BE(data.length, 0); body.copy(chunk, 4); chunk.writeUInt32BE(crc(body), body.length + 4); return chunk;
}
export function optimizePNG(bytes: Buffer): Buffer {
  const image = parse(bytes), stride = image.width * 4, adaptive = Buffer.alloc((stride + 1) * image.height);
  const row = Buffer.alloc(stride), bestRow = Buffer.alloc(stride);
  for (let y = 0; y < image.height; y++) {
    let bestScore = Infinity, bestFilter = 0;
    for (let filter = 0; filter < 5; filter++) {
      let score = 0;
      for (let x = 0; x < stride; x++) {
        const at = y * stride + x, a = x >= 4 ? image.pixels[at - 4]! : 0, b = y ? image.pixels[at - stride]! : 0, c = y && x >= 4 ? image.pixels[at - stride - 4]! : 0;
        const predicted = filter === 0 ? 0 : filter === 1 ? a : filter === 2 ? b : filter === 3 ? Math.floor((a + b) / 2) : paeth(a, b, c);
        const residual = (image.pixels[at]! - predicted) & 255; row[x] = residual;
        score += residual < 128 ? residual : 256 - residual;
      }
      if (score < bestScore) { bestScore = score; bestFilter = filter; row.copy(bestRow); }
    }
    adaptive[y * (stride + 1)] = bestFilter; bestRow.copy(adaptive, y * (stride + 1) + 1);
  }
  let best: Buffer = bytes;
  for (const filtered of [image.raw, adaptive]) {
    const compressed = idat(deflateSync(filtered, { level: 9 })), chunks: Buffer[] = [signature]; let inserted = false;
    for (const chunk of image.chunks) {
      if (chunk.type === 'IDAT') { if (!inserted) chunks.push(compressed); inserted = true; }
      else chunks.push(chunk.bytes);
    }
    const candidate = Buffer.concat(chunks); if (candidate.length < best.length) best = candidate;
  }
  const decoded = decodeRgbaPNG(best);
  if (decoded.width !== image.width || decoded.height !== image.height || !decoded.pixels.equals(image.pixels)) throw new Error('Lossless PNG verification failed');
  return best;
}
