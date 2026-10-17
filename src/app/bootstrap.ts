import '../styles/tokens.css';
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/controls.css';
import '../styles/legacy.css';
import { createHashRouter } from './router';
import type { AppRoute } from './router';
import { openProjectSession } from './session';
import type { ProjectStore, SaveResult, StoreState } from './store';
import type { PageContext, PageFactory, PageView } from './view';
import { newIdentifier } from './identity';
import { startStory, submitStoryCommand } from './story-commands';
import { storyGuard } from '../domain/story';
import { downloadJSON, exportProjectJSON, readProjectFile } from '../persistence/project-file';
import { serializeRawRecords } from '../persistence/storage';
import { clear, scope } from '../features/shared/dom';
import { mountIntro } from '../features/intro/view';
import { mountCraft } from '../features/craft/view';
import { mountLight } from '../features/light/view';
import { mountStory } from '../features/story/view';
import { mountMuseum } from '../features/museum/view';
import { mountPractice } from '../features/practice/view';
import { mountResult } from '../features/result/view';
import { mountAbout } from '../features/about/view';

const factories: Record<AppRoute['path'], PageFactory> = {
  '/': mountIntro, '/craft': mountCraft, '/light': mountLight, '/story': mountStory,
  '/museum': mountMuseum, '/practice': mountPractice, '/result': mountResult, '/about': mountAbout,
};
const labels: Record<StoreState['status'], string> = {
  loading: '读取中', saved: '已保存', unsaved: '待保存', saving: '保存中', error: '保存失败',
  conflict: '有存档冲突', recovery: '需要恢复', unsupported: '版本不兼容', memory: '仅在本页', closed: '已关闭',
};
function get<T extends HTMLElement>(id: string): T { return document.getElementById(id) as T; }
const host = get<HTMLDivElement>('app-view'), main = get<HTMLElement>('main');
const tools = get<HTMLDetailsElement>('project-tools'), operation = get<HTMLElement>('project-operation');
const menu = get<HTMLButtonElement>('menu-toggle'), nav = get<HTMLElement>('primary-nav');
const life = scope(), downloads: (() => void)[] = [];
let store: ProjectStore | null = null, page: PageView | null = null;
let router: ReturnType<typeof createHashRouter> | null = null, unsubscribe = () => {};
let disposed = false, locked = false, current: AppRoute | null = null;

function notify(message: string) {
  if (disposed) return;
  const notice = get<HTMLElement>('app-notice'); notice.textContent = message; notice.hidden = !message;
}
function showTools(open: boolean) {
  if (open) tools.setAttribute('open', ''); else tools.removeAttribute('open');
  get<HTMLElement>('open-project-tools').setAttribute('aria-expanded', String(open));
}
function report(error: unknown) {
  if (disposed) return;
  operation.textContent = error instanceof Error ? error.message : String(error);
  showTools(true);
}
function refresh() { if (store && !disposed) update(store.getState()); }
async function run(job: () => Promise<unknown>) {
  try {
    const result = await job() as SaveResult | undefined;
    if (result && result.ok === false) report(result.error);
  } catch (error) { report(error); }
}
async function durable(job: () => Promise<SaveResult>, next?: AppRoute) {
  if (disposed || locked) return;
  locked = true; refresh(); operation.textContent = '';
  try {
    const result = await job();
    if (disposed) return;
    locked = false; refresh();
    if (result.ok) { notify(''); if (next) router?.navigate(next); }
    else report(result.error);
  } catch (error) { report(error); }
  finally { locked = false; refresh(); }
}
function setMenu(open: boolean) {
  if (open) nav.classList.add('expanded'); else nav.classList.remove('expanded');
  menu.setAttribute('aria-expanded', String(open));
}
function update(state: StoreState) {
  const status = get<HTMLElement>('save-state'); status.textContent = labels[state.status]; status.setAttribute('data-state', state.status);
  get<HTMLElement>('storage-detail').textContent = state.message;
  const blocked = locked || state.hasPending || !state.project || ['loading', 'saving', 'closed', 'unsupported', 'recovery', 'conflict'].includes(state.status);
  get<HTMLButtonElement>('export-project').disabled = !store?.getExportProject();
  get<HTMLButtonElement>('retry-save').disabled = locked || !state.project || !['error', 'unsaved', 'memory'].includes(state.status);
  get<HTMLButtonElement>('cancel-pending').hidden = !state.hasPending;
  get<HTMLButtonElement>('cancel-pending').disabled = locked;
  get<HTMLButtonElement>('continue-memory').hidden = !state.hasPending || state.pendingKind !== 'save' || ['conflict', 'unsupported'].includes(state.status);
  get<HTMLButtonElement>('continue-memory').disabled = locked;
  get<HTMLButtonElement>('new-project').disabled = blocked;
  get<HTMLButtonElement>('reload-project').disabled = locked;
  get<HTMLInputElement>('import-project').disabled = blocked;
  if (['error', 'conflict', 'recovery', 'unsupported', 'memory'].includes(state.status)) showTools(true);
  page?.update(locked ? { ...state, status: 'saving' } : state);
}
function saveDownload(text: string, name: string) {
  downloads.push(downloadJSON(text, name)); operation.textContent = '已向浏览器请求下载，请核对下载列表。';
}

