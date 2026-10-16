import type { LightStudy } from './canvas';
import { downloadSample } from './download';
import { openProbeDatabase, readProbe, writeProbe } from './storage';
import type { ProbeSnapshot } from './storage';

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function mountStorageProbe(study: LightStudy) {
  const status = document.getElementById('storage-status')!;
  const value = document.getElementById('stored-value')!;
  const save = document.getElementById('save-probe') as HTMLButtonElement;
  const abort = document.getElementById('abort-probe') as HTMLButtonElement;
  const exportButton = document.getElementById('export-probe') as HTMLButtonElement;
  const exportStatus = document.getElementById('export-status')!;
  let database: IDBDatabase | null = null;
  let snapshot: ProbeSnapshot = { current: null, backup: null };
  let busy = false;
  let disposed = false;
  let generation = 0;
  let exportCleanup = () => undefined as void;

  function message(text: string, state: string) {
    if (disposed) return;
    status.textContent = text;
    status.setAttribute('data-state', state);
  }
  function buttons() {
    save.disabled = busy || !database;
    abort.disabled = busy || !database || !snapshot.current;
    exportButton.disabled = false;
  }
  const showSnapshot = () => { value.textContent = JSON.stringify(snapshot, null, 2); };
  const onChange = () => {
    generation += 1;
    if (!busy) message(database ? '当前灯位尚未保存。' : '当前灯位只保留在页面内，可导出；本地存储不可用。', 'unsaved');
  };

  async function initialize() {
    message('正在检查本地存储…', 'loading');
    const initialGeneration = generation;
    try {
      // Access can itself throw in restricted browser contexts.
      const opened = await openProbeDatabase(window.indexedDB);
      if (disposed) { opened.close(); return; }
      database = opened;
      snapshot = await readProbe(opened);
      if (disposed) return;
      showSnapshot();
      if (snapshot.current && generation === initialGeneration) {
        study.setSample(snapshot.current);
        message(`已恢复测试记录（第 ${snapshot.current.revision} 版）。`, 'restored');
      } else if (generation !== initialGeneration) {
        message('当前灯位尚未保存；已读入的测试记录显示在下方。', 'unsaved');
      } else message('本地存储可用，尚无测试记录。调整灯位后可以保存。', 'ready');
    } catch (error) {
      database?.close(); database = null;
      message(`${errorMessage(error)} 当前灯位未保存，仍可导出测试记录。`, 'error');
    }
    if (!disposed) buttons();
  }

  async function run(mode: 'save' | 'abort') {
    if (busy || !database || disposed) return;
    busy = true; buttons();
    const startGeneration = generation;
    const sample = study.getSample();
    message(mode === 'save' ? '正在提交，等待事务完成…' : '正在中止测试写入并核对回滚…', 'pending');
    try {
      if (mode === 'save') {
        const committed = await writeProbe(database, sample, snapshot.current?.revision ?? 0);
        // Keep this transaction's exact revision. A separate read could silently
        // adopt another tab's newer write and defeat the next conflict check.
        snapshot = { current: committed, backup: snapshot.current };
        if (disposed) return;
        showSnapshot();
        message(generation === startGeneration
          ? `已保存测试记录（第 ${snapshot.current!.revision} 版），刷新可恢复。`
          : '先前灯位已提交；操作期间的新灯位尚未保存。', generation === startGeneration ? 'saved' : 'unsaved');
      } else {
        const before = await readProbe(database);
        let aborted = false;
        try {
          await writeProbe(database, { ...sample, lampX: sample.lampX === 99 ? 1 : 99 }, snapshot.current?.revision ?? 0, true);
        } catch (error) {
          // Error subclass instanceof is not reliable after transpilation in IE11.
          if (error && typeof error === 'object' && 'code' in error && error.code === 'aborted') aborted = true;
          else throw error;
        }
        const after = await readProbe(database);
        if (!aborted) throw new Error('测试写入未按预期中止，请保留本页记录。');
        if (JSON.stringify(before) !== JSON.stringify(after)) {
          throw new Error('检查期间记录发生变化，可能有其他页面写入；本次无法确认回滚结果，请关闭其他检查页后刷新重试。');
        }
        if (disposed) return;
        snapshot = after; showSnapshot();
        const currentMatches = snapshot.current?.lampX === study.getSample().lampX && snapshot.current.distance === study.getSample().distance;
        message(`回滚验证通过：旧记录与备份均未改变。${currentMatches ? '' : '当前灯位仍未保存。'}`, 'rollback-passed');
      }
    } catch (error) {
      message(`${errorMessage(error)} 当前灯位已保留，可导出后重试。`, 'error');
    } finally {
      busy = false;
      if (!disposed) buttons();
    }
  }

  const saveClick = () => { void run('save'); };
  const abortClick = () => { void run('abort'); };
  const exportClick = () => {
    try {
      exportCleanup();
      exportCleanup = downloadSample({ kind: 'yingzuo-light-probe', schemaVersion: 1, sample: study.getSample(), lastRead: snapshot });
      exportStatus.textContent = '已向浏览器发起下载，请检查下载结果。';
    } catch (error) { exportStatus.textContent = `导出失败：${errorMessage(error)}`; }
  };
  save.addEventListener('click', saveClick);
  abort.addEventListener('click', abortClick);
  exportButton.addEventListener('click', exportClick);
  buttons();
  void initialize();
  return {
    onChange,
    dispose() {
      disposed = true;
      database?.close();
      exportCleanup();
      save.removeEventListener('click', saveClick);
      abort.removeEventListener('click', abortClick);
      exportButton.removeEventListener('click', exportClick);
    },
  };
}
