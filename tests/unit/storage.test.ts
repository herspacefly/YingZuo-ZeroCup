import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../fixtures/project-v1.json';
import corrupt from '../fixtures/corrupt-project.json';
import unknownVersion from '../fixtures/unknown-version.json';
import { createProject } from '../../src/domain/defaults';
import { MAX_PROJECT_BYTES } from '../../src/domain/limits';
import { serializeProject } from '../../src/domain/migrations';
import { validateProject } from '../../src/domain/validation';
import { baselineOf, decodeStoredProject, ProjectStorage, SNAPSHOT_STORE } from '../../src/persistence/storage';

const NOW = '2026-10-16T09:00:00.000Z';
let factory: IDBFactory;
let sequence = 0;
const instances: ProjectStorage[] = [];
const fresh = () => createProject(`project-${++sequence}`, 'writer-test', NOW);
const adapter = (writerId = `writer-${++sequence}`) => {
  const storage = new ProjectStorage(factory, { writerId, now: () => NOW }); instances.push(storage); return storage;
};
async function rawWrite(entries: Record<string, unknown>) {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = factory.open('yingzuo-v1', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(SNAPSHOT_STORE);
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error);
  });
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(SNAPSHOT_STORE, 'readwrite');
      Object.entries(entries).forEach(([key, value]) => tx.objectStore(SNAPSHOT_STORE).put(value, key));
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error);
    });
  } finally { database.close(); }
}
beforeEach(() => { factory = new IDBFactory(); });
afterEach(() => { vi.restoreAllMocks(); instances.splice(0).forEach(storage => storage.close()); });

