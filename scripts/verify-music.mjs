import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=new URL('../',import.meta.url);
export function musicProblems(){
  const issues=[];
  try{
    const catalog=JSON.parse(readFileSync(new URL('src/content/music.json',root),'utf8'));
    if(catalog.schemaVersion!==1||catalog.tracks.map(t=>t.id).sort().join(',')!=='curtain,instrumental')issues.push('music IDs/schema');
    for(const t of catalog.tracks){
      if(!/^audio\/[a-z0-9-]+\.mp3$/.test(t.path)||t.src!=='./'+t.path){issues.push('music path '+t.id);continue;}
      const bytes=readFileSync(new URL('public/'+t.path,root));
      if(bytes.length!==t.bytes||createHash('sha256').update(bytes).digest('hex')!==t.sha256)issues.push('music bytes/hash '+t.id);
      if(bytes.toString('ascii',0,3)!=='ID3'&&!(bytes[0]===255&&(bytes[1]&224)===224))issues.push('music MP3 signature '+t.id);
      if(t.license!=='CC-BY-4.0'||t.sourceUrl!=='https://zenodo.org/records/6536490'||t.sourceCategory!=='NACTA, not SVAD'||!t.credit||!t.processing||!t.recordist||!t.collection)issues.push('music attribution/source '+t.id);
      if(!(t.volume>0&&t.volume<=.4)||!Number.isFinite(t.durationSeconds)||t.durationSeconds<=0||t.loop!==(t.id==='instrumental'))issues.push('music playback contract '+t.id);
    }
  }catch(error){issues.push(String(error));}
  return issues;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const issues=musicProblems();if(issues.length){console.error(issues.join('\n'));process.exitCode=1;}
  else console.log('PASS: two local MP3 signatures/bytes/SHA and JaCRC v2 CC-BY-4.0 attribution agree. This is not speaker or device acceptance.');
}
