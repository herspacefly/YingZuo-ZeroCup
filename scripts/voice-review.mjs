import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';

const root=fileURLToPath(new URL('../',import.meta.url));
const catalog=JSON.parse(readFileSync(join(root,'src/content/voice-v5.json'),'utf8'));
const story=JSON.parse(readFileSync(join(root,'src/content/stories/reunion-v5.json'),'utf8'));
const names={narrator:'旁白',chenxiang:'沉香',mother:'母亲',guardian:'二郎神'};
const find=cue=>catalog.lines.find(line=>line.speaker===cue.speaker&&line.text===cue.text);
const recalls=[['你在途中说要','共同稳住'],['你在途中说要','独自承山'],['你曾决定','共同稳住'],['你曾决定','独自承山']].map(([start,pact])=>
  catalog.lines.find(line=>line.speaker==='narrator'&&line.text.startsWith(start)&&line.text.includes(pact)));
const groups=[{title:'四角色代表短样',lines:Object.keys(names).map(speaker=>catalog.lines.find(line=>line.speaker===speaker))},
  {title:'最长对白与选择回顾',lines:[...catalog.lines].sort((a,b)=>b.durationMs-a.durationMs).slice(0,1).concat(recalls)},
  ...story.nodes.filter(node=>node.id.endsWith('-epilogue')).map(node=>({title:node.title,lines:node.subtitles.map(find)}))];
const escape=text=>text.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>T38 中文配音试听</title>
<style>body{max-width:850px;margin:2rem auto;padding:0 1rem;font:18px/1.7 system-ui;background:#faf5e9;color:#34291e}article{border-top:1px solid #cdbf9c;padding:1rem 0}audio{width:100%}small{color:#67563f}button{padding:.6rem 1rem;font:inherit}h2{margin-top:2rem}</style>
<h1>v5 中文配音试听</h1><p>原始 MP3：旁白 Yunyang、沉香 Yunxia、母亲 Xiaoxiao、二郎神 Yunjian。保留服务音质与自然语速。本页用于人耳校对；解码和播放自动化不代表听感验收。</p>
<p>请关注发音、角色辨识、语气和句尾。沉香与母亲代表短样已获作者反馈“保持当前声线与自然语速”；其他项目仍待听感验收。</p>
<button id="sequence">依次试听全部</button> <button id="stop">停止</button>
${groups.map(group=>`<section><h2>${escape(group.title)}</h2>${group.lines.map(line=>{
if(!line)throw Error('Missing review clip');
return `<article><strong>${names[line.speaker]}</strong> <small>${(line.durationMs/1000).toFixed(3)} 秒 · ${escape(line.voice)}</small><p>${escape(line.text)}</p><audio controls preload="none" src="../../../public${line.src}"></audio></article>`;
}).join('')}</section>`).join('')}
<script>const players=[...document.querySelectorAll('audio')];let sequence=false;players.forEach((p,i)=>{p.onplay=()=>players.forEach(other=>{if(other!==p)other.pause()});p.onended=()=>{if(sequence&&players[i+1])players[i+1].play().catch(()=>sequence=false)}});document.querySelector('#sequence').onclick=()=>{sequence=true;players.forEach(p=>{p.pause();p.currentTime=0});players[0].play().catch(()=>sequence=false)};document.querySelector('#stop').onclick=()=>{sequence=false;players.forEach(p=>p.pause())}</script></html>`;
mkdirSync(join(root,'docs/evidence/t38'),{recursive:true});
writeFileSync(join(root,'docs/evidence/t38/listen.html'),html);
console.log(`PASS: ${groups.reduce((sum,group)=>sum+group.lines.length,0)} review entries; original local MP3 links, no transcode.`);