async function mount() {
  const opened = await openProjectSession();
  if (disposed) { opened.dispose(); return; }
  store = opened;
  get<HTMLElement>('app-runtime').setAttribute('data-entry', import.meta.env.LEGACY ? 'legacy' : 'modern');
  tools.hidden = false; menu.hidden = false; get<HTMLElement>('open-project-tools').hidden = false;
  document.body.classList.add('app-ready');
  router = createHashRouter({
    read: () => window.location.hash,
    push(hash) { if (window.location.hash !== hash) window.location.hash = hash; },
    replace(hash) { window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${hash}`); },
    listen(listener) { window.addEventListener('hashchange', listener); return () => window.removeEventListener('hashchange', listener); },
  }, parsed => {
    if (locked || (current && opened.getState().hasPending)) {
      notify('先处理待保存动作，再离开这一页。可以重试、导出或取消。'); showTools(true); return false;
    }
    const changed = !!current;
    page?.dispose(); clear(host); current = parsed.route;
    const context: PageContext = {
      store: opened, route: parsed.route, navigate: route => router?.navigate(route), isBusy:()=>locked, run, durable, notify,
      edit(command) { void run(() => opened.edit(command)); },
      start(mode) {
        const story = opened.getState().project?.story;
        if (story) { router?.navigate({ path: story.nodeId === 'craft' ? '/craft' : '/story', exhibitId: null }); return; }
        void durable(() => startStory(opened, newIdentifier('run'), mode), { path: '/story', exhibitId: null });
      },
      skipIntro() {
        const story = opened.getState().project?.story;
        if (story?.nodeId !== 'intro') return;
        void durable(() => submitStoryCommand(opened, { ...storyGuard(story), action: 'COMPLETE_SCENE', source: 'user', skipped: true },
          { paused: true, elapsedMs: 0, now: new Date().toISOString() }), { path: '/craft', exhibitId: null });
      },
    };
    page = factories[parsed.route.path](host, context); host.setAttribute('data-route', parsed.route.path);
    update(opened.getState());
    for (const anchor of Array.from(nav.querySelectorAll('a'))) {
      if (anchor.getAttribute('href') === `#${parsed.route.path}`) anchor.setAttribute('aria-current', 'page');
      else anchor.removeAttribute('aria-current');
    }
    setMenu(false); document.title = `影作 · ${host.querySelector('h1')?.textContent ?? '一幕团圆'}`;
    notify(parsed.invalid ? '这个地址暂未开放，已回到剧场首页。' : '');
    if (changed) { const title = host.querySelector('h1'); title?.setAttribute('tabindex', '-1'); title?.focus(); window.scrollTo(0, 0); }
    const state = opened.getState();
    if (state.project && !['unsupported', 'recovery', 'conflict'].includes(state.status) && state.project.lastRoute !== parsed.route.path) {
      void run(() => opened.edit({ type: 'ROUTE', route: parsed.route.path }));
    }
    return true;
  });
  unsubscribe = opened.subscribe(update);
  router.start();
  life.on(menu, 'click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
  life.on(get<HTMLElement>('open-project-tools'), 'click', () => showTools(!tools.hasAttribute('open')));
  life.on(tools.querySelector('summary')!, 'click', event => { event.preventDefault(); showTools(false); });
  life.on(get<HTMLElement>('reload-project'), 'click', () => { window.location.reload(); });
  life.on(document.querySelector('.skip-link')!, 'click', event => { event.preventDefault(); main.focus(); });
  life.on(get<HTMLElement>('export-project'), 'click', () => {
    try { const project = opened.getExportProject(); if (!project) throw new Error('没有可导出的作品。'); saveDownload(exportProjectJSON(project), 'yingzuo-project.json'); }
    catch (error) { report(error); }
  });
  life.on(get<HTMLElement>('export-raw'), 'click', () => { void run(async () => saveDownload(serializeRawRecords(await opened.readRaw()), 'yingzuo-raw-records.json')); });
  life.on(get<HTMLElement>('retry-save'), 'click', () => { void durable(() => opened.retryPending(get<HTMLInputElement>('archive-ack').checked)); });
  life.on(get<HTMLElement>('cancel-pending'), 'click', () => { void run(async () => { await opened.cancelPending(); operation.textContent = ''; notify(''); }); });
  life.on(get<HTMLElement>('continue-memory'), 'click', () => { void run(() => opened.continuePendingUnsaved()); });
  life.on(get<HTMLElement>('new-project'), 'click', () => { void durable(() => opened.newProject(undefined, get<HTMLInputElement>('archive-ack').checked), { path: '/', exhibitId: null }); });
  const input = get<HTMLInputElement>('import-project');
  life.on(input, 'change', () => {
    const file = input.files?.[0]; if (!file) return;
    // Include FileReader in the navigation lock, so a late read cannot replace a later project.
    void durable(async () => {
      const project = await readProjectFile(file);
      if (disposed) return { ok: false, error: new Error('页面已离开，未导入作品。') };
      return opened.newProject(project, get<HTMLInputElement>('archive-ack').checked);
    }, { path: '/', exhibitId: null }).then(() => { input.value = ''; });
  });
}

function dispose() {
  if (disposed) return;
  disposed = true; life.dispose(); router?.dispose(); page?.dispose(); unsubscribe();
  downloads.forEach(cleanup => cleanup()); store?.dispose();
}
window.addEventListener('pagehide', dispose);
function onPageShow(event: PageTransitionEvent) { if (event.persisted) window.location.reload(); }
window.addEventListener('pageshow', onPageShow);
if (import.meta.hot) import.meta.hot.dispose(() => {
  dispose(); window.removeEventListener('pagehide', dispose); window.removeEventListener('pageshow', onPageShow);
});
void mount().catch(error => { notify('页面暂时无法启动，已保留可读介绍。'); report(error); });
