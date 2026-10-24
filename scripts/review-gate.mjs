import {readFileSync,existsSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {reviewProblems} from '../src/content/review-contract.ts';
const root=new URL('../',import.meta.url),ledgerFile=new URL('docs/reviews/t10-review.json',root);
const json=file=>JSON.parse(readFileSync(new URL(file,root),'utf8').replace(/^\uFEFF/,''));
const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export function assetReviewSubject(asset,provenance,bindings=null){const {reviewStatus:_workflow,...content}=asset;return {id:'asset:'+asset.id,sha256:digest([content,provenance,bindings]),rightsRequired:true,license:asset.license};}
export function exhibitReviewSubject(item,sources){return {id:'exhibit:'+item.id,sha256:digest([item,item.sourceIds.map(id=>sources.find(source=>source.id===id))]),rightsRequired:false};}
export function reviewSubjects(kind){
  if(kind==='assets'){
    const manifest=json('src/content/manifest.json');
    const bindings={puppets:['chenxiang-v1','mother-v1','guardian-v1'].map(id=>json(`src/content/puppets/${id}.json`)),scenes:json('src/content/scenes.json'),patterns:json('src/content/patterns.json'),palettes:json('src/content/palettes.json'),colorMapEncoding:manifest.colorMapEncoding};
    return manifest.assets.map(asset=>assetReviewSubject(asset,manifest.provenance,bindings));
  }
  const sources=json('src/content/sources.json').sources,media=json('src/content/museum-media.json');
  return [
    ...json('src/content/stories/reunion-v4.json').nodes.map(node=>({id:'story-v4:'+node.id,sha256:digest([node,json('src/content/stories/reunion-v4.json').endings]),rightsRequired:false})),
    ...json('src/content/stories/reunion-v3.json').nodes.map(node=>({id:'story-v3:'+node.id,sha256:digest([node,json('src/content/stories/reunion-v3.json').endings]),rightsRequired:false})),
    {id:'story-background:v3',sha256:digest(json('src/content/story-background.json')),rightsRequired:false},
    ...media.exhibits.map(row=>({id:'museum-reading:'+row.exhibitId,sha256:digest([row,media.sources]),rightsRequired:false})),
    ...media.media.map(row=>({id:'museum-media:'+row.id,sha256:digest([row,media.sources.find(source=>source.id===row.sourceId)]),rightsRequired:row.kind==='external',...(row.kind==='external'?{license:'unknown'}:{})})),
    ...json('src/content/stories/reunion-v2.json').nodes.map(node=>({id:'story-v2:'+node.id,sha256:digest([node,json('src/content/stories/reunion-v2.json').endings]),rightsRequired:false})),
    ...json('src/content/stories/reunion-v1.json').nodes.map(node=>({id:'story:'+node.id,sha256:digest(node),rightsRequired:false})),
    ...json('src/content/exhibits.json').exhibits.map(item=>exhibitReviewSubject(item,sources)),
    ...json('src/content/facts.json').facts.map(item=>({id:'fact:'+item.id,sha256:digest([item,item.sourceIds.map(id=>sources.find(s=>s.id===id))]),rightsRequired:false})),
    {id:'sound:stage-v1',sha256:digest(readFileSync(new URL('src/audio/stage-sound.ts',root),'utf8')+readFileSync(new URL('src/content/sound-cues.ts',root),'utf8')),rightsRequired:true,license:'project-authorized'},
    ...json('src/content/music.json').tracks.map(track=>({id:'music:'+track.id,sha256:digest([track,readFileSync(new URL('src/audio/music-scene.ts',root),'utf8'),readFileSync(new URL('src/audio/stage-music.ts',root),'utf8')]),rightsRequired:true,license:track.license})),
  ];
}
export function releaseProblems(kind){
  if(!existsSync(ledgerFile))return ['author review ledger not prepared'];
  const ledger=json('docs/reviews/t10-review.json'),subjects=reviewSubjects(kind),issues=reviewProblems(subjects,ledger),ids=new Set(subjects.map(s=>s.id));
  for(const record of ledger.records??[])if(ids.has(record.id))for(const field of ['review','rights']){
    const proof=record[field];if(!proof?.evidenceFile||!/^docs\/reviews\/[a-z0-9-]+\.md$/.test(proof.evidenceFile))continue;
    const file=new URL(proof.evidenceFile,root);if(!existsSync(file)||digest(readFileSync(file,'utf8'))!==proof.evidenceSha256)issues.push(`${record.id}: ${field} evidence file missing or changed`);
  }return issues;
}
if(process.argv.includes('--prepare')){
  const subjects=[...reviewSubjects('assets'),...reviewSubjects('content')],existing=existsSync(ledgerFile)?json('docs/reviews/t10-review.json'):{schemaVersion:1,records:[]};
  const prior=new Map(existing.records.map(item=>[item.id,item]));
  existing.records=subjects.map(subject=>{const old=prior.get(subject.id);if(old?.review?.status==='approved')return old;return {id:subject.id,sha256:subject.sha256,review:{status:'pending',reviewer:null,reviewedAt:null,evidenceFile:null,evidenceSha256:null},...(subject.rightsRequired?{rights:old?.rights?.status==='granted'?old.rights:{status:'pending',holder:null,terms:null,evidenceFile:null,evidenceSha256:null}}:{})};});
  mkdirSync(new URL('docs/reviews/',root),{recursive:true});writeFileSync(ledgerFile,JSON.stringify(existing,null,2)+'\n');console.log(`Prepared ${subjects.length} review subjects; no approval or rights have been inferred.`);
}
