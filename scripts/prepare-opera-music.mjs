// Reproduce only the selected CC-BY-4.0 JaCRC v2 recordings, never the 7.1GB ZIP.
import {mkdirSync,writeFileSync,readFileSync,unlinkSync,existsSync} from 'node:fs';
import {inflateRawSync,crc32} from 'node:zlib';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const root=fileURLToPath(new URL('../',import.meta.url));
const cache=path.join(root,'.opera-source-cache'),out=path.join(root,'public/audio');
const archive='https://zenodo.org/api/records/6536490/files/JaCRC-recordings.zip/content',total=7113098439;
const sources=[{id:'jinghu',offset:2233860211,compressed:33314180,raw:36164088,crc:'6003b0b4',entry:'JaCRC-recordings/JaCRC-accompaniment-recordings/daspd-Hai_dao_bing-Gui_fei_zui_jiu-nacta-T-jh.wav'},
  {id:'vocal',offset:497439024,compressed:25082719,raw:36164088,crc:'3ee791de',entry:'JaCRC-recordings/daspd-Hai_dao_bing-Gui_fei_zui_jiu-nacta-T.wav'}];
const sha=b=>createHash('sha256').update(b).digest('hex');
function ffmpeg(args){const r=spawnSync('ffmpeg',['-y','-hide_banner','-loglevel','error',...args],{cwd:root,encoding:'utf8',windowsHide:true});if(r.error||r.status)throw new Error(r.error?.message||r.stderr);}
mkdirSync(cache,{recursive:true});mkdirSync(out,{recursive:true});
const evidence=[];
for(const s of sources){
  const local=path.join(cache,s.id+'.wav');let bytes;
  if(existsSync(local)){bytes=readFileSync(local);}else{
    // Python's native system proxy/resolver works on this Windows host; its
    // bounded reader rejects a whole-archive 200 before reading any body.
    const end=s.offset+s.compressed-1,expected=`bytes ${s.offset}-${end}/${total}`;
    const program='import sys,urllib.request\nu,start,end,size,expected=sys.argv[1:]\nr=urllib.request.urlopen(urllib.request.Request(u,headers={"Range":"bytes="+start+"-"+end}),timeout=60)\nif r.status!=206 or r.headers.get("Content-Range")!=expected: r.close(); raise RuntimeError("Refusing non-exact ZIP range")\nb=r.read(int(size)+1);r.close()\nif len(b)!=int(size): raise RuntimeError("Truncated/oversized range")\nsys.stdout.buffer.write(b)';
    const response=spawnSync(process.platform==='win32'?'python':'python3',['-c',program,archive,String(s.offset),String(end),String(s.compressed),expected],{maxBuffer:s.compressed+1048576,timeout:150000,windowsHide:true});
    if(response.error||response.status)throw new Error(response.error?.message||response.stderr.toString());
    bytes=inflateRawSync(response.stdout,{maxOutputLength:s.raw});
    if(bytes.length!==s.raw||crc32(bytes).toString(16).padStart(8,'0')!==s.crc)throw new Error('ZIP member CRC/length mismatch');
    writeFileSync(local,bytes);
  }
  if(bytes.length!==s.raw||crc32(bytes).toString(16).padStart(8,'0')!==s.crc)throw new Error('Cached source mismatch');
  evidence.push({...s,sha256:sha(bytes)});console.log('Verified selected source '+s.id+' '+bytes.length+' bytes');
}
const encode=['-map_metadata','-1','-ar','44100','-ac','1','-c:a','libmp3lame','-b:a','96k'];
ffmpeg(['-i',path.join(cache,'jinghu.wav'),'-t','96','-af','loudnorm=I=-22:LRA=9:TP=-2,afade=t=in:d=1,afade=t=out:st=93:d=3',...encode,path.join(out,'jinghu-instrumental.mp3')]);
ffmpeg(['-i',path.join(cache,'vocal.wav'),'-i',path.join(cache,'jinghu.wav'),'-t','40','-filter_complex','[0:a]volume=1[v];[1:a]volume=0.48[j];[v][j]amix=inputs=2:normalize=0,loudnorm=I=-20:LRA=9:TP=-2,afade=t=in:d=0.8,afade=t=out:st=37:d=3[m]','-map','[m]',...encode,path.join(out,'jingju-curtain.mp3')]);
mkdirSync(path.join(root,'docs/audio'),{recursive:true});
writeFileSync(path.join(root,'docs/audio/jacrc-extraction.json'),JSON.stringify({source:'https://zenodo.org/records/6536490',version:'2.0',license:'CC-BY-4.0',archive,archiveBytes:total,sources:evidence,processing:{background:'0-96s jinghu only; -22 LUFS, fades 1s/3s',curtain:'0-40s vocal + synchronized jinghu at .48; -20 LUFS, fades .8s/3s',encoding:'mono 44100Hz MP3 96kbps; metadata removed'},files:['jinghu-instrumental.mp3','jingju-curtain.mp3'].map(f=>{const b=readFileSync(path.join(out,f));return{path:'audio/'+f,bytes:b.length,sha256:sha(b)};})},null,2)+'\n');
if(!process.argv.includes('--keep-source')){for(const s of sources)unlinkSync(path.join(cache,s.id+'.wav'));}
console.log('Prepared two local opera tracks; no whole-archive download. Source cache WAVs removed unless --keep-source.');
