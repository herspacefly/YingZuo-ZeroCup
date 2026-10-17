export function element<K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] {
  const result = document.createElement(tag); result.className = className; result.textContent = text; return result;
}
export function clear(host: HTMLElement) { while (host.firstChild) host.removeChild(host.firstChild); }
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
