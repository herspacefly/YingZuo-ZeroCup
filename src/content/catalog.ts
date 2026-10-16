import manifest from './manifest.json';
import palettes from './palettes.json';
import patterns from './patterns.json';
import scenes from './scenes.json';
import chenxiang from './puppets/chenxiang-v1.json';
import mother from './puppets/mother-v1.json';
import guardian from './puppets/guardian-v1.json';
import type { AssetCatalog } from './asset-types';

// JSON is also checked by verify:assets and contract tests. No mutable project data here.
export const assetCatalog = { manifest, palettes, patterns, scenes, puppets: [chenxiang, mother, guardian] } as unknown as AssetCatalog;
