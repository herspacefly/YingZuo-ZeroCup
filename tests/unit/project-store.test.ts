import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fixture from '../fixtures/project-v1.json';
import { createProject } from '../../src/domain/defaults';
import { serializeProject } from '../../src/domain/migrations';
import type { ProjectBaseline, ProjectV1 } from '../../src/domain/types';
import { validateProject } from '../../src/domain/validation';
import { ProjectStore } from '../../src/app/store';
import { baselineOf, StorageError } from '../../src/persistence/storage';
import type { LoadResult, Observation, RawRecords } from '../../src/persistence/storage';

const NOW = '2026-10-16T10:00:00.000Z';
const clone = (project: ProjectV1) => validateProject(project);
class MemoryPort {
  current = clone(fixture as unknown as ProjectV1);
  previous: ProjectV1 | null = null;
  attempts: ProjectV1[] = [];
  failNext = false;
  denied = false;
  closed = false;
  gate: Promise<void> | null = null;
  resets = 0;
  holdNext() {
    let release!: () => void;
    this.gate = new Promise<void>(resolve => { release = resolve; });
    return release;
  }
  async load(): Promise<LoadResult> {
    if (this.denied) throw new StorageError('unavailable', '禁止存储');
    return { kind: 'ready', project: clone(this.current), backup: null, problem: null,
      records: await this.readRaw(), observation: { draftToken: 'observed', backupToken: 'absent', rawInvalidToken: 'absent' } };
  }
  async readRaw(): Promise<RawRecords> {
    return { draft: serializeProject(this.current), backup: undefined, previousProject: this.previous ? serializeProject(this.previous) : undefined, rawInvalid: undefined };
  }
  async save(project: ProjectV1, expected: ProjectBaseline | null): Promise<ProjectV1> {
    this.attempts.push(clone(project));
    const gate = this.gate; this.gate = null; if (gate) await gate;
    if (this.denied) throw new StorageError('unavailable', '禁止存储');
    if (this.failNext) { this.failNext = false; throw new StorageError('quota', '配额不足'); }
    if (!expected || expected.contentToken !== baselineOf(this.current).contentToken) throw new StorageError('conflict', '版本冲突', await this.readRaw());
    this.current = clone({ ...project, saveRevision: this.current.saveRevision + 1, writerId: 'store-writer', savedAt: NOW });
    return clone(this.current);
  }
  async replace(project: ProjectV1, expected: ProjectBaseline, acknowledgePrevious = false): Promise<ProjectV1> {
    this.attempts.push(clone(project));
    if (this.failNext) { this.failNext = false; throw new StorageError('quota', '配额不足'); }
    if (this.previous && !acknowledgePrevious) throw new StorageError('archive-exists', '已有上一项目');
    if (expected.contentToken !== baselineOf(this.current).contentToken) throw new StorageError('conflict', '版本冲突');
    this.previous = clone(this.current);
    this.current = clone({ ...project, saveRevision: project.saveRevision + 1, writerId: 'store-writer', savedAt: NOW });
    return clone(this.current);
  }
  async promoteBackup(_observation: Observation): Promise<ProjectV1> { throw new Error('Not a recovery fixture'); }
  async resetLocalHistory(project: ProjectV1): Promise<ProjectV1> {
    this.resets++;
    if (this.denied) throw new StorageError('unavailable', '禁止存储');
    if (this.failNext) { this.failNext = false; throw new StorageError('quota', '配额不足'); }
    this.previous = null;
    this.current = clone({ ...project, saveRevision: 1, writerId: 'store-writer', savedAt: NOW });
    return clone(this.current);
  }
  async startAfterCorruption(_project: ProjectV1, _observation: Observation): Promise<ProjectV1> { throw new Error('Not a corrupt fixture'); }
  close() { this.closed = true; }
}
const stores: ProjectStore[] = [];
let sequence = 0;
async function open(port = new MemoryPort()) {
  const store = await ProjectStore.open(port, { writerId: 'store-writer', createId: () => `created-${++sequence}`, now: () => NOW });
  stores.push(store); return { store, port };
}
const advanceNode = (p: ProjectV1): ProjectV1 | null => {
  if (p.story!.nodeId !== 'call-light') return null;
  p.story!.nodeId = 'call-response'; p.story!.revision += 1; return p;
};
beforeEach(() => { vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] }); });
afterEach(() => { stores.splice(0).forEach(store => store.dispose()); vi.useRealTimers(); });

