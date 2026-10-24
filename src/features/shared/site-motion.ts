import { element, scope } from './dom';
import '../../styles/site-motion.css';

/** Decorative presentation only. Story poses and director time never depend on it. */
export function mountSiteMotion(host: HTMLElement) {
  const life=scope(),root=document.documentElement,media=window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const button=element('button','button secondary site-motion-toggle'),dust=element('div','site-light-dust');
  button.id='site-motion-toggle';button.type='button';dust.setAttribute('aria-hidden','true');
  for(let i=0;i<24;i++){
    const mote=element('i');mote.style.left=`${(i*37+9)%100}%`;mote.style.top=`${(i*23+4)%100}%`;
    mote.style.animationDelay=`-${i*.71}s`;mote.style.animationDuration=`${12+i%7}s`;dust.appendChild(mote);
  }
  document.body.appendChild(dust);document.body.appendChild(button);
  let enabled=!media?.matches,focused=true,observer:IntersectionObserver|null=null,tilted:HTMLElement|null=null,disposed=false;
  function resetTilt(){tilted?.style.removeProperty('--motion-x');tilted?.style.removeProperty('--motion-y');tilted=null;}
  function sync(){
    root.setAttribute('data-motion',enabled&&!media?.matches?'full':'reduced');
    root.setAttribute('data-motion-paused',String(document.hidden||!focused));
    button.textContent=media?.matches?'动效 · 系统简化':enabled?'动效 · 华彩已开':'动效 · 已简化';
    button.setAttribute('aria-label',media?.matches?'系统已启用减少动态':'切换全站装饰动效');
    button.setAttribute('aria-pressed',String(enabled&&!media?.matches));button.disabled=!!media?.matches;
    if(!enabled||media?.matches)resetTilt();
  }
  function present(){
    observer?.disconnect();resetTilt();
    const targets=[...host.querySelectorAll<HTMLElement>('.page-heading,.opening-copy,.hero-stage,.story-background,.intro-steps,.museum-hero,.museum-photo-card,.museum-gallery-paragraph,.museum-section,.museum-invitation,.programme,.control-panel')];
    if(typeof IntersectionObserver==='function'){
      observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){entry.target.classList.remove('motion-awaiting');observer?.unobserve(entry.target);}},{threshold:.08});
      for(const [index,target]of targets.entries()){
        target.classList.add('motion-reveal','motion-awaiting');target.style.setProperty('--reveal-delay',`${Math.min(index%4*65,195)}ms`);observer.observe(target);
      }
    }
    host.classList.remove('motion-route-enter');void host.offsetWidth;host.classList.add('motion-route-enter');
  }
  life.on(button,'click',()=>{enabled=!enabled;sync();});
  life.on(document,'visibilitychange',sync);life.on(window,'blur',()=>{focused=false;sync();});life.on(window,'focus',()=>{focused=true;sync();});
  if(media){if(typeof media.addEventListener==='function')life.on(media,'change',sync);else{media.addListener(sync);life.on(window,'pagehide',()=>media.removeListener(sync));}}
  life.on(host,'pointermove',event=>{
    if(!enabled||media?.matches||(event as PointerEvent).buttons!==0)return;
    let node=event.target as HTMLElement|null;
    while(node&&node!==host&&!node.classList.contains('museum-hero-photo')&&!node.classList.contains('hero-stage'))node=node.parentElement;
    if(!node||node===host){resetTilt();return;}
    if(tilted!==node){resetTilt();tilted=node;}
    const box=node.getBoundingClientRect(),p=event as PointerEvent;
    node.style.setProperty('--motion-x',`${Math.max(-1,Math.min(1,(p.clientX-box.left)/box.width*2-1))*3}deg`);
    node.style.setProperty('--motion-y',`${Math.max(-1,Math.min(1,(p.clientY-box.top)/box.height*2-1))*-3}deg`);
  });
  life.on(host,'pointerleave',resetTilt);
  const mutation=new MutationObserver(present);mutation.observe(host,{childList:true});sync();present();
  return {dispose(){if(disposed)return;disposed=true;mutation.disconnect();observer?.disconnect();resetTilt();life.dispose();media?.removeListener(sync);button.parentNode?.removeChild(button);dust.parentNode?.removeChild(dust);root.removeAttribute('data-motion');root.removeAttribute('data-motion-paused');}};
}
