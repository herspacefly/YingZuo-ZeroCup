import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ProjectStore } from '../../src/app/store';
import { submitScopedSceneCommand } from '../../src/app/story-scene-commands';
import type { SceneCommand, SceneObservation } from '../../src/app/story-scene-commands';
import { introSkipCommand } from '../../src/features/intro/events';
import { createNodeScope } from '../../src/story/node-scope';
import { storyGuard } from '../../src/domain/story';
import type { ProjectV1 } from '../../src/domain/types';
import { ProjectStorage, decodeStoredProject } from '../../src/persistence/storage';
import { at, NOW } from '../helpers/story';

const stores: ProjectStore[] = [], storages: ProjectStorage[] = [];
async function open(seed: ProjectV1 = at('intro')) {
  let wall = NOW;
  const storage = new ProjectStorage(new IDBFactory(), { writerId: 'scene-test', now: () => wall });
  storages.push(storage); await storage.save(seed, null);
  const store = await ProjectStore.open(storage, { writerId: 'scene-test', createId: () => 'scene-project', now: () => wall });
  stores.push(store);
  return { store, storage, later() { wall = '2026-10-17T14:00:00.000Z'; } };
}
function sceneCommand(store: ProjectStore): SceneCommand {
  return { ...storyGuard(store.getState().project!.story!), action: 'COMPLETE_SCENE', source: 'script' };
}
function observation(scope: ReturnType<typeof createNodeScope>, changes: Partial<SceneObservation> = {}): SceneObservation {
  return { token: scope.token, paused: false, elapsedMs: 20000, now: NOW, ...changes };
}
function failNextDraft() {
  const original = FakeObjectStore.prototype.put; let pending = true;
  vi.spyOn(FakeObjectStore.prototype, 'put').mockImplementation(function (this: IDBObjectStore, value, key) {
    if (pending && key === 'draft') { pending = false; throw new DOMException('Injected quota', 'QuotaExceededError'); }
    return original.call(this, value, key);
  });
}
afterEach(() => {
  vi.restoreAllMocks(); stores.splice(0).forEach(store => store.dispose()); storages.splice(0).forEach(storage => storage.close());
});

