import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateStoryDefinition } from '../src/content/story-contract.ts';
import { STORY_NODE_IDS, JOINT_IDS } from '../src/domain/limits.ts';
const root=new URL('../',import.meta.url);
const json=file=>JSON.parse(readFileSync(new URL(file,root),'utf8'));
const definition=json('src/content/stories/reunion-v1.json');
const refs={nodeIds:STORY_NODE_IDS,jointIds:JOINT_IDS,
  sourceIds:json('src/content/sources.json').sources.map(s=>s.id),assetIds:json('src/content/manifest.json').assets.map(a=>a.id),
  puppets:['chenxiang-v1','mother-v1','guardian-v1'].map(id=>json(`src/content/puppets/${id}.json`)),scenes:json('src/content/scenes.json').scenes};
const errors=validateStoryDefinition(definition,refs);
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else if(process.argv.includes('--release')){console.error('NOT_READY: T15 checks story structure only; T10 formal content/asset review is still pending.');process.exitCode=2;}
else console.log(`PASS: 18 nodes, two 15-node paths, roles/poses/layers, timing, sources and asset references; ${fileURLToPath(new URL('src/content/stories/reunion-v1.json',root))}. Runtime staging, geometry reachability and formal content review remain for T16/T17/T10.`);
