/** T00 only. Never open the production yingzuo-v1 database here. */
export const PROBE_DATABASE = 'yingzuo-compat-probe-v1';
const STORE = 'samples';

export interface LightSample {
  lampX: number;
  distance: number;
}

export interface ProbeRecord extends LightSample {
  schemaVersion: 1;
  revision: number;
}

export interface ProbeSnapshot {
  current: ProbeRecord | null;
  backup: ProbeRecord | null;
}

export type ProbeErrorCode = 'unavailable' | 'blocked' | 'timeout' | 'open' | 'invalid' | 'conflict' | 'aborted' | 'storage';

export class ProbeError extends Error {
  constructor(readonly code: ProbeErrorCode, message: string) {
    super(message);
    this.name = 'ProbeError';
  }
}

function validSample(value: LightSample): boolean {
  return Number.isFinite(value.lampX) && value.lampX >= 0 && value.lampX <= 100 &&
    Number.isFinite(value.distance) && value.distance >= 10 && value.distance <= 55;
}

function decode(value: unknown): ProbeRecord | null {
  if (value === undefined) return null;
  if (!value || typeof value !== 'object') throw new ProbeError('invalid', '测试记录损坏，原记录已保留。');
  const record = value as ProbeRecord;
  if (record.schemaVersion !== 1 || !Number.isSafeInteger(record.revision) || record.revision < 1 || !validSample(record)) {
    throw new ProbeError('invalid', '测试记录版本或内容不受支持，原记录已保留。');
  }
  return { schemaVersion: 1, revision: record.revision, lampX: record.lampX, distance: record.distance };
}

export function openProbeDatabase(factory: IDBFactory | undefined, name = PROBE_DATABASE): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!factory) {
      reject(new ProbeError('unavailable', '当前浏览器无法使用本地存储。'));
      return;
    }
    let settled = false;
    let request: IDBOpenDBRequest;
    const fail = (code: ProbeErrorCode, message: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new ProbeError(code, message));
    };
    const timer = setTimeout(() => fail('timeout', '打开存储超时，请关闭其他检查页后重试。'), 5000);
    try {
      request = factory.open(name, 1);
    } catch {
      fail('unavailable', '浏览器拒绝打开本地存储。');
      return;
    }
    request.onupgradeneeded = () => {
      if (settled) {
        request.transaction?.abort();
        return;
      }
      request.result.createObjectStore(STORE);
    };
    request.onblocked = () => fail('blocked', '存储被其他页面占用，请关闭其他检查页后重试。');
    request.onerror = () => fail('open', `无法打开本地存储：${request.error?.name ?? '未知错误'}。`);
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      database.onversionchange = () => database.close();
      resolve(database);
    };
  });
}

export function readProbe(database: IDBDatabase): Promise<ProbeSnapshot> {
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, 'readonly');
    const store = transaction.objectStore(STORE);
    const current = store.get('current');
    const backup = store.get('backup');
    transaction.oncomplete = () => {
      try {
        resolve({ current: decode(current.result), backup: decode(backup.result) });
      } catch (error) { reject(error); }
    };
    transaction.onabort = () => reject(new ProbeError('storage', `读取未完成：${transaction.error?.name ?? '事务中止'}。`));
  });
}

/** Resolve exclusively on transaction complete, never on an individual put success. */
export function writeProbe(
  database: IDBDatabase,
  sample: LightSample,
  expectedRevision: number,
  abortAfterWrites = false,
): Promise<ProbeRecord> {
  return new Promise((resolve, reject) => {
    if (!validSample(sample)) {
      reject(new ProbeError('invalid', '灯位或距离超出范围，未写入。'));
      return;
    }
    const transaction = database.transaction(STORE, 'readwrite');
    const store = transaction.objectStore(STORE);
    const read = store.get('current');
    let failure: unknown;
    let next: ProbeRecord;
    transaction.oncomplete = () => resolve(next);
    transaction.onabort = () => reject(failure ?? new ProbeError('storage', `未保存：${transaction.error?.name ?? '事务中止'}。`));
    read.onsuccess = () => {
      try {
        const old = decode(read.result);
        if ((old?.revision ?? 0) !== expectedRevision) {
          throw new ProbeError('conflict', '另一页面已更新测试记录；当前灯位未保存，请先导出再刷新。');
        }
        next = { schemaVersion: 1, revision: expectedRevision + 1, lampX: sample.lampX, distance: sample.distance };
        if (old) store.put(old, 'backup');
        const write = store.put(next, 'current');
        // Force rollback after both writes have executed, not before any mutation.
        write.onsuccess = () => {
          if (abortAfterWrites) {
            failure = new ProbeError('aborted', '测试写入已主动中止。');
            transaction.abort();
          }
        };
      } catch (error) {
        failure = error;
        transaction.abort();
      }
    };
  });
}
