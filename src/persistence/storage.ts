import { parseProjectJSON, serializeProject } from '../domain/migrations';
import type { ProjectBaseline, ProjectV1 } from '../domain/types';
import { validateProject } from '../domain/validation';

export const PROJECT_DATABASE = 'yingzuo-v1';
export const SNAPSHOT_STORE = 'snapshots';
const KEYS = ['draft', 'backup', 'previous-project', 'raw-invalid'] as const;
export interface RawRecords { draft: unknown; backup: unknown; previousProject: unknown; rawInvalid: unknown }
export interface Observation { draftToken: string; backupToken: string; rawInvalidToken: string }
export type LoadResult = {
  kind: 'empty' | 'ready' | 'recoverable' | 'corrupt' | 'unsupported';
  records: RawRecords; observation: Observation; project: ProjectV1 | null; backup: ProjectV1 | null;
  problem: string | null;
};
export type StorageErrorCode = 'unavailable' | 'blocked' | 'timeout' | 'closed' | 'invalid' | 'unsupported-version' |
  'conflict' | 'quota' | 'aborted' | 'storage' | 'archive-exists' | 'quarantine-exists';
export class StorageError extends Error {
  constructor(readonly code: StorageErrorCode, message: string, readonly records?: RawRecords) {
    super(message); this.name = 'StorageError';
  }
}
export function baselineOf(project: ProjectV1): ProjectBaseline {
  return { projectId: project.projectId, saveRevision: project.saveRevision, contentToken: serializeProject(project) };
}
function errorCode(error: unknown): string | undefined {
  return error && typeof error === 'object' && 'code' in error ? String(error.code) : undefined;
}
function storageFailure(error: unknown): Error {
  if (error instanceof Error && 'code' in error && typeof error.code === 'string') return error;
  const name = error && typeof error === 'object' && 'name' in error ? String(error.name) : 'UnknownError';
  const code = name === 'QuotaExceededError' ? 'quota' : name === 'AbortError' ? 'aborted' :
    name === 'SecurityError' ? 'unavailable' : 'storage';
  return new StorageError(code, `本次未保存（${name}），页面内的作品仍保留。`);
}
function token(raw: unknown): string {
  if (raw === undefined) return 'absent';
  if (typeof raw === 'string') return `string:${raw}`;
  // Corrupted structured-clone values may contain NaN/undefined/holes/cycles.
  // Plain stringify would collapse different raw originals to the same CAS token.
  const seen = new Map<object, number>();
  function encode(value: unknown): unknown {
    if (value === null) return ['null'];
    if (typeof value === 'number') return ['number', Object.is(value, -0) ? '-0' : String(value)];
    if (['string', 'boolean', 'undefined', 'bigint'].includes(typeof value)) return [typeof value, String(value)];
    if (!value || typeof value !== 'object') throw new StorageError('invalid', '原始记录类型无法安全比较，已停止覆盖。');
    if (seen.has(value)) return ['ref', seen.get(value)];
    const identity = seen.size; seen.set(value, identity);
    const array = Array.isArray(value);
    const prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) {
      throw new StorageError('invalid', '原始记录含无法安全恢复的对象，已停止覆盖，请保留浏览器数据。');
    }
    return [array ? 'array' : 'object', identity, array ? value.length : null,
      Object.getOwnPropertyNames(value).filter(key => !(array && key === 'length')).map(key => {
        const property = Object.getOwnPropertyDescriptor(value, key)!;
        if (!('value' in property)) throw new StorageError('invalid', '原始记录含访问器，已停止覆盖。');
        return [key, encode(property.value)];
      })];
  }
  return `value:${JSON.stringify(encode(raw))}`;
}
export function decodeStoredProject(raw: unknown): ProjectV1 {
  if (raw === undefined) throw new StorageError('invalid', '没有项目记录。');
  return typeof raw === 'string' ? parseProjectJSON(raw) : validateProject(raw);
}
function inspect(raw: unknown): { project: ProjectV1 | null; unsupported: boolean; problem: string | null } {
  try { return { project: decodeStoredProject(raw), unsupported: false, problem: null }; }
  catch (error) {
    return { project: null, unsupported: ['unsupported-version', 'too-large'].includes(errorCode(error) ?? ''),
      problem: error instanceof Error ? error.message : String(error) };
  }
}
function observationOf(records: RawRecords): Observation {
  return { draftToken: token(records.draft), backupToken: token(records.backup), rawInvalidToken: token(records.rawInvalid) };
}
/** Lossless diagnostic export, including non-JSON corrupt structured-clone values. Not a Project file. */
export function serializeRawRecords(records: RawRecords): string {
  return JSON.stringify({ format: 'yingzuo-raw-snapshots-v1', encoding: 'typed-token-v1', records: {
    draft: token(records.draft), backup: token(records.backup), previousProject: token(records.previousProject), rawInvalid: token(records.rawInvalid),
  } }, null, 2);
}
function classify(records: RawRecords): LoadResult {
  const observation = observationOf(records);
  if (records.draft === undefined && records.backup === undefined) {
    return { kind: 'empty', records, observation, project: null, backup: null, problem: null };
  }
  const draft = inspect(records.draft);
  if (draft.project) return { kind: 'ready', records, observation, project: draft.project, backup: null, problem: null };
  if (draft.unsupported) return { kind: 'unsupported', records, observation, project: null, backup: null, problem: draft.problem };
  const backup = inspect(records.backup);
  if (backup.unsupported) return { kind: 'unsupported', records, observation, project: null, backup: null, problem: backup.problem };
  return { kind: backup.project ? 'recoverable' : 'corrupt', records, observation,
    project: null, backup: backup.project, problem: draft.problem };
}
function assertSupported(raw: unknown) {
  if (raw !== undefined) {
    const checked = inspect(raw);
    if (checked.unsupported) throw new StorageError('unsupported-version', `${checked.problem} 已停止覆盖。`);
  }
}
function checkExpected(records: RawRecords, expected: ProjectBaseline | null): ProjectV1 | null {
  assertSupported(records.draft);
  if (records.draft === undefined) {
    if (expected) throw new StorageError('conflict', '当前存档已变化，请先导出双方版本。', records);
    return null;
  }
  let current: ProjectV1;
  try { current = decodeStoredProject(records.draft); }
  catch { throw new StorageError('invalid', '现有草稿损坏，需先检查备份，未覆盖原稿。', records); }
  if (!expected || current.projectId !== expected.projectId || current.saveRevision !== expected.saveRevision || serializeProject(current) !== expected.contentToken) {
    throw new StorageError('conflict', '另一页面已保存新版本，当前稿未被覆盖；请导出双方版本后决定。', records);
  }
  return current;
}