describe('T03 serial store, debounce and immediate durable commands', () => {
  it('cancels autosave timers, drops a failed candidate and deduplicates repeated clear actions', async () => {
    const { store, port } = await open(); port.failNext = true;
    await store.commit(advanceNode); await store.edit({ type: 'RENAME', title: 'queued after failure' });
    const first = store.resetLocalHistory(), repeated = store.resetLocalHistory();
    expect(first).toBe(repeated); expect(await first).toMatchObject({ ok: true });
    expect(store.getState()).toMatchObject({ status: 'saved', hasPending: false, queuedEdits: 0, project: { story: null, saveRevision: 1, lastRoute: '/' } });
    expect(port.resets).toBe(1); expect(port.current.projectId).not.toBe(fixture.projectId);
    const count = port.attempts.length;
    await vi.advanceTimersByTimeAsync(5000); expect(port.attempts.length).toBe(count);
  });
  it('drains an in-flight save before clearing and refuses edits during the clear fence', async () => {
    const { store, port } = await open(), release = port.holdNext();
    await store.edit({ type: 'RENAME', title: 'old in flight' }); const saving = store.flush();
    await Promise.resolve(); await Promise.resolve();
    const editing = store.edit({ type: 'RENAME', title: 'old queued' });
    const reset = store.resetLocalHistory();
    await expect(store.edit({ type: 'RENAME', title: 'cannot enter clear' })).rejects.toThrow('正在清除');
    release(); await saving; await editing; expect(await reset).toMatchObject({ ok: true });
    expect(port.current.title).toBe('一幕团圆'); expect(port.current.saveRevision).toBe(1);
    await vi.advanceTimersByTimeAsync(5000); expect(port.current.story).toBeNull();
  });
  it('retains the exact failed candidate for export when history clearing fails, and permits retry', async () => {
    const { store, port } = await open(); port.failNext = true; await store.commit(advanceNode);
    await store.edit({ type: 'RENAME', title: '清理失败后保留' });
    const candidate = store.getExportProject(); port.failNext = true;
    expect(await store.resetLocalHistory()).toMatchObject({ ok: false });
    expect(store.getExportProject()).toEqual(candidate); expect(store.getState().hasPending).toBe(true);
    expect(port.current.projectId).toBe(fixture.projectId);
    await vi.advanceTimersByTimeAsync(5000); expect(port.current.projectId).toBe(fixture.projectId);
    expect(await store.resetLocalHistory()).toMatchObject({ ok: true });
  });
  it('debounces to the latest entire state rather than a captured older snapshot', async () => {
    const { store, port } = await open();
    await store.edit({ type: 'RENAME', title: '先前' });
    await vi.advanceTimersByTimeAsync(300);
    await store.edit({ type: 'RENAME', title: '最新' });
    await vi.advanceTimersByTimeAsync(499); expect(port.attempts).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(port.current.title).toBe('最新'); expect(store.getState().status).toBe('saved');
  });
  it('saves within two seconds while edits continue to arrive', async () => {
    const { store, port } = await open();
    for (let index = 0; index < 5; index++) {
      await store.edit({ type: 'RENAME', title: `持续${index}` }); await vi.advanceTimersByTimeAsync(400);
    }
    expect(port.attempts).toHaveLength(1); expect(port.attempts[0]!.title).toBe('持续4');
  });
  it('merges edits made less than 500ms before an immediate command and cannot regress through old timers', async () => {
    const { store, port } = await open();
    await store.edit({ type: 'RENAME', title: '随决定保存的名字' });
    await vi.advanceTimersByTimeAsync(100);
    expect(await store.commit(advanceNode)).toMatchObject({ ok: true });
    expect(port.current.title).toBe('随决定保存的名字'); expect(port.current.story!.nodeId).toBe('call-response');
    await vi.advanceTimersByTimeAsync(2500);
    expect(port.attempts).toHaveLength(1); expect(port.current.story!.nodeId).toBe('call-response');
  });
  it('serializes an in-flight autosave, later edits and an immediate command without stale version adoption', async () => {
    const { store, port } = await open(); const release = port.holdNext();
    await store.edit({ type: 'RENAME', title: '甲' }); const saving = store.flush();
    await Promise.resolve(); await Promise.resolve();
    const editing = store.edit({ type: 'RENAME', title: '乙' }); const command = store.commit(advanceNode);
    release(); await saving; await editing; await command;
    expect(port.attempts.map(p => p.title)).toEqual(['甲', '乙']);
    expect(port.current.story!.nodeId).toBe('call-response'); expect(store.getState().project!.title).toBe('乙');
    expect(port.current.saveRevision).toBe(5);
  });
  it('applies edits queued during a command to the successful candidate rather than losing them', async () => {
    const { store, port } = await open(); const release = port.holdNext();
    const command = store.commit(advanceNode); await Promise.resolve(); await Promise.resolve();
    const editing = store.edit({ type: 'RENAME', title: '提交期间的新编辑' });
    release(); await command; await editing;
    expect(store.getState()).toMatchObject({ status: 'unsaved', project: { title: '提交期间的新编辑', story: { nodeId: 'call-response' } } });
    expect(port.current.title).toBe(fixture.title);
    await store.flush(); expect(port.current.title).toBe('提交期间的新编辑');
  });
  it('does not write a repeated stale immediate command twice', async () => {
    const { store, port } = await open();
    await Promise.all([store.commit(advanceNode), store.commit(advanceNode)]);
    expect(port.attempts).toHaveLength(1); expect(port.current.story!.revision).toBe(9);
  });
  it('merges independent appearance fields queued during a durable command', async () => {
    const { store, port } = await open(); const release = port.holdNext();
    const command = store.commit(advanceNode); await Promise.resolve(); await Promise.resolve();
    const palette = store.edit({ type: 'PALETTE', paletteId: 'woodland-v1' });
    const pattern = store.edit({ type: 'PATTERN', patternId: 'flower-v1' });
    release(); await command; await palette; await pattern; await store.flush();
    expect(port.current.appearance).toMatchObject({ paletteId: 'woodland-v1', patternId: 'flower-v1' });
    expect(port.current.story!.castSnapshot!.appearance).toEqual(fixture.story.castSnapshot.appearance);
  });
  it('keeps a failed candidate exportable without applying its node, then retries the exact candidate and queued edits', async () => {
    const { store, port } = await open(); port.failNext = true; let reducerCalls = 0;
    const result = await store.commit(p => { reducerCalls++; return advanceNode(p); });
    expect(result.ok).toBe(false); expect(store.getState().project!.story!.nodeId).toBe('call-light');
    await store.edit({ type: 'RENAME', title: '失败后仍保留' });
    expect(store.getExportProject()).toMatchObject({ title: '失败后仍保留', story: { nodeId: 'call-response' } });
    expect(store.getState()).toMatchObject({ hasPending: true, queuedEdits: 1 });
    await store.retryPending(); expect(reducerCalls).toBe(1);
    expect(store.getState()).toMatchObject({ status: 'unsaved', project: { title: '失败后仍保留', story: { nodeId: 'call-response' } } });
    expect(port.attempts[1]!.story).toEqual(port.attempts[0]!.story);
    await store.flush(); expect(port.current.title).toBe('失败后仍保留');
  });
  it('requires explicit choice to continue a failed command in memory and keeps that state exportable', async () => {
    const { store, port } = await open(); port.failNext = true;
    await store.commit(advanceNode); await store.continuePendingUnsaved();
    expect(store.getState()).toMatchObject({ status: 'memory', hasPending: false, project: { story: { nodeId: 'call-response' } } });
    await vi.advanceTimersByTimeAsync(3000); expect(port.attempts).toHaveLength(1);
    expect(port.current.story!.nodeId).toBe('call-light'); expect(store.getExportProject()!.story!.nodeId).toBe('call-response');
    await store.flush(); expect(port.current.story!.nodeId).toBe('call-response');
  });
  it('keeps new project IDs stable across failed replace retries and allows cancellation without losing queued edits', async () => {
    const { store, port } = await open(); port.failNext = true;
    await store.newProject(); const pendingId = store.getExportProject()!.projectId;
    expect(store.getState().project!.projectId).toBe(fixture.projectId);
    await store.retryPending(); expect(port.current.projectId).toBe(pendingId);
    await store.newProject(); // Existing archive requires explicit acknowledgement.
    expect(store.getState().hasPending).toBe(true);
    await store.edit({ type: 'RENAME', title: '取消新建后留下' }); await store.cancelPending();
    expect(store.getState()).toMatchObject({ hasPending: false, project: { projectId: pendingId, title: '取消新建后留下' } });
    expect(port.current.projectId).toBe(pendingId);
  });
  it('pauses automatic overwrite after conflict, exposes the memory draft and rereads before explicit takeover', async () => {
    const { store, port } = await open();
    port.current = validateProject({ ...port.current, title: '另一页面', saveRevision: 4 });
    await store.edit({ type: 'RENAME', title: '当前页面' }); await store.flush();
    expect(store.getState().status).toBe('conflict'); const attempts = port.attempts.length;
    await store.edit({ type: 'RENAME', title: '冲突后编辑' }); await vi.advanceTimersByTimeAsync(3000);
    expect(port.attempts).toHaveLength(attempts); expect(port.current.title).toBe('另一页面');
    expect(store.getExportProject()!.title).toBe('冲突后编辑');
    await store.takeOver(); expect(port.current.title).toBe('冲突后编辑'); expect(port.current.saveRevision).toBe(5);
  });
  it('keeps an exportable in-memory project if storage is unavailable and never reports saved', async () => {
    const port = new MemoryPort(); port.denied = true; const { store } = await open(port);
    expect(store.getState().status).toBe('error');
    expect(store.getExportProject()!.saveRevision).toBe(0);
    await store.edit({ type: 'RENAME', title: '只在内存' }); await vi.advanceTimersByTimeAsync(3000);
    expect(port.attempts).toHaveLength(0); expect(store.getExportProject()!.title).toBe('只在内存');
  });
  it('removes old debounce and maximum timers on disposal', async () => {
    const { store, port } = await open(); await store.edit({ type: 'RENAME', title: '离开前' });
    store.dispose(); await vi.advanceTimersByTimeAsync(3000);
    expect(port.attempts).toHaveLength(0); expect(port.closed).toBe(true);
  });
  it('does not turn editor changes into frozen cast edits', async () => {
    const { store } = await open(); const p = store.getState().project!;
    await store.edit({ type: 'APPEARANCE', appearance: { ...p.appearance, patternId: 'flower-v1' } });
    expect(store.getState().project!.story!.castSnapshot!.sharedMotif).toBe('cloud-v1');
    const copy = store.getState().project!; copy.appearance.colorSlots.body = 4;
    expect(store.getState().project!.appearance.colorSlots.body).toBe(0);
  });
  it('imports a validated project under a new project ID while retaining the saved run', async () => {
    const { store, port } = await open(); const imported = createProject('file-project', 'file-writer', NOW);
    imported.story = clone(fixture as unknown as ProjectV1).story;
    await store.newProject(imported);
    expect(port.current.projectId).not.toBe(imported.projectId); expect(port.current.story).toEqual(imported.story);
    expect(port.previous!.projectId).toBe(fixture.projectId);
  });
});
