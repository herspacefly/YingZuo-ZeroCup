import { createFrameRateMonitor } from '../../app/frame-rate-monitor';
import type { FrameObserver } from '../../app/animation-clock';
import { append, element, scope } from './dom';

// A display preference for this document, shared across short scenes/routes; never serialized.
let lightweight = false;
const qualityListeners = new Set<(enabled: boolean) => void>();
function chooseQuality(enabled: boolean) {
  lightweight = enabled;
  for (const listener of qualityListeners) listener(enabled);
}

/** Local display preference: no timer, storage write, focus grab or automatic scene change. */
export function mountStagePerformance(host: HTMLElement, setLightweight: (enabled: boolean) => void) {
  const life = scope(), root = element('div', 'stage-performance'), text = element('p'), actions = element('div', 'stage-performance-actions');
  const use = element('button', 'button secondary', '使用轻量二维'), keep = element('button', 'button secondary', '继续当前画面'), restore = element('button', 'button secondary', '恢复原画质');
  use.type = keep.type = restore.type = 'button';
  use.classList.add('performance-lightweight'); keep.classList.add('performance-keep'); restore.classList.add('performance-restore');
  text.setAttribute('role', 'status'); root.hidden = true; restore.hidden = true;
  append(actions, use, keep, restore); append(root, text, actions); host.appendChild(root);
  let disposed = false;
  const monitor = createFrameRateMonitor(() => {
    if (disposed || lightweight) return;
    text.textContent = '画面持续有些卡顿。可以使用轻量二维，让演出更顺畅；剧情和行装会保留。';
    use.hidden = keep.hidden = false; restore.hidden = true;
    root.hidden = false; root.setAttribute('data-state', 'suggested');
  });
  const observer: FrameObserver = {
    frame(delta) { if (!disposed) monitor.frame(delta); },
    reset() { monitor.reset(); },
  };
  function qualityChanged(enabled: boolean) {
    if (disposed) return; setLightweight(enabled);
    if (enabled) {
      root.hidden = false; root.setAttribute('data-state', 'lightweight'); text.textContent = '已使用轻量二维画面，可以继续演出。';
      use.hidden = keep.hidden = true; restore.hidden = false;
    } else { root.hidden = true; root.setAttribute('data-state', 'restored'); }
  }
  qualityListeners.add(qualityChanged);
  if (lightweight) qualityChanged(true);
  life.on(use, 'click', () => { if (!disposed) chooseQuality(true); });
  life.on(keep, 'click', () => { root.hidden = true; root.setAttribute('data-state', 'dismissed'); });
  life.on(restore, 'click', () => {
    if (!disposed) chooseQuality(false);
  });
  return { observer, dispose() { disposed = true; qualityListeners.delete(qualityChanged); monitor.reset(); life.dispose(); if (root.parentNode) root.parentNode.removeChild(root); } };
}
