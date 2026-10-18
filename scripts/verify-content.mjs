import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { validateStoryDefinition } from '../src/content/story-contract.ts';
import { validateMuseumContent } from '../src/content/museum-contract.ts';
import { STORY_NODE_IDS, JOINT_IDS } from '../src/domain/limits.ts';
import { releaseProblems } from './review-gate.mjs';
const root=new URL('../',import.meta.url);
const json=file=>JSON.parse(readFileSync(new URL(file,root),'utf8'));
const definition=json('src/content/stories/reunion-v1.json');
const refs={nodeIds:STORY_NODE_IDS,jointIds:JOINT_IDS,
  sourceIds:json('src/content/sources.json').sources.map(s=>s.id),assetIds:json('src/content/manifest.json').assets.map(a=>a.id),
  puppets:['chenxiang-v1','mother-v1','guardian-v1'].map(id=>json(`src/content/puppets/${id}.json`)),scenes:json('src/content/scenes.json').scenes};
const errors=[...validateStoryDefinition(definition,refs),...validateMuseumContent(json('src/content/exhibits.json'),json('src/content/facts.json'),json('src/content/sources.json'))];
if(errors.length){console.error(errors.join('\n'));process.exitCode=1;}
else if(process.argv.includes('--release')){const issues=releaseProblems('content');if(issues.length){console.error(`NOT_READY: ${issues.length} author review/rights items pending:\n${issues.slice(0,8).join('\n')}`);process.exitCode=2;}else console.log('PASS: story/exhibit/fact/sound contracts and current author review evidence agree.');}
else console.log(`PASS: 18 nodes, two 15-node paths, roles/poses/layers, timing and asset references; five sections/eight exhibits, Unicode copy lengths, cultural/model/original facts and checked source mappings; ${fileURLToPath(new URL('src/content/stories/reunion-v1.json',root))}. Formal content/asset review remains for T10.`);