describe('DATA-03/04 transactional project persistence', () => {
  it('resets all four history keys in one transaction and fences old-tab saves with a new identity', async () => {
    const a = adapter('resetter'), b = adapter('old-tab');
    const first = await a.save(fresh(), null);
    await rawWrite({ backup: serializeProject(first), 'previous-project': serializeProject(first), 'raw-invalid': '{old broken' });
    const next = await a.resetLocalHistory(fresh()), records = await a.readRaw();
    expect(next).toMatchObject({ saveRevision: 1, story: null, museum: { visitedExhibitIds: [] }, lastRoute: '/' });
    expect(next.projectId).not.toBe(first.projectId);
    expect(decodeStoredProject(records.draft)).toEqual(next);
    expect(records.backup).toBeUndefined(); expect(records.previousProject).toBeUndefined(); expect(records.rawInvalid).toBeUndefined();
    await expect(b.save({ ...first, title: 'old tab revival' }, baselineOf(first))).rejects.toMatchObject({ code: 'conflict' });
    expect((await a.load()).project).toEqual(next);
  });
  it('rolls back every deletion if the new clean draft cannot commit', async () => {
    const storage = adapter(), first = await storage.save(fresh(), null);
    await rawWrite({ backup: serializeProject(first), 'previous-project': serializeProject(first), 'raw-invalid': 'quarantined' });
    const before = await storage.readRaw(), original = FakeObjectStore.prototype.put;
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(function(this: IDBObjectStore, value, key) {
      const request = original.call(this, value, key);
      if (key === 'draft') request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(storage.resetLocalHistory(fresh())).rejects.toMatchObject({ code: 'aborted' });
    expect(await storage.readRaw()).toEqual(before);
  });
  it('only the explicit history reset can erase unknown and damaged snapshots', async () => {
    const storage = adapter();
    await rawWrite({ draft: JSON.stringify(unknownVersion), backup: '{broken', 'raw-invalid': { kept: true } });
    await expect(storage.save(fresh(), null)).rejects.toMatchObject({ code: 'unsupported-version' });
    expect(await storage.resetLocalHistory(fresh())).toMatchObject({ saveRevision: 1, story: null });
    expect((await storage.readRaw()).rawInvalid).toBeUndefined();
  });
  it('commits the entire project and keeps the prior valid draft as backup', async () => {
    const storage = adapter(); expect((await storage.load()).kind).toBe('empty');
    const first = await storage.save(fresh(), null);
    const second = await storage.save({ ...first, title: '最新的灯' }, baselineOf(first));
    const records = await storage.readRaw();
    expect(decodeStoredProject(records.backup)).toEqual(first);
    expect(decodeStoredProject(records.draft)).toEqual(second);
    expect(second.saveRevision).toBe(2);
    expect((await adapter().load()).project).toEqual(second);
  });
  it('rejects after individual put success if the transaction aborts and preserves both previous records', async () => {
    const storage = adapter(); const first = await storage.save(fresh(), null);
    const second = await storage.save({ ...first, title: '第二次' }, baselineOf(first));
    const before = await storage.readRaw();
    const original = FakeObjectStore.prototype.put;
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = original.call(this, value, key);
      if (key === 'draft') request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(storage.save({ ...second, title: '不能落盘' }, baselineOf(second))).rejects.toMatchObject({ code: 'aborted' });
    expect(await storage.readRaw()).toEqual(before);
  });
  it('reports quota failure and rolls back the prior backup mutation', async () => {
    const storage = adapter(); const first = await storage.save(fresh(), null);
    const original = FakeObjectStore.prototype.put;
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      if (key === 'draft') throw new DOMException('Quota exceeded', 'QuotaExceededError');
      return original.call(this, value, key);
    });
    await expect(storage.save({ ...first, title: '配额失败' }, baselineOf(first))).rejects.toMatchObject({ code: 'quota' });
    const raw = await storage.readRaw(); expect(raw.backup).toBeUndefined(); expect(decodeStoredProject(raw.draft)).toEqual(first);
  });
  it('accepts only one of two simultaneous writers, without changing the losing candidate', async () => {
    const a = adapter(); const b = adapter(); const saved = await a.save(fresh(), null);
    const left = { ...saved, title: '甲' }; const right = { ...saved, title: '乙' };
    const outcomes = await Promise.allSettled([a.save(left, baselineOf(saved)), b.save(right, baselineOf(saved))]);
    expect(outcomes.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = outcomes.find(result => result.status === 'rejected') as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'conflict' }); expect(right.title).toBe('乙');
    expect((await a.load()).project!.saveRevision).toBe(2);
  });
  it('uses project identity as well as version and returns its own exact commit result', async () => {
    const a = adapter('a'); const b = adapter('b'); const original = await a.save(fresh(), null);
    const committed = await a.save({ ...original, title: '甲稿' }, baselineOf(original));
    const external = await b.save({ ...committed, title: '乙稿' }, baselineOf(committed));
    expect(committed.title).toBe('甲稿'); expect(committed.saveRevision).toBe(2);
    await expect(a.save({ ...committed, title: '甲的旧版再写' }, baselineOf(committed))).rejects.toMatchObject({ code: 'conflict' });
    const replacement = await b.replace(fresh(), baselineOf(external));
    expect(replacement.saveRevision).toBe(1);
    await expect(a.save(original, baselineOf(original))).rejects.toMatchObject({ code: 'conflict' });
  });
  it('archives the current project on new creation and never touches previous-project during autosaves', async () => {
    const storage = adapter(); const first = await storage.save(fresh(), null);
    let next = await storage.replace(fresh(), baselineOf(first));
    const archive = (await storage.readRaw()).previousProject;
    expect(decodeStoredProject(archive)).toEqual(first);
    for (const title of ['更改一', '更改二', '更改三']) next = await storage.save({ ...next, title }, baselineOf(next));
    expect((await storage.readRaw()).previousProject).toBe(archive);
    const previous = decodeStoredProject(archive);
    const restored = await storage.replace(previous, baselineOf(next), true);
    expect(restored.projectId).toBe(first.projectId);
    expect(restored.saveRevision).toBe(first.saveRevision + 1);
  });
  it('requires a chance to export an existing archive before replacing it', async () => {
    const storage = adapter(); const first = await storage.save(fresh(), null);
    const next = await storage.replace(fresh(), baselineOf(first)); const before = await storage.readRaw();
    await expect(storage.replace(fresh(), baselineOf(next))).rejects.toMatchObject({ code: 'archive-exists' });
    expect(await storage.readRaw()).toEqual(before);
    await expect(storage.replace(fresh(), baselineOf(next), true)).resolves.toHaveProperty('saveRevision', 1);
  });
  it('rolls back archive, backup and draft together if new-project creation aborts', async () => {
    const storage = adapter(); const first = await storage.save(fresh(), null);
    const second = await storage.replace(fresh(), baselineOf(first)); const before = await storage.readRaw();
    const original = FakeObjectStore.prototype.put;
    vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = original.call(this, value, key);
      if (key === 'draft') request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(storage.replace(fresh(), baselineOf(second), true)).rejects.toMatchObject({ code: 'aborted' });
    expect(await storage.readRaw()).toEqual(before);
  });
});

