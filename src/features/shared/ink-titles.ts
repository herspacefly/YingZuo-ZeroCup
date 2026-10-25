import {scope,removeNode} from './dom';
import '../../styles/ink-titles.css';
let serial=0;
/** Semantic HTML owns layout. The decorative SVG is disposable and never the source of text. */
export function mountInkTitles(host:HTMLElement){
 const life=scope(),bindings=new Map<HTMLElement,{dispose():void;play():void;refresh():void;freeze():void}>();let disposed=false,scheduled=false;
 const selector='.page-heading h1,.hero-title,.intro-steps h2,.story-strip h2,.museum-invitation h2,.story-background>h2,.museum-hero-copy h2,.museum-gallery-heading h2';
 const fonts=document.fonts;const available=fonts?Promise.race([fonts.load('32px "Yingzuo Brush"').then(values=>values.length>0).catch(()=>false),new Promise<boolean>(resolve=>setTimeout(()=>resolve(false),2500))]):Promise.resolve(false);
 function bind(title:HTMLElement){
  let played=false,observer:IntersectionObserver|null=null,resize:ResizeObserver|null=null,overlay:SVGSVGElement|null=null,dead=false,fontLoaded=false,lastSize='';const own=scope();
  title.classList.add('ink-title');
  function quiet(){return document.documentElement.getAttribute('data-motion')!=='full'||window.matchMedia('(prefers-reduced-motion: reduce)').matches;}
  function draw(){
   if(dead||!document.documentElement.contains(title))return;const size=title.getBoundingClientRect(),sizeKey=size.width+':'+size.height+':'+getComputedStyle(title).fontFamily+':'+title.textContent;if(sizeKey===lastSize&&overlay&&title.classList.contains('ink-enhanced')&&!quiet())return;lastSize=sizeKey;removeNode(overlay);overlay=null;title.classList.remove('ink-enhanced');if(quiet())return;
   const text=title.firstChild;if(!text||text.nodeType!==Node.TEXT_NODE||title.childNodes.length!==1)return;
   const box=title.getBoundingClientRect();if(!box.width||!box.height)return;
   const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),defs=document.createElementNS(ns,'defs'),mask=document.createElementNS(ns,'mask'),id='ink-'+ ++serial;
   svg.classList.add('ink-overlay');svg.setAttribute('aria-hidden','true');svg.setAttribute('viewBox',`0 0 ${box.width} ${box.height}`);svg.setAttribute('width',String(box.width));svg.setAttribute('height',String(box.height));mask.id=id;mask.setAttribute('maskUnits','userSpaceOnUse');
   let offset=0,index=0;for(const char of Array.from(text.textContent??'')){const range=document.createRange();range.setStart(text,offset);offset+=char.length;range.setEnd(text,offset);const r=range.getBoundingClientRect();if(!char.trim()||!r.width)continue;const rect=document.createElementNS(ns,'rect');rect.setAttribute('x',String(r.left-box.left-1));rect.setAttribute('y',String(r.top-box.top-3));rect.setAttribute('width',String(r.width+2));rect.setAttribute('height',String(r.height+6));rect.setAttribute('fill','white');rect.style.setProperty('--ink-delay',`${Math.min(index++,28)*95}ms`);mask.appendChild(rect);}
   defs.appendChild(mask);const filter=document.createElementNS(ns,'filter');filter.id=id+'-wash';filter.setAttribute('x','-3%');filter.setAttribute('y','-5%');filter.setAttribute('width','106%');filter.setAttribute('height','110%');filter.innerHTML='<feTurbulence type="fractalNoise" baseFrequency=".035" numOctaves="2" seed="7" result="grain"/><feDisplacementMap in="SourceGraphic" in2="grain" scale=".8" xChannelSelector="R" yChannelSelector="G"/>';defs.appendChild(filter);svg.appendChild(defs);
   const foreign=document.createElementNS(ns,'foreignObject');foreign.setAttribute('width','100%');foreign.setAttribute('height','100%');foreign.setAttribute('mask',`url(#${id})`);foreign.classList.add('ink-wash');foreign.style.filter=`url(#${id}-wash)`;
   const copy=document.createElement('div'),style=getComputedStyle(title);copy.style.cssText=`font:${style.font};font-family:${style.fontFamily};font-size:${style.fontSize};font-weight:${style.fontWeight};line-height:${style.lineHeight};letter-spacing:${style.letterSpacing};text-align:${style.textAlign};white-space:pre-line;color:${style.color};margin:0;padding:0;`;copy.textContent=text.textContent;foreign.appendChild(copy);svg.appendChild(foreign);const parent=title.parentElement!;parent.classList.add('ink-heading-host');svg.style.left=title.offsetLeft+'px';svg.style.top=title.offsetTop+'px';parent.appendChild(svg);overlay=svg;title.classList.add('ink-enhanced');if(played)svg.classList.add('ink-complete');
  }
  function play(){if(quiet()||!overlay||document.documentElement.getAttribute('data-intro')!=='done')return;played=true;overlay.classList.remove('ink-complete','ink-playing');void overlay.getBoundingClientRect();overlay.classList.add('ink-playing');}
  function attempt(){if(!played&&title.getBoundingClientRect().top<innerHeight&&title.getBoundingClientRect().bottom>0)play();}
  own.on(document,'yingzuo:opened',attempt);own.on(document,'yingzuo:motion',()=>{if(quiet()){title.classList.remove('ink-enhanced');}else{draw();attempt();}});
  void available.then(ok=>{if(dead||!ok||!('SVGForeignObjectElement'in window))return;fontLoaded=true;draw();if(typeof ResizeObserver==='function'){resize=new ResizeObserver(()=>{draw();attempt();});resize.observe(title);}else own.on(window,'resize',draw);if(typeof IntersectionObserver==='function'){observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting)attempt();},{threshold:.1});observer.observe(title);}attempt();});
  return{play,freeze(){if(played&&overlay){overlay.classList.remove('ink-playing');overlay.classList.add('ink-complete');}},refresh(){if(fontLoaded)draw();},dispose(){dead=true;observer?.disconnect();resize?.disconnect();own.dispose();removeNode(overlay);title.classList.remove('ink-title','ink-enhanced');}};
 }
 function scan(){scheduled=false;if(disposed)return;for(const [node,binding]of bindings)if(!host.contains(node)){if(document.documentElement.hasAttribute('data-guiding'))binding.freeze();else{binding.dispose();bindings.delete(node);}}for(const node of host.querySelectorAll<HTMLElement>(selector))if(!bindings.has(node))bindings.set(node,bind(node));else bindings.get(node)!.refresh();}
 const mutation=new MutationObserver(()=>{if(!scheduled){scheduled=true;void Promise.resolve().then(scan);}});mutation.observe(host,{childList:true,subtree:true});scan();
 return{dispose(){disposed=true;mutation.disconnect();life.dispose();bindings.forEach(value=>value.dispose());bindings.clear();}};
}