interface StorageOptions { writerId: string; now: () => string; databaseName?: string }
interface Mutation<T> { result: T; writes: [typeof KEYS[number], unknown][]; deletes?: readonly typeof KEYS[number][] }

/** One serial entry per tab; cross-tab ownership is checked inside each readwrite transaction. */
export class ProjectStorage {
  private connection: IDBDatabase | null = null;
  private opening: Promise<IDBDatabase> | null = null;
  private tail: Promise<unknown> = Promise.resolve();
  private closed = false;
  constructor(private readonly factory: IDBFactory | undefined, private readonly options: StorageOptions) {}

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.tail.then(() => {
      if (this.closed) throw new StorageError('closed', '存储实例已关闭，未进行写入。');
      return operation();
    });
    // A failed operation must not poison later explicit retries. Its caller receives the original rejection.
    this.tail = result.then(() => undefined, () => undefined);
    return result;
  }
  private open(): Promise<IDBDatabase> {
    if (this.connection) return Promise.resolve(this.connection);
    if (this.opening) return this.opening;
    const opening = new Promise<IDBDatabase>((resolve, reject) => {
      if (!this.factory) { reject(new StorageError('unavailable', '本地存储不可用，作品仅保留在页面内。')); return; }
      let settled = false;
      const fail = (error: unknown) => {
        if (settled) return;
        settled = true; clearTimeout(timer); reject(storageFailure(error));
      };
      const timer = setTimeout(() => fail(new StorageError('timeout', '打开本地存储超时，请关闭其他页面后重试。')), 5000);
      let request: IDBOpenDBRequest;
      try { request = this.factory.open(this.options.databaseName ?? PROJECT_DATABASE, 1); }
      catch (error) { fail(error); return; }
      request.onblocked = () => fail(new StorageError('blocked', '其他页面阻止了存储升级，请关闭它们后重试。'));
      request.onupgradeneeded = () => {
        if (settled || this.closed) { request.transaction?.abort(); return; }
        request.result.createObjectStore(SNAPSHOT_STORE);
      };
      request.onerror = () => fail(request.error?.name === 'VersionError'
        ? new StorageError('unsupported-version', '存储数据库版本较新，已保留且拒绝降级。') : request.error);
      request.onsuccess = () => {
        const db = request.result;
        if (settled || this.closed) { db.close(); fail(new StorageError('closed', '页面已关闭，未加载存档。')); return; }
        settled = true; clearTimeout(timer);
        db.onversionchange = () => { db.close(); if (this.connection === db) this.connection = null; };
        this.connection = db; resolve(db);
      };
    });
    this.opening = opening;
    void opening.then(() => { this.opening = null; }, () => { this.opening = null; });
    return opening;
  }
  private async transaction<T>(mode: IDBTransactionMode, mutate: (records: RawRecords) => Mutation<T>): Promise<T> {
    const db = await this.open();
    if (this.closed) throw new StorageError('closed', '存储实例已关闭。');
    return new Promise((resolve, reject) => {
      let tx: IDBTransaction;
      try { tx = db.transaction(SNAPSHOT_STORE, mode); }
      catch (error) { reject(storageFailure(error)); return; }
      let failure: unknown;
      let outcome: Mutation<T> | undefined;
      tx.onabort = () => reject(storageFailure(failure ?? tx.error ?? new StorageError('aborted', '事务已中止，原记录保留。')));
      tx.oncomplete = () => {
        if (!outcome) { reject(new StorageError('storage', '事务未完成读取，未报告保存成功。')); return; }
        resolve(outcome.result);
      };
      const store = tx.objectStore(SNAPSHOT_STORE);
      const values: unknown[] = [];
      let remaining = KEYS.length;
      KEYS.forEach((key, index) => {
        const request = store.get(key);
        request.onsuccess = () => {
          values[index] = request.result;
          remaining -= 1;
          if (remaining !== 0) return;
          const records: RawRecords = { draft: values[0], backup: values[1], previousProject: values[2], rawInvalid: values[3] };
          try {
            outcome = mutate(records);
            for (const deleteKey of outcome.deletes ?? []) store.delete(deleteKey);
            for (const [writeKey, value] of outcome.writes) store.put(value, writeKey);
          } catch (error) { failure = error; tx.abort(); }
        };
      });
    });
  }
  load(): Promise<LoadResult> {
    return this.enqueue(() => this.transaction('readonly', records => ({ result: classify(records), writes: [] })));
  }
  readRaw(): Promise<RawRecords> {
    return this.enqueue(() => this.transaction('readonly', records => ({ result: records, writes: [] })));
  }
  private stamp(project: ProjectV1, revision: number): ProjectV1 {
    return parseProjectJSON(serializeProject({ ...project, saveRevision: revision,
      writerId: this.options.writerId, savedAt: this.options.now() }));
  }
  /** Explicit destructive reset, deliberately separate from archive/recovery paths.
   * Deletions and the new identity commit together, so old tabs fail their CAS. */
  resetLocalHistory(candidate: ProjectV1): Promise<ProjectV1> {
    const snapshot = validateProject(candidate);
    if (snapshot.saveRevision !== 0 || snapshot.story || snapshot.museum.visitedExhibitIds.length || snapshot.performance || snapshot.partialRecording) {
      return Promise.reject(new StorageError('invalid', '清理后必须从全新作品开始。'));
    }
    return this.enqueue(() => this.transaction('readwrite', records => {
      // A reset is the user's explicit permission to erase even an unknown or
      // corrupt record. Ordinary saving and recovery still protect those data.
      const old = inspect(records.draft).project;
      if (old?.projectId === snapshot.projectId) throw new StorageError('invalid', '清理历史必须使用新的作品身份。');
      const next = this.stamp(snapshot, 1);
      return { result: next, deletes: KEYS, writes: [['draft', serializeProject(next)]] };
    }));
  }
  save(candidate: ProjectV1, expected: ProjectBaseline | null): Promise<ProjectV1> {
    const snapshot = validateProject(candidate);
    return this.enqueue(() => this.transaction('readwrite', records => {
      const old = checkExpected(records, expected);
      assertSupported(records.backup);
      if (old && old.projectId !== snapshot.projectId) throw new StorageError('invalid', '新项目必须走原子归档入口。');
      if (!old && snapshot.saveRevision !== 0) throw new StorageError('invalid', '首次写入必须是未保存的新项目。');
      if (!old && records.backup !== undefined) throw new StorageError('invalid', '草稿缺失但备份仍在，请先检查恢复。');
      const next = this.stamp(snapshot, (old?.saveRevision ?? 0) + 1);
      const writes: Mutation<ProjectV1>['writes'] = old ? [['backup', serializeProject(old)]] : [];
      writes.push(['draft', serializeProject(next)]);
      return { result: next, writes };
    }));
  }
  replace(candidate: ProjectV1, expected: ProjectBaseline, acknowledgePrevious = false): Promise<ProjectV1> {
    const snapshot = validateProject(candidate);
    return this.enqueue(() => this.transaction('readwrite', records => {
      const current = checkExpected(records, expected)!;
      assertSupported(records.previousProject); assertSupported(records.backup);
      if (records.previousProject !== undefined && !acknowledgePrevious) {
        throw new StorageError('archive-exists', '已有上一项目，请先提供导出或明确确认替换归档。', records);
      }
      if (snapshot.projectId === current.projectId) throw new StorageError('invalid', '替换项目必须具有不同 projectId。');
      const next = this.stamp(snapshot, snapshot.saveRevision + 1);
      // A new project starts with its own valid backup; previous-project owns the old project's archive.
      return { result: next, writes: [['previous-project', serializeProject(current)],
        ['backup', serializeProject(next)], ['draft', serializeProject(next)]] };
    }));
  }
  promoteBackup(observed: Observation, acknowledgeQuarantine = false): Promise<ProjectV1> {
    return this.enqueue(() => this.transaction('readwrite', records => {
      this.checkObservation(records, observed);
      const loaded = classify(records);
      if (loaded.kind === 'unsupported') throw new StorageError('unsupported-version', loaded.problem!, records);
      if (loaded.kind !== 'recoverable' || !loaded.backup) throw new StorageError('invalid', '当前没有可确认恢复的有效备份。', records);
      this.checkQuarantine(records, acknowledgeQuarantine);
      const next = this.stamp(loaded.backup, loaded.backup.saveRevision + 1);
      return { result: next, writes: [['raw-invalid', { capturedAt: this.options.now(), draft: records.draft }],
        ['draft', serializeProject(next)]] };
    }));
  }
  startAfterCorruption(candidate: ProjectV1, observed: Observation, acknowledgeQuarantine = false): Promise<ProjectV1> {
    const snapshot = validateProject(candidate);
    return this.enqueue(() => this.transaction('readwrite', records => {
      this.checkObservation(records, observed);
      const loaded = classify(records);
      if (loaded.kind === 'unsupported') throw new StorageError('unsupported-version', loaded.problem!, records);
      if (loaded.kind !== 'corrupt') throw new StorageError('invalid', '只能在双损坏原稿已可导出的状态下明确新建。', records);
      this.checkQuarantine(records, acknowledgeQuarantine);
      const next = this.stamp(snapshot, 1);
      return { result: next, writes: [['raw-invalid', { capturedAt: this.options.now(), draft: records.draft, backup: records.backup }],
        ['draft', serializeProject(next)], ['backup', serializeProject(next)]] };
    }));
  }
  private checkObservation(records: RawRecords, observed: Observation) {
    const current = observationOf(records);
    if (current.draftToken !== observed.draftToken || current.backupToken !== observed.backupToken || current.rawInvalidToken !== observed.rawInvalidToken) {
      throw new StorageError('conflict', '确认期间原稿或备份已变化，未恢复或覆盖，请重新读取。', records);
    }
  }
  private checkQuarantine(records: RawRecords, acknowledge: boolean) {
    if (records.rawInvalid !== undefined && !acknowledge) {
      throw new StorageError('quarantine-exists', '已有隔离原稿，替换前请先提供导出或明确确认。', records);
    }
  }
  close() { this.closed = true; this.connection?.close(); this.connection = null; }
}