describe('DATA-02/03 safe recovery and unknown-data preservation', () => {
  it('offers an intact backup, promotes it with quarantine, then can edit/save/reopen normally', async () => {
    const storage = adapter(); const valid = validateProject(fixture);
    await rawWrite({ draft: JSON.stringify(corrupt), backup: serializeProject(valid) });
    const loaded = await storage.load(); expect(loaded.kind).toBe('recoverable');
    const restored = await storage.promoteBackup(loaded.observation);
    const after = await storage.readRaw();
    expect(after.rawInvalid).toMatchObject({ draft: JSON.stringify(corrupt) });
    expect(decodeStoredProject(after.backup)).toEqual(valid);
    const edited = await storage.save({ ...restored, title: '恢复后继续制作' }, baselineOf(restored));
    expect((await adapter().load()).project).toEqual(edited);
    expect(decodeStoredProject((await storage.readRaw()).backup)).toEqual(restored);
  });
  it.each(['schemaVersion', 'assetVersion', 'definitionVersion'])('protects unknown %s even with an older valid backup', async version => {
    const storage = adapter(); const p: any = validateProject(fixture);
    if (version === 'definitionVersion') p.story.definitionVersion = 9; else p[version] = 9;
    const raw = JSON.stringify(p);
    await rawWrite({ draft: raw, backup: serializeProject(validateProject(fixture)) });
    const loaded = await storage.load(); expect(loaded.kind).toBe('unsupported');
    await expect(storage.promoteBackup(loaded.observation)).rejects.toMatchObject({ code: 'unsupported-version' });
    await expect(storage.save(fresh(), null)).rejects.toMatchObject({ code: 'unsupported-version' });
    expect((await storage.readRaw()).draft).toBe(raw);
  });
  it('does not misclassify a too-large future-version string as safely recoverable corruption', async () => {
    const storage = adapter(); const raw = JSON.stringify(unknownVersion) + ' '.repeat(MAX_PROJECT_BYTES);
    await rawWrite({ draft: raw, backup: serializeProject(validateProject(fixture)) });
    const loaded = await storage.load(); expect(loaded.kind).toBe('unsupported');
    await expect(storage.promoteBackup(loaded.observation)).rejects.toMatchObject({ code: 'unsupported-version' });
    expect((await storage.readRaw()).draft).toBe(raw);
  });
  it('allows recovery for a malformed version field and keeps that raw original', async () => {
    const storage = adapter(); const broken = { ...fixture, schemaVersion: null };
    await rawWrite({ draft: broken, backup: serializeProject(validateProject(fixture)) });
    const loaded = await storage.load(); expect(loaded.kind).toBe('recoverable');
    await storage.promoteBackup(loaded.observation);
    expect((await storage.readRaw()).rawInvalid).toMatchObject({ draft: broken });
  });
  it.each(['draft', 'backup'])('refuses promotion if the observed %s changes while confirming', async key => {
    const storage = adapter(); await rawWrite({ draft: '{broken', backup: serializeProject(validateProject(fixture)) });
    const loaded = await storage.load();
    const changed = key === 'draft' ? '{different broken' : serializeProject({ ...validateProject(fixture), title: '未确认的备份' });
    await rawWrite({ [key]: changed });
    await expect(storage.promoteBackup(loaded.observation)).rejects.toMatchObject({ code: 'conflict' });
    const raw = await storage.readRaw(); expect(raw[key as 'draft' | 'backup']).toBe(changed); expect(raw.rawInvalid).toBeUndefined();
  });
  it.each([[{ x: NaN }, { x: null }], [{ x: undefined }, {}]])('does not collapse different corrupt structured-clone originals in CAS', async (before, after) => {
    const storage = adapter(); await rawWrite({ draft: before, backup: serializeProject(validateProject(fixture)) });
    const loaded = await storage.load(); await rawWrite({ draft: after });
    await expect(storage.promoteBackup(loaded.observation)).rejects.toMatchObject({ code: 'conflict' });
  });
  it('preserves the existing quarantine on failed promotion and requires explicit replacement', async () => {
    const storage = adapter(); await rawWrite({ draft: '{broken', backup: serializeProject(validateProject(fixture)), 'raw-invalid': 'older original' });
    const loaded = await storage.load();
    await expect(storage.promoteBackup(loaded.observation)).rejects.toMatchObject({ code: 'quarantine-exists' });
    const before = await storage.readRaw(); const original = FakeObjectStore.prototype.put;
    const spy = vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
      const request = original.call(this, value, key);
      if (key === 'draft') request.addEventListener('success', () => this.transaction.abort());
      return request;
    });
    await expect(storage.promoteBackup(loaded.observation, true)).rejects.toMatchObject({ code: 'aborted' });
    expect(await storage.readRaw()).toEqual(before); spy.mockRestore();
    await storage.promoteBackup(loaded.observation, true);
    expect((await storage.readRaw()).rawInvalid).toMatchObject({ draft: '{broken' });
  });
  it('uses canonical payload CAS to reject stale same-id/same-revision writers after restoring an older backup', async () => {
    const a = adapter('a'); const b = adapter('b');
    const first = await a.save(fresh(), null);
    const stale = await a.save({ ...first, title: '先前的第二版' }, baselineOf(first));
    await rawWrite({ draft: '{corrupt' });
    const observation = await b.load(); const restored = await b.promoteBackup(observation.observation);
    expect(restored.saveRevision).toBe(stale.saveRevision);
    await expect(a.save({ ...stale, title: '旧页面覆盖' }, baselineOf(stale))).rejects.toMatchObject({ code: 'conflict' });
  });
  it('preserves both invalid originals when explicitly starting fresh, and leaves previous-project untouched', async () => {
    const storage = adapter(); const previous = serializeProject(validateProject(fixture));
    await rawWrite({ draft: '{one', backup: '{two', 'previous-project': previous });
    const loaded = await storage.load(); expect(loaded.kind).toBe('corrupt');
    const next = await storage.startAfterCorruption(fresh(), loaded.observation);
    const raw = await storage.readRaw();
    expect(raw.rawInvalid).toMatchObject({ draft: '{one', backup: '{two' });
    expect(raw.previousProject).toBe(previous);
    expect(decodeStoredProject(raw.backup)).toEqual(next);
  });
  it('reports denied storage without fabricating an empty successful load', async () => {
    const unavailable = new ProjectStorage(undefined, { writerId: 'no-storage', now: () => NOW }); instances.push(unavailable);
    await expect(unavailable.load()).rejects.toMatchObject({ code: 'unavailable' });
  });
});
