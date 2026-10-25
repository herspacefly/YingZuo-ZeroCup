import { createProject } from '../domain/defaults';
import { AUTOSAVE_DELAY_MS, AUTOSAVE_MAX_WAIT_MS } from '../domain/limits';
import type { ProjectBaseline, ProjectV1 } from '../domain/types';
import { validateProject } from '../domain/validation';
import { importedAsNew } from '../persistence/project-file';
import { baselineOf, decodeStoredProject, StorageError } from '../persistence/storage';
import type { LoadResult, ProjectStorage } from '../persistence/storage';
import { applyEditorCommand } from './commands';
import type { EditorCommand } from './commands';

type StoragePort = Pick<ProjectStorage, 'load' | 'save' | 'replace' | 'promoteBackup' | 'startAfterCorruption' | 'readRaw' | 'close'> & Partial<Pick<ProjectStorage, 'resetLocalHistory'>>;
export type StoreStatus = 'loading' | 'saved' | 'unsaved' | 'saving' | 'error' | 'conflict' | 'recovery' | 'unsupported' | 'memory' | 'closed';
export interface StoreState {
  project: ProjectV1 | null; status: StoreStatus; message: string; error: Error | null;
  recovery: LoadResult | null; hasPending: boolean; pendingKind: 'save' | 'replace' | null; queuedEdits: number; paused: true;
}
export type SaveResult = { ok: true; project: ProjectV1 | null } | { ok: false; error: Error };
interface StoreEnvironment { writerId: string; createId: () => string; now: () => string }
interface PendingSave {
  kind: 'save' | 'replace'; candidate: ProjectV1; expected: ProjectBaseline | null; acknowledgePrevious: boolean;
}