describe('scoped scene commands at the real Store/IDB boundary', () => {
  it('requires an explicit branch and stores it once without changing the frozen cast',async()=>{
    const {store,storage}=await open(at('approach-choice')),scope=createNodeScope('choice',vi.fn()),before=store.getState().project!;
    const command:SceneCommand={...storyGuard(before.story!),action:'CHOOSE',approach:'split-first'};
    await submitScopedSceneCommand(store,scope,command,observation(scope,{paused:true,elapsedMs:0}));
    const saved=decodeStoredProject((await storage.readRaw()).draft);expect(saved.story).toMatchObject({nodeId:'split-axe',approach:'split-first',approachSource:'user',castSnapshot:before.story!.castSnapshot});
    await submitScopedSceneCommand(store,scope,command,observation(scope));expect(store.getState().project!.saveRevision).toBe(saved.saveRevision);
  });
  it('rejects paused manual completion and records only an explicitly played assistance clip',async()=>{
    const {store}=await open(at('memory-wave')),scope=createNodeScope('wave',vi.fn()),guard=storyGuard(store.getState().project!.story!);
    const manual:SceneCommand={...guard,action:'COMPLETE_INTERACTION',source:'user',evidence:{kind:'wave',overlapRatio:1,heldMs:300}};
    expect(await submitScopedSceneCommand(store,scope,manual,observation(scope,{paused:true}))).toMatchObject({ok:false});
    const help:SceneCommand={...guard,action:'COMPLETE_INTERACTION',source:'assistance'};
    for(const duration of [undefined,NaN,2999])expect(await submitScopedSceneCommand(store,scope,help,observation(scope,{assistanceElapsedMs:duration}))).toMatchObject({ok:false});
    await submitScopedSceneCommand(store,scope,help,observation(scope,{assistanceElapsedMs:3200}));
    expect(store.getState().project!.story).toMatchObject({nodeId:'memory-separate',assistedNodeIds:['memory-wave']});
  });
  it('requires a user curtain action after four seconds and retries the same completedAt after failure',async()=>{
    const {store,storage,later}=await open(at('reunion-hold')),scope=createNodeScope('hold',vi.fn()),command:SceneCommand={...storyGuard(store.getState().project!.story!),action:'COMPLETE_SCENE',source:'user'};
    expect(await submitScopedSceneCommand(store,scope,command,observation(scope,{elapsedMs:3999}))).toMatchObject({ok:false});
    failNextDraft();expect(await submitScopedSceneCommand(store,scope,command,observation(scope,{elapsedMs:4000}))).toMatchObject({ok:false});
    expect(store.getState().project!.story!.completedAt).toBeNull();const candidate=store.getExportProject()!;later();await store.retryPending();
    expect(decodeStoredProject((await storage.readRaw()).draft).story).toEqual(candidate.story);expect(candidate.story!.completedAt).toBe(NOW);
  });
  it.each([{ mode: 'full' as const, target: 18000 }, { mode: 'guided' as const, target: 10000 }])(
    'requires the $mode target ($target ms), rather than the shorter minimum', async ({ mode, target }) => {
      const { store, storage } = await open(at('intro', 'call-first', mode));
      const scope = createNodeScope('intro:1', vi.fn()), command = sceneCommand(store), before = store.getState().project!, raw = await storage.readRaw();
      expect(await submitScopedSceneCommand(store, scope, command, observation(scope, { elapsedMs: target - 1 }))).toMatchObject({ ok: false });
      expect(store.getState().project).toEqual(before); expect(await storage.readRaw()).toEqual(raw);
      expect(await submitScopedSceneCommand(store, scope, command, observation(scope, { elapsedMs: target }))).toMatchObject({ ok: true });
      expect(decodeStoredProject((await storage.readRaw()).draft).story).toMatchObject({ nodeId: 'craft', mode, revision: 1 });
    },
  );

  it('accepts an automatic cinematic and curtain, without exposing automatic completion to interactive or user scenes', async () => {
    for (const [nodeId, destination] of [['memory-separate', 'road'], ['curtain', 'completed']] as const) {
      const { store, storage } = await open(at(nodeId)), scope = createNodeScope(nodeId, vi.fn());
      expect(await submitScopedSceneCommand(store, scope, sceneCommand(store), observation(scope))).toMatchObject({ ok: true });
      expect(decodeStoredProject((await storage.readRaw()).draft).story!.nodeId).toBe(destination);
    }
    for (const nodeId of ['memory-wave', 'approach-choice', 'reunion-hold'] as const) {
      const { store, storage } = await open(at(nodeId)), scope = createNodeScope(nodeId, vi.fn()), before = store.getState().project!, raw = await storage.readRaw();
      expect(await submitScopedSceneCommand(store, scope, sceneCommand(store), observation(scope))).toMatchObject({ ok: false });
      expect(store.getState().project).toEqual(before); expect(await storage.readRaw()).toEqual(raw);
    }
  });

  it('rejects paused playback and non-finite observations without a candidate or durable write', async () => {
    const { store, storage } = await open(), scope = createNodeScope('intro', vi.fn()), command = sceneCommand(store);
    const before = store.getState().project!, raw = await storage.readRaw();
    for (const facts of [{ paused: true }, { elapsedMs: NaN }, { elapsedMs: Infinity }, { elapsedMs: -1 }]) {
      expect(await submitScopedSceneCommand(store, scope, command, observation(scope, facts))).toMatchObject({ ok: false });
      expect(store.getState().hasPending).toBe(false); expect(store.getState().project).toEqual(before);
    }
    expect(await storage.readRaw()).toEqual(raw);
  });

  it('refuses an expired instance with the same token and persisted guard as its replacement', async () => {
    const { store, storage } = await open(), old = createNodeScope('intro:same', vi.fn()), command = sceneCommand(store);
    const before = store.getState().project!, raw = await storage.readRaw(); old.dispose();
    const current = createNodeScope(old.token, vi.fn());
    await submitScopedSceneCommand(store, old, command, observation(old));
    await submitScopedSceneCommand(store, current, command, observation(current, { token: 'other-mount' }));
    expect(store.getState().project).toEqual(before); expect(await storage.readRaw()).toEqual(raw);
    await submitScopedSceneCommand(store, current, command, observation(current));
    expect(store.getState().project!.story!.nodeId).toBe('craft');
  });

  it('rechecks scope after queueing behind a real draft save, so leaving the node prevents a later scene write', async () => {
    const { store, storage } = await open(), scope = createNodeScope('intro:queued', vi.fn());
    const command = sceneCommand(store), beforeRevision = store.getState().project!.saveRevision;
    await store.edit({ type: 'RENAME', title: 'queued editor title' });
    let release!: () => void, entered!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; }), started = new Promise<void>(resolve => { entered = resolve; });
    const original = storage.save.bind(storage), save = vi.spyOn(storage, 'save').mockImplementationOnce(async (project, expected) => {
      entered(); await gate; return original(project, expected);
    });
    const flush = store.flush(); await started;
    const complete = submitScopedSceneCommand(store, scope, command, observation(scope));
    scope.dispose(); release(); await Promise.all([flush, complete]);
    expect(save).toHaveBeenCalledTimes(1);
    expect(decodeStoredProject((await storage.readRaw()).draft)).toMatchObject({ title: 'queued editor title', saveRevision: beforeRevision + 1, story: { nodeId: 'intro', revision: 0 } });
  });

  it('commits once for duplicate callbacks while preserving the frozen cast and independent editor Stage/Pose', async () => {
    const { store, storage } = await open(at('memory-separate')), scope = createNodeScope('separation', vi.fn());
    await store.edit({ type: 'PATTERN', patternId: 'flower-v1' }); await store.edit({ type: 'LAMP_X', lampX: .6 });
    const pose = store.getState().project!.pose; pose.x = .42;
    await store.edit({ type: 'POSE', pose }); await store.flush();
    const before = store.getState().project!, command = sceneCommand(store), save = vi.spyOn(storage, 'save');
    await Promise.all([submitScopedSceneCommand(store, scope, command, observation(scope)), submitScopedSceneCommand(store, scope, command, observation(scope))]);
    const restored = decodeStoredProject((await storage.readRaw()).draft);
    expect(save).toHaveBeenCalledTimes(1); expect(restored.saveRevision).toBe(before.saveRevision + 1);
    expect(restored.story).toMatchObject({ nodeId: 'road', revision: before.story!.revision + 1, castSnapshot: before.story!.castSnapshot });
    expect(restored.stage).toEqual(before.stage); expect(restored.pose).toEqual(before.pose); expect(restored.appearance).toEqual(before.appearance);
    expect(restored.story!.castSnapshot!.appearance.patternId).not.toBe(restored.appearance.patternId);
  });

  it('requires a paused mode change and persists a new guard revision that invalidates old callbacks', async () => {
    const { store, storage } = await open(), scope = createNodeScope('intro:mode', vi.fn()), old = sceneCommand(store), before = store.getState().project!;
    const mode: SceneCommand = { ...storyGuard(before.story!), action: 'SET_MODE', mode: 'guided' };
    expect(await submitScopedSceneCommand(store, scope, mode, observation(scope))).toMatchObject({ ok: false });
    expect(store.getState().project).toEqual(before);
    await submitScopedSceneCommand(store, scope, mode, observation(scope, { paused: true, elapsedMs: 0 }));
    const changed = decodeStoredProject((await storage.readRaw()).draft), save = vi.spyOn(storage, 'save');
    expect(changed.story).toMatchObject({ nodeId: 'intro', mode: 'guided', revision: 1 }); expect(changed.saveRevision).toBe(before.saveRevision + 1);
    await submitScopedSceneCommand(store, scope, old, observation(scope));
    expect(save).not.toHaveBeenCalled(); expect(store.getState().project).toEqual(changed);
  });

  it('allows only an explicit user intro skip, even at zero elapsed time while paused', async () => {
    const { store, storage } = await open(), scope = createNodeScope('intro:skip', vi.fn());
    const command = introSkipCommand(storyGuard(store.getState().project!.story!));
    expect(command).toMatchObject({ action: 'COMPLETE_SCENE', source: 'user', skipped: true });
    await submitScopedSceneCommand(store, scope, command, observation(scope, { paused: true, elapsedMs: 0 }));
    expect(decodeStoredProject((await storage.readRaw()).draft).story).toMatchObject({ nodeId: 'craft', revision: 1 });
    expect(() => introSkipCommand(storyGuard(store.getState().project!.story!))).toThrow('只有序幕');
  });

  it('rejects a forged script skip and a user skip forged for another cinematic', async () => {
    for (const nodeId of ['intro', 'memory-separate'] as const) {
      const { store, storage } = await open(at(nodeId)), scope = createNodeScope(nodeId, vi.fn()), raw = await storage.readRaw();
      const forged = { ...storyGuard(store.getState().project!.story!), action: 'COMPLETE_SCENE', source: nodeId === 'intro' ? 'script' : 'user', skipped: true } as SceneCommand;
      expect(await submitScopedSceneCommand(store, scope, forged, observation(scope))).toMatchObject({ ok: false });
      expect(await storage.readRaw()).toEqual(raw); expect(store.getState().project!.story!.nodeId).toBe(nodeId);
    }
  });

  it('keeps a failed scene unapplied and retries its exact candidate after scope exit without rebuilding it', async () => {
    const { store, storage, later } = await open(at('memory-separate')), scope = createNodeScope('separation:failure', vi.fn());
    const before = store.getState().project!, raw = await storage.readRaw(), command = sceneCommand(store); failNextDraft();
    const save = vi.spyOn(storage, 'save');
    expect(await submitScopedSceneCommand(store, scope, command, observation(scope))).toMatchObject({ ok: false });
    expect(store.getState()).toMatchObject({ hasPending: true, project: { story: { nodeId: 'memory-separate' } } });
    expect(store.getState().project).toEqual(before); expect(await storage.readRaw()).toEqual(raw);
    const candidate = store.getExportProject()!, firstCandidate = structuredClone(save.mock.calls[0]![0]);
    expect(candidate.story!.nodeId).toBe('road');
    scope.dispose(); later();
    expect(await submitScopedSceneCommand(store, scope, command, observation(scope))).toMatchObject({ ok: false });
    expect(save).toHaveBeenCalledTimes(1);
    expect(await store.retryPending()).toMatchObject({ ok: true });
    expect(save.mock.calls[1]![0]).toEqual(firstCandidate);
    const restored = decodeStoredProject((await storage.readRaw()).draft);
    expect(restored.story).toEqual(candidate.story); expect(restored.projectId).toBe(candidate.projectId);
    expect(restored.stage).toEqual(candidate.stage); expect(restored.pose).toEqual(candidate.pose);
    expect(restored.saveRevision).toBe(before.saveRevision + 1); expect(store.getState().hasPending).toBe(false);
  });
});
