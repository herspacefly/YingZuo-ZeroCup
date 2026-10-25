export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag); result.className = className; result.textContent = text; return result;
}
export function clear(host: HTMLElement) { while (host.firstChild) host.removeChild(host.firstChild); }
export function removeNode(node:Node|null|undefined){if(node?.parentNode)node.parentNode.removeChild(node);}
export function prependNode(host:Node,node:Node){host.insertBefore(node,host.firstChild);}
export function closestElement<T extends Element=HTMLElement>(node:Element|null,selector:string):T|null{
  for(let current=node;current;current=current.parentElement){const match=current.matches??(current as Element&{msMatchesSelector?:(s:string)=>boolean}).msMatchesSelector;if(match?.call(current,selector))return current as T;}return null;
}
export function focusWithoutScroll(node:HTMLElement){const x=window.pageXOffset,y=window.pageYOffset;try{node.focus({preventScroll:true});}catch{node.focus();}if(window.pageXOffset!==x||window.pageYOffset!==y)window.scrollTo(x,y);}
export function emitEvent(target:EventTarget,name:string){const event=document.createEvent('Event');event.initEvent(name,false,false);target.dispatchEvent(event);}
export function append(host: HTMLElement, ...children: HTMLElement[]) { children.forEach(child => host.appendChild(child)); }
export function link(text: string, href: string, className = 'text-link') { const a = element('a', className, text); a.href = href; return a; }
export function scope() {
  let disposed = false; const cleanups: (() => void)[] = [];
  return {
    on(target: EventTarget, event: string, listener: EventListener) { target.addEventListener(event, listener); cleanups.push(() => target.removeEventListener(event, listener)); },
    get disposed() { return disposed; },
    dispose() { disposed = true; cleanups.splice(0).forEach(cleanup => cleanup()); },
  };
}
