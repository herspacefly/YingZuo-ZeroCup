import '../../styles/probe.css';
import './style.css';
import { newIdentifier } from '../../app/identity';
import { ProjectStore } from '../../app/store';
import type { SaveResult, StoreState } from '../../app/store';
import type { PaletteId, PatternId } from '../../domain/types';
import { downloadJSON, exportProjectJSON, readProjectFile } from '../../persistence/project-file';
import { ProjectStorage, serializeRawRecords } from '../../persistence/storage';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const status = element('project-status');
const operation = element('project-operation');
const title = element<HTMLInputElement>('project-title');
const palette = element<HTMLSelectElement>('project-palette');
const pattern = element<HTMLSelectElement>('project-pattern');
const fileInput = element<HTMLInputElement>('project-import');
const archiveAck = () => element<HTMLInputElement>('archive-ack').checked;
const quarantineAck = () => element<HTMLInputElement>('quarantine-ack').checked;
const runtime = element('project-runtime');
const mode = import.meta.env.LEGACY ? 'legacy' : 'modern';
runtime.textContent = `当前入口：${mode}。正式作品存档检查；真实 IE 仍需单独验收。`;
runtime.setAttribute('data-entry', mode);
let store: ProjectStore | null = null;
let disposed = false;
let readingFile = false;
let downloadCleanup = () => undefined as void;
const cleanups: (() => void)[] = [];
function on(element: HTMLElement, event: string, listener: EventListener) {
  element.addEventListener(event, listener); cleanups.push(() => element.removeEventListener(event, listener));
}
function setDisabled(id: string, disabled: boolean) { element<HTMLButtonElement>(id).disabled = disabled; }
function render(state: StoreState) {
  if (disposed) return;
  status.textContent = state.message; status.setAttribute('data-state', state.status);
  element('project-id').textContent = state.project?.projectId ?? '未覆盖原始记录';
  element('project-revision').textContent = state.project ? String(state.project.saveRevision) : '—';
  element('project-node').textContent = state.project?.story ? `${state.project.story.nodeId} · 恢复为暂停` : '尚未开演';
  const editorProject = store?.getExportProject() ?? state.project;
  element('project-editor-title').textContent = state.hasPending ? '编辑待提交稿（尚未应用）' : '编辑草稿';
  element<HTMLFieldSetElement>('project-editor').disabled = !editorProject || state.status === 'unsupported';
  if (editorProject) { title.value = editorProject.title; palette.value = editorProject.appearance.paletteId; pattern.value = editorProject.appearance.patternId; }
  const saving = state.status === 'saving';
  setDisabled('project-save', !state.project || saving || state.hasPending || ['conflict', 'unsupported'].includes(state.status));
  setDisabled('project-retry', saving || (!state.hasPending && !['error', 'memory', 'unsaved'].includes(state.status)));
  setDisabled('project-cancel', saving || !state.hasPending);
  setDisabled('project-memory', saving || state.pendingKind !== 'save');
  setDisabled('project-takeover', state.status !== 'conflict' || state.hasPending);
  setDisabled('project-export', !store?.getExportProject());
  setDisabled('project-export-raw', false);
  for (const id of ['project-new', 'project-previous']) setDisabled(id, !state.project || saving || state.hasPending || ['conflict', 'unsupported'].includes(state.status));
  fileInput.disabled = !state.project || saving || state.hasPending || readingFile || ['conflict', 'unsupported'].includes(state.status);
  setDisabled('project-recover', saving || state.recovery?.kind !== 'recoverable');
  setDisabled('project-fresh', saving || state.recovery?.kind !== 'corrupt');
  const exportable = store?.getExportProject();
  element<HTMLTextAreaElement>('project-json').value = exportable ? exportProjectJSON(exportable) : '原始记录已保留，可通过“导出存储原始记录”取得诊断包。';
}
async function run(job: () => Promise<unknown>) {
  try {
    const result = await job();
    if (!disposed && result && typeof result === 'object' && 'ok' in result && !(result as SaveResult).ok) {
      operation.textContent = (result as SaveResult & { ok: false }).error.message;
    } else if (!disposed) operation.textContent = '';
  } catch (error) { if (!disposed) operation.textContent = `操作未完成：${error instanceof Error ? error.message : String(error)}`; }
}
function requestDownload(text: string, filename: string) {
  downloadCleanup(); downloadCleanup = downloadJSON(text, filename);
  operation.textContent = '已向浏览器发起下载请求，请检查下载结果。';
}
async function mount() {
  try {
    const writerId = newIdentifier('writer');
    let factory: IDBFactory | undefined;
    try { factory = window.indexedDB; } catch { factory = undefined; }
    const storage = new ProjectStorage(factory, { writerId, now: () => new Date().toISOString() });
    const opened = await ProjectStore.open(storage, { writerId, createId: () => newIdentifier('project'), now: () => new Date().toISOString() });
    if (disposed) { opened.dispose(); return; }
    store = opened;
    on(title, 'input', () => { const value = title.value; void run(() => store!.edit({ type: 'RENAME', title: value })); });
    on(palette, 'change', () => {
      const paletteId = palette.value as PaletteId;
      void run(() => store!.edit({ type: 'PALETTE', paletteId }));
    });
    on(pattern, 'change', () => {
      const patternId = pattern.value as PatternId;
      void run(() => store!.edit({ type: 'PATTERN', patternId }));
    });
    on(element('project-save'), 'click', () => { void run(() => store!.flush()); });
    on(element('project-retry'), 'click', () => { void run(() => store!.retryPending(archiveAck())); });
    on(element('project-cancel'), 'click', () => { void run(() => store!.cancelPending()); });
    on(element('project-memory'), 'click', () => { void run(() => store!.continuePendingUnsaved()); });
    on(element('project-takeover'), 'click', () => { void run(() => store!.takeOver()); });
    on(element('project-new'), 'click', () => { void run(() => store!.newProject(undefined, archiveAck())); });
    on(element('project-previous'), 'click', () => { void run(() => store!.restorePrevious(archiveAck())); });
    on(element('project-recover'), 'click', () => { void run(() => store!.restoreBackup(quarantineAck())); });
    on(element('project-fresh'), 'click', () => { void run(() => store!.startAfterCorruption(quarantineAck())); });
    on(element('project-export'), 'click', () => {
      try { requestDownload(exportProjectJSON(store!.getExportProject()!), 'yingzuo-project.json'); }
      catch (error) { operation.textContent = `导出失败：${error instanceof Error ? error.message : String(error)}`; }
    });
    on(element('project-export-raw'), 'click', () => {
      void (async () => {
        try {
          const records = await store!.readRaw();
          if (!disposed) requestDownload(serializeRawRecords(records), 'yingzuo-raw-snapshots.json');
        } catch (error) { if (!disposed) operation.textContent = `原始记录未导出：${error instanceof Error ? error.message : String(error)}`; }
      })();
    });
    on(fileInput, 'change', () => {
      const file = fileInput.files?.[0]; if (!file || readingFile) return;
      readingFile = true; fileInput.disabled = true;
      void run(async () => {
        try {
          const imported = await readProjectFile(file);
          if (!disposed) return await store!.newProject(imported, archiveAck());
        } finally { readingFile = false; fileInput.value = ''; if (!disposed) render(store!.getState()); }
      });
    });
    cleanups.push(store.subscribe(render));
  } catch (error) {
    if (!disposed) { status.textContent = `初始化未完成：${error instanceof Error ? error.message : String(error)}`; status.setAttribute('data-state', 'error'); }
  }
}
void mount();
function dispose() {
  disposed = true; cleanups.splice(0).forEach(cleanup => cleanup()); downloadCleanup(); store?.dispose();
}
function pageShow(event: PageTransitionEvent) { if (event.persisted) window.location.reload(); }
window.addEventListener('pagehide', dispose); window.addEventListener('pageshow', pageShow);
if (import.meta.hot) import.meta.hot.dispose(() => {
  dispose(); window.removeEventListener('pagehide', dispose); window.removeEventListener('pageshow', pageShow);
});
