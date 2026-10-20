import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { decodeRgbaPNG, optimizePNG } from '../../scripts/art/png-lossless';

it.each(['public/assets/puppets/chenxiang-v1/head-color.png', 'public/assets/puppets/chenxiang-v1/torso-regions.png', 'public/assets/masks/cloud-v1-cut-1.png'])('lossless re-encoding preserves exact dimensions, RGBA and deterministic bytes: %s', file => {
  const before = readFileSync(file), original = decodeRgbaPNG(before), encoded = optimizePNG(before), decoded = decodeRgbaPNG(encoded);
  expect(decoded.width).toBe(original.width); expect(decoded.height).toBe(original.height);
  expect(decoded.pixels.equals(original.pixels)).toBe(true); expect(encoded.length).toBeLessThanOrEqual(before.length);
  expect(optimizePNG(encoded).equals(encoded)).toBe(true);
});
it('refuses damaged CRC, a truncated file and non-PNG input', () => {
  const source = readFileSync('public/assets/scenes/home-window.png'), broken = Buffer.from(source); broken[30] = broken[30]! ^ 1;
  expect(() => optimizePNG(broken)).toThrow('CRC'); expect(() => optimizePNG(source.subarray(0, source.length - 2))).toThrow();
  expect(() => optimizePNG(Buffer.from('<svg/>'))).toThrow('signature');
});