/** All editing and durable commands share this queue. Timers request a flush, never capture a Project. */
export class ProjectStore {
  private project: ProjectV1 | null = null;
  private baseline: ProjectBaseline | null = null;
  private status: StoreStatus = 'loading';
  private message = '正在读取作品…';
  private error: Error | null = null;
  private recovery: LoadResult | null = null;
  private pending: PendingSave | null = null;
  private deferredEdits: EditorCommand[] = [];
  private dirty = false;
  private disposed = false;
  private resetting = false;
  private resetPromise: Promise<SaveResult> | null = null;
  private timerGeneration = 0;
  private debounce: ReturnType<typeof setTimeout> | undefined;
  private maximum: ReturnType<typeof setTimeout> | undefined;
  private tail: Promise<unknown> = Promise.resolve();
  private listeners = new Set<(state: StoreState) => void>();
  private constructor(private readonly storage: StoragePort, private readonly environment: StoreEnvironment) {}
  /** A complete command-compatible fork with no IndexedDB, downloads or real writer. */
  static preview(project:ProjectV1):ProjectStore {
    const unavailable=async():Promise<never>=>{throw new Error('试练不会替换、恢复或导出正式作品。');};
    const store=new ProjectStore({load:unavailable,save:async candidate=>validateProject(candidate),replace:unavailable,
      promoteBackup:unavailable,startAfterCorruption:unavailable,readRaw:unavailable,close(){}},
      {writerId:project.writerId,createId:()=>project.projectId,now:()=>project.savedAt});
    store.accept(validateProject(project));return store;
  }
  static async open(storage: StoragePort, environment: StoreEnvironment): Promise<ProjectStore> {
    const store = new ProjectStore(storage, environment);
    await store.initialize();
    return store;
  }
  getState(): StoreState {
    return { project: this.project ? validateProject(this.project) : null, status: this.status,
      message: this.message, error: this.error, recovery: this.recovery,
      hasPending: !!this.pending, pendingKind: this.pending?.kind ?? null, queuedEdits: this.deferredEdits.length, paused: true };
  }
  /** Export the exact unsaved candidate plus later queued edits, without applying a story decision. */
  getExportProject(): ProjectV1 | null {
    let snapshot = this.pending ? validateProject(this.pending.candidate) : this.project ? validateProject(this.project) : null;
    if (snapshot) for (const command of this.deferredEdits) snapshot = applyEditorCommand(snapshot, command);
    return snapshot;
  }
  subscribe(listener: (state: StoreState) => void): () => void {
    this.listeners.add(listener); listener(this.getState());
    return () => { this.listeners.delete(listener); };
  }
  private emit() {
    if (this.disposed) return;
    this.listeners.forEach(listener => {
      try { listener(this.getState()); }
      catch (error) { console.error('ProjectStore subscriber failed after state update', error); }
    });
  }
  private enqueue<T>(operation: () => T | Promise<T>, duringReset = false): Promise<T> {
    if (this.resetting && !duringReset) return Promise.reject(new StorageError('invalid', '正在清除本机历史，操作已暂停。'));
    const result = this.tail.then(() => {
      if (this.disposed) throw new StorageError('closed', '页面已离开，旧操作未执行。');
      return operation();
    });
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
  private fail(error: unknown): SaveResult & { ok: false } {
    const failure = error instanceof Error ? error : new Error(String(error));
    this.error = failure;
    const code = 'code' in failure ? failure.code : undefined;
    this.status = code === 'conflict' ? 'conflict' : code === 'unsupported-version' ? 'unsupported' : 'error';
    this.message = `${failure.message} 自动覆盖已暂停；可导出当前稿或明确重试。`;
    this.cancelTimers(); this.emit();
    return { ok: false, error: failure };
  }
  private async initialize() {
    try {
      this.recovery = await this.storage.load();
      if (this.recovery.kind === 'ready') {
        this.accept(this.recovery.project!);
        this.message = this.project!.story ? '已恢复剧情检查点；从当前短节点起点暂停接续。' : '已恢复编辑草稿，尚未开演。';
      } else if (this.recovery.kind === 'empty') {
        this.project = createProject(this.environment.createId(), this.environment.writerId, this.environment.now());
        this.dirty = true;
        await this.persistCurrent();
      } else {
        this.status = this.recovery.kind === 'unsupported' ? 'unsupported' : 'recovery';
        this.message = this.recovery.kind === 'unsupported' ? `${this.recovery.problem} 原稿保留，已停止覆盖。` :
          this.recovery.kind === 'recoverable' ? '草稿损坏，找到有效备份。请先导出原稿，再明确选择恢复。' : '草稿与备份均不可用。可导出原始记录后明确新建。';
      }
    } catch (error) {
      if (!(error instanceof StorageError && error.code === 'unsupported-version')) {
        this.project = createProject(this.environment.createId(), this.environment.writerId, this.environment.now());
        this.dirty = true;
      }
      this.fail(error);
    }
  }
  private accept(project: ProjectV1) {
    this.project = validateProject(project); this.baseline = baselineOf(project); this.dirty = false;
    this.error = null; this.status = 'saved'; this.message = '已保存到本机。';
  }
  private cancelTimers() {
    clearTimeout(this.debounce); clearTimeout(this.maximum);
    this.debounce = undefined; this.maximum = undefined; this.timerGeneration += 1;
  }
  private schedule() {
    if (this.disposed || this.resetting || ['error', 'conflict', 'unsupported', 'memory'].includes(this.status) || this.pending) return;
    clearTimeout(this.debounce);
    const generation = this.timerGeneration;
    const requestFlush = () => {
      if (this.disposed || generation !== this.timerGeneration) return;
      // flush handles persistence failures in state; only disposal of a queued operation can reject.
      void this.flush().catch(error => { if (!this.disposed) this.fail(error); });
    };
    this.debounce = setTimeout(requestFlush, AUTOSAVE_DELAY_MS);
    if (this.maximum === undefined) this.maximum = setTimeout(requestFlush, AUTOSAVE_MAX_WAIT_MS);
  }
  edit(command: EditorCommand): Promise<void> {
    return this.enqueue(() => {
      if (this.pending) {
        let preview = validateProject(this.pending.candidate);
        for (const queued of this.deferredEdits) preview = applyEditorCommand(preview, queued);
        applyEditorCommand(preview, command); // Reject invalid edits before they can enter a deferred queue.
        this.deferredEdits.push(JSON.parse(JSON.stringify(command)) as EditorCommand);
        this.message = '前一进度等待处理，新编辑已排队，尚未保存。'; this.emit(); return;
      }
      if (!this.project) throw new StorageError('invalid', '请先处理存档恢复，尚未编辑原稿。');
      this.project = applyEditorCommand(this.project, command); this.dirty = true;
      if (!['error', 'conflict', 'unsupported', 'memory'].includes(this.status)) { this.status = 'unsaved'; this.message = '有更改，尚未保存。'; }
      this.schedule(); this.emit();
    });
  }
  flush(): Promise<SaveResult> {
    this.cancelTimers();
    return this.enqueue(() => { this.cancelTimers(); return this.persistCurrent(); });
  }
  private async persistCurrent(): Promise<SaveResult> {
    if (!this.project) return this.fail(new StorageError('invalid', '没有可保存的当前稿。'));
    if (this.pending) return this.fail(new StorageError('invalid', '请先重试或明确保留未保存进度。'));
    if (this.status === 'conflict' || this.status === 'unsupported') return { ok: false, error: this.error ?? new Error(this.message) };
    if (!this.dirty) return { ok: true, project: validateProject(this.project) };
    this.status = 'saving'; this.message = '正在保存，等待整个事务完成…'; this.emit();
    try {
      const committed = await this.storage.save(this.project, this.baseline);
      if (this.disposed) return { ok: true, project: committed };
      this.accept(committed); this.emit();
      return { ok: true, project: validateProject(committed) };
    } catch (error) { return this.fail(error); }
  }
  /** T15 supplies the pure guarded reducer. null is a stale/idempotent command and does not write. */
  commit(reducer: (project: ProjectV1) => ProjectV1 | null): Promise<SaveResult> {
    this.cancelTimers();
    return this.enqueue(async () => {
      this.cancelTimers();
      if (this.pending || !this.project || this.status === 'conflict' || this.status === 'unsupported') {
        return { ok: false, error: this.error ?? new Error('请先处理待保存进度或存档问题。') };
      }
      let candidate: ProjectV1 | null;
      try { candidate = reducer(validateProject(this.project)); if (candidate) candidate = validateProject(candidate); }
      catch (error) { return this.fail(error); }
      if (!candidate) { this.schedule(); return { ok: true, project: validateProject(this.project) }; }
      if (candidate.projectId !== this.project.projectId) return this.fail(new StorageError('invalid', '新项目必须走归档替换入口。'));
      this.pending = { kind: 'save', candidate, expected: this.baseline, acknowledgePrevious: false };
      return this.persistPending();
    });
  }
  private async persistPending(): Promise<SaveResult> {
    const pending = this.pending!;
    this.status = 'saving'; this.message = '正在提交这一步，尚未切换进度…'; this.emit();
    try {
      const committed = pending.kind === 'replace'
        ? await this.storage.replace(pending.candidate, pending.expected!, pending.acknowledgePrevious)
        : await this.storage.save(pending.candidate, pending.expected);
      if (this.disposed) return { ok: true, project: committed };
      this.pending = null; this.accept(committed); this.drainEdits(); this.emit();
      return { ok: true, project: validateProject(committed) };
    } catch (error) { return this.fail(error); }
  }
  retryPending(acknowledgePrevious = false): Promise<SaveResult> {
    return this.enqueue(() => {
      if (!this.pending) return this.persistCurrent();
      if (acknowledgePrevious) this.pending.acknowledgePrevious = true;
      return this.persistPending();
    });
  }
  continuePendingUnsaved(): Promise<void> {
    return this.enqueue(() => {
      if (!this.pending || this.pending.kind === 'replace') throw new StorageError('invalid', '没有可明确保留在内存的剧情候选；项目替换需先完成归档。');
      this.project = validateProject(this.pending.candidate); this.pending = null; this.dirty = true;
      this.status = 'memory'; this.message = '本段仅保留在当前页面，刷新会丢失；请导出或稍后明确保存。';
      this.drainEdits(); this.emit();
    });
  }
  cancelPending(): Promise<void> {
    return this.enqueue(() => {
      if (!this.pending) return;
      this.pending = null;
      const protectedState = this.status === 'conflict' || this.status === 'unsupported';
      if (!protectedState) {
        this.status = this.dirty ? 'unsaved' : 'saved'; this.error = null;
        this.message = this.dirty ? '本次待提交操作已取消，当前编辑尚未保存。' : '本次待提交操作已取消，保留原项目。';
      }
      this.drainEdits();
      if (this.dirty) this.schedule();
      this.emit();
    });
  }
  private drainEdits() {
    const edits = this.deferredEdits.splice(0);
    for (const command of edits) this.project = applyEditorCommand(this.project!, command);
    if (edits.length) {
      this.dirty = true;
      if (this.status === 'saved') { this.status = 'unsaved'; this.message = '进度已保存，后续编辑尚未保存。'; }
      this.schedule();
    }
  }
  newProject(imported?: ProjectV1, acknowledgePrevious = false): Promise<SaveResult> {
    const importSnapshot = imported ? validateProject(imported) : undefined;
    this.cancelTimers();
    return this.enqueue(async () => {
      this.cancelTimers();
      if (this.pending) return { ok: false, error: new Error('前一操作待处理，未新建项目。') };
      const saved = await this.persistCurrent();
      if (!saved.ok || !this.baseline) return saved;
      const candidate = importSnapshot
        ? importedAsNew(importSnapshot, this.environment.createId(), this.environment.writerId, this.environment.now())
        : createProject(this.environment.createId(), this.environment.writerId, this.environment.now());
      this.pending = { kind: 'replace', candidate, expected: this.baseline, acknowledgePrevious };
      return this.persistPending();
    });
  }
  restorePrevious(acknowledgePrevious: boolean): Promise<SaveResult> {
    this.cancelTimers();
    return this.enqueue(async () => {
      this.cancelTimers();
      if (this.pending) return { ok: false, error: new Error('请先处理待保存进度。') };
      const saved = await this.persistCurrent();
      if (!saved.ok || !this.baseline) return saved;
      try {
        const records = await this.storage.readRaw();
        const previous = decodeStoredProject(records.previousProject);
        this.pending = { kind: 'replace', candidate: previous, expected: this.baseline, acknowledgePrevious };
        return await this.persistPending();
      } catch (error) { return this.fail(error); }
    });
  }
  restoreBackup(acknowledgeQuarantine = false): Promise<SaveResult> {
    return this.enqueue(async () => {
      if (!this.recovery || this.recovery.kind !== 'recoverable') return { ok: false, error: new Error('没有已确认的恢复候选。') };
      try {
        const committed = await this.storage.promoteBackup(this.recovery.observation, acknowledgeQuarantine);
        if (!this.disposed) { this.accept(committed); this.recovery = null; this.emit(); }
        return { ok: true, project: committed };
      } catch (error) { return this.fail(error); }
    });
  }
  startAfterCorruption(acknowledgeQuarantine = false): Promise<SaveResult> {
    return this.enqueue(async () => {
      if (!this.recovery || this.recovery.kind !== 'corrupt') return { ok: false, error: new Error('请先检查原稿与备份。') };
      try {
        const candidate = createProject(this.environment.createId(), this.environment.writerId, this.environment.now());
        const committed = await this.storage.startAfterCorruption(candidate, this.recovery.observation, acknowledgeQuarantine);
        if (!this.disposed) { this.accept(committed); this.recovery = null; this.emit(); }
        return { ok: true, project: committed };
      } catch (error) { return this.fail(error); }
    });
  }
  /** Only an explicit user action calls this. It rereads, then still uses a transaction CAS. */
  takeOver(): Promise<SaveResult> {
    return this.enqueue(async () => {
      if (!this.project || this.pending) return { ok: false, error: new Error('请先处理待提交候选。') };
      try {
        const fresh = await this.storage.load();
        if (fresh.kind !== 'ready' || fresh.project!.projectId !== this.project.projectId) {
          throw new StorageError('conflict', '存储中的项目身份或格式已变化，请导出双方项目；未自动接管。', fresh.records);
        }
        const candidate = { ...this.project, saveRevision: fresh.project!.saveRevision };
        this.pending = { kind: 'save', candidate, expected: baselineOf(fresh.project!), acknowledgePrevious: false };
        return await this.persistPending();
      } catch (error) { return this.fail(error); }
    });
  }
  readRaw() { return this.storage.readRaw(); }
  /** Fence new work immediately, drain already-started work, then atomically
   * replace all local history. Failure retains the current/exportable candidate. */
  resetLocalHistory(): Promise<SaveResult> {
    if (this.resetPromise) return this.resetPromise;
    this.cancelTimers(); this.resetting = true;
    this.status = 'saving'; this.message = '正在清除本机历史，等待存储事务完成…'; this.emit();
    const operation = this.enqueue(async (): Promise<SaveResult> => {
      this.cancelTimers();
      try {
        if (!this.storage.resetLocalHistory) throw new StorageError('unavailable', '当前存储不支持清理，未删除任何历史。');
        const candidate = createProject(this.environment.createId(), this.environment.writerId, this.environment.now());
        const committed = await this.storage.resetLocalHistory(candidate);
        if (!this.disposed) {
          this.pending = null; this.deferredEdits = []; this.recovery = null;
          this.accept(committed); this.message = '本机历史已清除，已创建全新作品。'; this.emit();
        }
        return { ok: true, project: committed };
      } catch (error) { return this.fail(error); }
      finally { this.resetting = false; }
    }, true);
    this.resetPromise = operation;
    void operation.then(() => { this.resetPromise = null; }, () => { this.resetting = false; this.resetPromise = null; });
    return operation;
  }
  dispose() {
    this.disposed = true; this.cancelTimers(); this.listeners.clear(); this.status = 'closed';
    this.storage.close();
  }
}
