export const MAX_PROJECT_BYTES = 512 * 1024;
export const MAX_TITLE_CODEPOINTS = 24;
export const JOINT_IDS = ['head', 'leftShoulder', 'leftElbow', 'rightShoulder', 'rightElbow',
  'leftHip', 'leftKnee', 'rightHip', 'rightKnee'] as const;
export const PATTERN_IDS = ['cloud-v1', 'wave-v1', 'flower-v1'] as const;
export const PALETTE_IDS = ['vermilion-v1', 'indigo-v1', 'woodland-v1'] as const;
export const BACKGROUND_IDS = ['plain-v1', 'home-v1', 'road-v1', 'mountain-v1'] as const;
export const STORY_NODE_IDS = ['intro', 'craft', 'memory-wave', 'memory-separate', 'road', 'training',
  'guardian', 'approach-choice', 'call-light', 'call-response', 'call-split', 'split-axe', 'split-search',
  'split-response', 'reunion-reach', 'reunion-hold', 'curtain', 'completed'] as const;
export const EXHIBIT_IDS = ['E01', 'E02', 'E03', 'E04', 'E05', 'E06', 'E07', 'E08'] as const;
export const PROJECT_ROUTES = ['/', '/craft', '/light', '/story', '/museum', '/result', '/practice', '/about'] as const;
// Reserved stable IDs. T07 must keep their meaning or version/migrate persisted data.
export const PRESET_IDS = ['wave-v1', 'walk-v1', 'bow-v1', 'raise-axe-v1', 'reach-v1'] as const;
export const ASSISTABLE_NODES = ['memory-wave', 'road', 'guardian', 'call-light', 'call-split',
  'split-axe', 'split-search', 'reunion-reach', 'curtain'] as const;
export const MAX_JOINT_ANGLE = 3.141593; // pi rounded to the persisted six decimal places; T01 adds tighter template limits.
export const AUTOSAVE_DELAY_MS = 500;
export const AUTOSAVE_MAX_WAIT_MS = 2000;

/** UTF-8 byte size without relying on TextEncoder (unavailable in IE11). */
export function utf8Bytes(text: string): number {
  let bytes = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xd800 && code <= 0xdbff && i + 1 < text.length && text.charCodeAt(i + 1) >= 0xdc00 && text.charCodeAt(i + 1) <= 0xdfff) {
      bytes += 4; i += 1;
    } else bytes += 3;
  }
  return bytes;
}
