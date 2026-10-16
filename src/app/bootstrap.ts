import '../styles/probe.css';
import { mountLightStudy } from '../probes/canvas';
import { mountStorageProbe } from '../probes/panel';

let disposeStorage = () => undefined as void;
let onChange = () => undefined as void;
const study = mountLightStudy(() => onChange());
const runtime = document.getElementById('runtime-status');
if (runtime) {
  const mode = import.meta.env.LEGACY ? 'legacy' : 'modern';
  runtime.textContent = `当前入口：${mode} · Canvas 2D。此结果不代表真实 IE 验收。`;
  runtime.setAttribute('data-entry', mode);
  if (study) {
    const panel = mountStorageProbe(study);
    disposeStorage = panel.dispose;
    onChange = panel.onChange;
  } else {
    document.getElementById('storage-status')!.textContent = '画布不可用，未启动灯位存储检查。';
  }
}

// One cleanup path for leaving the page, HMR and back-forward cache restoration.
function dispose() { disposeStorage(); study?.dispose(); }
window.addEventListener('pagehide', dispose);
function onPageShow(event: PageTransitionEvent) {
  if (event.persisted) window.location.reload();
}
window.addEventListener('pageshow', onPageShow);
if (import.meta.hot) import.meta.hot.dispose(() => {
  dispose();
  window.removeEventListener('pagehide', dispose);
  window.removeEventListener('pageshow', onPageShow);
});
