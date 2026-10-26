import type { ProjectV1 } from '../../domain/types';
import { append, element, scope } from '../shared/dom';
import { CARVING_CUTS, cutSample } from './carving-model';

let serial=0;
/** Actual mask holes in a separate specimen, with an identical projection. */
export function mountMuseumCarving(host:HTMLElement){
  const life=scope(),root=element('section','museum-demo carving-workshop');root.id='museum-demo-root';root.dataset.kind='carving';
  const head=element('header');append(head,element('span','eyebrow','一刀一束光 / 刻刀透光台'),element('h3','','亲手刻出一盏莲灯'),element('p','','沿虚线点刻，或按住鼠标划过莲瓣。每取走一片皮料，右侧幕上便多亮起一处。'));
  const layout=element('div','carving-layout'),specimen=element('figure','carving-specimen'),projection=element('figure','carving-projection'),panel=element('section','surface-card carving-tools');
  const ns='http://www.w3.org/2000/svg',id='carving-mask-'+(++serial),holes:SVGPathElement[]=[],targets:SVGPathElement[]=[];
  function svgNode(name:string,attrs:Record<string,string>){const node=document.createElementNS(ns,name);for(const [k,v]of Object.entries(attrs))node.setAttribute(k,v);return node;}
  const svg=svgNode('svg',{viewBox:'0 0 300 320',role:'group','aria-label':'可点刻的莲灯皮样，沿虚线点击或拖动','class':'carving-surface'});
  const defs=svgNode('defs',{}),mask=svgNode('mask',{id,maskUnits:'userSpaceOnUse',x:'0',y:'0',width:'300',height:'320'});mask.appendChild(svgNode('rect',{width:'300',height:'320',fill:'white'}));
  for(const cut of CARVING_CUTS){const path=svgNode('path',{d:cut.path,fill:'black'});holes.push(path as SVGPathElement);mask.appendChild(path);}
  defs.appendChild(mask);svg.appendChild(defs);
  const plaque='M150 22 C215 22 269 69 271 130 L271 235 Q269 291 150 300 Q31 291 29 235 L29 130 C31 69 85 22 150 22Z';
  svg.appendChild(svgNode('path',{d:plaque,fill:'#883323',stroke:'#dda453','stroke-width':'3',mask:`url(#${id})`}));
  svg.appendChild(svgNode('path',{d:'M150 34 C209 34 257 76 258 132 L258 230 Q254 276 150 287 Q46 276 42 230 L42 132 C43 76 91 34 150 34Z',fill:'none',stroke:'#d7a35d','stroke-width':'1.5','stroke-dasharray':'2 5','pointer-events':'none'}));
  let cuts:number[]=[],comparing=false,dragging=false,disposed=false;
  const reading=element('p','selection-summary');reading.id='museum-demo-reading';reading.setAttribute('role','status');
  function carve(index:number){if(disposed)return;comparing=false;cuts=cutSample(cuts,index);render();}
  const buttons:HTMLButtonElement[]=[];
  for(const [index,cut]of CARVING_CUTS.entries()){
    const target=svgNode('path',{d:cut.path,fill:'transparent',stroke:'#f5d598','stroke-width':'1.4','stroke-dasharray':'3 4','data-cut':String(index),'class':'carving-cut-target'});targets.push(target as SVGPathElement);svg.appendChild(target);
    const button=element('button','button secondary',`${index+1} · ${cut.name}`);button.type='button';button.setAttribute('aria-label',`刻开${cut.name}`);life.on(button,'click',()=>carve(index));buttons.push(button);
  }
  const shadowSvg=svgNode('svg',{viewBox:'0 0 300 320',role:'img','aria-label':'同一莲灯的幕上投影，孔隙随刻制逐个透光','class':'carving-shadow'});
  const shadowPaths:SVGElement[]=[];shadowSvg.appendChild(svgNode('path',{d:plaque,fill:'#733e28',opacity:'.88',stroke:'#c18b3c','stroke-width':'2'}));
  for(const cut of CARVING_CUTS){const path=svgNode('path',{d:cut.path,fill:'#fff1b7','class':'carving-light-hole'});shadowPaths.push(path);shadowSvg.appendChild(path);}
  specimen.appendChild(svg);specimen.appendChild(element('figcaption','','刀下 · 皮样上的留白'));
  projection.appendChild(shadowSvg);projection.appendChild(element('figcaption','','幕上 · 留白变成了光'));
  const next=element('button','button primary','刻下一刀'),compare=element('button','button secondary','按下看未刻'),reset=element('button','button secondary','重新刻一盏');reset.id='museum-demo-reset';next.id='museum-carve-next';compare.id='museum-carve-compare';
  const progress=element('progress');progress.max=CARVING_CUTS.length;progress.setAttribute('aria-label','已刻孔隙');
  const list=element('div','carving-cut-buttons');append(list,...buttons);append(panel,element('h3','','八处留白，一盏灯'),progress,reading,next,compare,reset,list,element('p','quiet-note','这是独立的莲灯纹样练习。刻出的孔隙不会贴到影偶服装，也不会修改作品。'));
  append(layout,specimen,projection);append(root,head,layout,panel);host.appendChild(root);
  function render(){for(let i=0;i<holes.length;i++){const open=!comparing&&cuts.includes(i);holes[i]!.style.display=open?'':'none';shadowPaths[i]!.style.display=open?'':'none';targets[i]!.setAttribute('stroke',open?'transparent':'#f5d598');buttons[i]!.setAttribute('aria-pressed',String(cuts.includes(i)));}progress.value=cuts.length;next.disabled=cuts.length===CARVING_CUTS.length;compare.disabled=cuts.length===0;compare.setAttribute('aria-pressed',String(comparing));compare.textContent=comparing?'回到已刻成影':'按下看未刻';reading.textContent=comparing?'刻前对照：色面完整，幕上还没有莲瓣的亮孔。':cuts.length===8?'八刀完成 · 刻掉的部分，正成为幕上的一盏灯。':`已刻 ${cuts.length} / 8 处 · ${cuts.length?'继续沿虚线取下一瓣。':'从灯心或任意一片莲瓣开始。'}`;}
  function hit(event:MouseEvent|PointerEvent){const target=document.elementFromPoint(event.clientX,event.clientY);const index=target?.getAttribute('data-cut');if(index!==null&&index!==undefined&&svg.contains(target))carve(Number(index));}
  if(window.PointerEvent){life.on(svg,'pointerdown',event=>{const e=event as PointerEvent;if(e.button!==0)return;e.preventDefault();dragging=true;svg.setPointerCapture?.(e.pointerId);hit(e);});life.on(svg,'pointermove',event=>{if(dragging){event.preventDefault();hit(event as PointerEvent);}});for(const n of ['pointerup','pointercancel','lostpointercapture'])life.on(svg,n,()=>{dragging=false;});
  }else{life.on(svg,'mousedown',event=>{dragging=true;hit(event as MouseEvent);});life.on(svg,'mousemove',event=>{if(dragging)hit(event as MouseEvent);});life.on(window,'mouseup',()=>{dragging=false;});}
  life.on(window,'blur',()=>{dragging=false;});life.on(document,'visibilitychange',()=>{if(document.hidden)dragging=false;});life.on(next,'click',()=>{const index=CARVING_CUTS.findIndex((_,i)=>!cuts.includes(i));carve(index);});life.on(compare,'click',()=>{comparing=!comparing;render();});life.on(reset,'click',()=>{cuts=[];comparing=false;dragging=false;render();});render();
  return {update(_project:ProjectV1|null){},dispose(){if(disposed)return;disposed=true;dragging=false;life.dispose();if(root.parentNode)root.parentNode.removeChild(root);}};
}
