import { describe, expect, it } from 'vitest';
import { createStageSound } from '../../src/audio/stage-sound';
import type { StageAudioContext, StageSoundSample, StageSoundStatus } from '../../src/audio/stage-sound';
import { stageEventTimbre, stageSoundCues } from '../../src/content/sound-cues';
import { definitionFor, reunionDefinition } from '../../src/content/reunion';

function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function fakeContext(resumeGate?: ReturnType<typeof deferred>) {
  const sources: { started: number; stopped: number; disconnected: number; stopTimes: (number | undefined)[];
    onended: (() => void) | null; type: OscillatorType; frequency: ReturnType<typeof param>; buffer: { getChannelData(): Float32Array } | null;
    connect(): void; disconnect(): void; start(): void; stop(time?: number): void }[] = [];
  const gains: { disconnected: number; gain: ReturnType<typeof param>; connect(): void; disconnect(): void }[] = [];
  let closeCount = 0, resumeCount = 0, startError = false;
  function param() {
    return { values: [] as [number, number][], setValueAtTime(value: number, time: number) { this.values.push([value, time]); },
      linearRampToValueAtTime(value: number, time: number) { this.values.push([value, time]); } };
  }
  function source() {
    const result = { started: 0, stopped: 0, disconnected: 0, stopTimes: [] as (number | undefined)[],
      onended: null as (() => void) | null, type: 'sine' as OscillatorType, frequency: param(),
      buffer: null as { getChannelData(): Float32Array } | null,
      connect() { /* fake graph; no audio hardware */ }, disconnect() { this.disconnected++; },
      start() { if (startError) throw new Error('device start failed'); this.started++; },
      stop(time?: number) { this.stopped++; this.stopTimes.push(time); } };
    sources.push(result); return result;
  }
  const context = { currentTime: 12, sampleRate: 48000, state: 'suspended', destination: {},
    async resume() { resumeCount++; if (resumeGate) await resumeGate.promise; if (context.state !== 'closed') context.state = 'running'; },
    async close() { closeCount++; context.state = 'closed'; },
    createOscillator: source, createBufferSource: source,
    createGain() {
      const gain = { disconnected: 0, gain: param(), connect() { /* fake graph */ }, disconnect() { this.disconnected++; } };
      gains.push(gain); return gain;
    },
    createBuffer(_channels: number, length: number) { const data = new Float32Array(length); return { getChannelData() { return data; } }; },
  } satisfies StageAudioContext;
  return { context, sources, gains, get closeCount() { return closeCount; }, get resumeCount() { return resumeCount; },
    failStart() { startError = true; } };
}
function setup(gate?: ReturnType<typeof deferred>) {
  const statuses: StageSoundStatus[] = [], contexts: ReturnType<typeof fakeContext>[] = [];
  const sound = createStageSound(status => statuses.push(status), { legacy: false, createContext: () => {
    const fake = fakeContext(gate); contexts.push(fake); return fake.context;
  } });
  return { sound, contexts, statuses };
}
const sample = (overrides: Partial<StageSoundSample> = {}): StageSoundSample =>
  ({ nodeId: 'intro', mode: 'full', elapsedMs: 0, playing: false, ...overrides });

describe('T10 finite opt-in stage sound lifecycle', () => {
  it('reissues a still-pending context resume synchronously in the next gesture without duplicating the session',async()=>{
    const gate=deferred(),{sound,contexts,statuses}=setup(gate);
    const startup=sound.enable();expect(statuses.at(-1)?.state).toBe('blocked');
    const gesture=sound.enable(true);expect(gesture).toBe(startup);expect(contexts[0]!.resumeCount).toBe(2);
    gate.resolve();expect(await startup).toBe(true);expect(contexts[0]!.sources).toHaveLength(0);sound.dispose();
  });
  it('does not let an old close rejection hide the current enabled mute control',async()=>{
    const statuses:StageSoundStatus[]=[],old=fakeContext(),fresh=fakeContext(),gate=deferred();let count=0;
    old.context.close=()=>{old.context.state='closed';return gate.promise;};
    const sound=createStageSound(status=>statuses.push(status),{legacy:false,createContext:()=>count++?fresh.context:old.context});
    await sound.enable();sound.mute();await sound.enable();gate.reject(new Error('late old close failure'));await Promise.resolve();await Promise.resolve();
    expect(statuses.at(-1)?.state).toBe('enabled');expect(statuses.at(-1)?.message).toContain('上一音频设备');
    sound.mute();expect(fresh.context.state).toBe('closed');expect(statuses.at(-1)?.state).toBe('muted');
  });
  it('creates no context or source until explicitly enabled, and enabling does not start the scene', async () => {
    const { sound, contexts, statuses } = setup();
    sound.update(sample());
    sound.update(sample({ playing: true, elapsedMs: 3000 }));
    expect(contexts).toHaveLength(0); expect(statuses.at(-1)?.state).toBe('muted');
    expect(await sound.enable()).toBe(true);
    expect(contexts).toHaveLength(1); expect(contexts[0]!.sources).toHaveLength(0);
    sound.update(sample({ playing: true, elapsedMs: 3010 }));
    expect(contexts[0]!.sources).toHaveLength(0);
    sound.update(sample({ playing: true, elapsedMs: 4001 }));
    expect(contexts[0]!.sources).toHaveLength(1);
  });

  it('starts a first cue on play, deduplicates samples, and frees ended sources', async () => {
    const { sound, contexts } = setup(); sound.update(sample()); await sound.enable();
    sound.update(sample({ playing: true })); sound.update(sample({ playing: true }));
    sound.update(sample({ playing: true, elapsedMs: 16 }));
    const fake = contexts[0]!; expect(fake.sources).toHaveLength(1);
    const source = fake.sources[0]!; expect(source.started).toBe(1); expect(source.stopTimes[0]).toBeGreaterThan(12);
    source.onended!(); expect(source.disconnected).toBe(1); expect(fake.gains[0]!.disconnected).toBe(1);
    sound.dispose(); expect(source.disconnected).toBe(1);
  });

  it('cuts sound immediately on pause without replaying it on resume or filling missed cues', async () => {
    const { sound, contexts } = setup(); sound.update(sample()); await sound.enable();
    sound.update(sample({ playing: true })); const first = contexts[0]!.sources[0]!;
    sound.update(sample({ elapsedMs: 100 }));
    expect(first.stopTimes).toEqual([12.24, undefined]); expect(first.disconnected).toBe(1);
    sound.update(sample({ elapsedMs: 4100 })); sound.update(sample({ playing: true, elapsedMs: 4100 }));
    expect(contexts[0]!.sources).toHaveLength(1); expect(contexts[0]!.closeCount).toBe(0);
  });

  it('skips long-frame backlog and never repeats cues after a backward sample', async () => {
    const { sound, contexts } = setup(); sound.update(sample()); await sound.enable();
    sound.update(sample({ playing: true, elapsedMs: 2000 }));
    sound.update(sample({ playing: true, elapsedMs: 4700 }));
    sound.update(sample({ playing: true, elapsedMs: 4000 }));
    expect(contexts[0]!.sources).toHaveLength(0);
  });

  it('restarts the same node only through reset and stops sources when a node changes', async () => {
    const { sound, contexts } = setup(); sound.update(sample()); await sound.enable();
    sound.update(sample({ playing: true })); sound.reset('intro'); sound.update(sample({ playing: true }));
    expect(contexts[0]!.sources).toHaveLength(2); expect(contexts[0]!.sources[0]!.disconnected).toBe(1);
    sound.update(sample({ nodeId: 'craft', playing: false }));
    expect(contexts[0]!.sources[1]!.disconnected).toBe(1);
    sound.update(sample({ nodeId: 'memory-separate', playing: true }));
    expect(contexts[0]!.sources).toHaveLength(3);
  });

  for (const action of ['mute', 'dispose', 'pause', 'node-change', 'reset'] as const) {
    it(`does not revive the old node when enable resolves after ${action}`, async () => {
      const gate = deferred(), { sound, contexts, statuses } = setup(gate);
      sound.update(sample({ playing: true })); const result = sound.enable();
      if (action === 'mute') sound.mute();
      else if (action === 'dispose') sound.dispose();
      else if (action === 'reset') sound.reset('intro');
      else sound.update(sample(action === 'pause' ? {} : { nodeId: 'craft', playing: true }));
      const retired=action==='mute'||action==='dispose';
      gate.resolve(); expect(await result).toBe(!retired);
      expect(contexts[0]!.sources).toHaveLength(0); expect(contexts[0]!.closeCount).toBe(retired?1:0);
      expect(statuses.at(-1)?.state).toBe(action === 'dispose' ? 'disposed' : retired ? 'muted' : 'enabled');
      // A resume completion may unlock the device, but cannot itself play a cue
      // from the retired scene. Only a new director sample can make sound.
      sound.update(sample({ elapsedMs: 4000 }));
      sound.update(sample({ playing: true, elapsedMs: 4000 }));
      expect(contexts[0]!.sources).toHaveLength(0);
    });
  }

  it('stops and closes on mute, allows a fresh explicit enable, and makes disposal idempotent', async () => {
    const { sound, contexts } = setup(); sound.update(sample()); await sound.enable();
    sound.update(sample({ playing: true })); sound.mute();
    expect(contexts[0]!.sources[0]!.disconnected).toBe(1); expect(contexts[0]!.closeCount).toBe(1);
    expect(await sound.enable()).toBe(true); expect(contexts).toHaveLength(2);
    sound.update(sample({ playing: true, elapsedMs: 4000 }));
    expect(contexts[1]!.sources).toHaveLength(1);
    sound.dispose(); sound.dispose(); expect(contexts[1]!.closeCount).toBe(1);
    expect(contexts[1]!.sources[0]!.disconnected).toBe(1); expect(await sound.enable()).toBe(false);
  });

  it('reports legacy and absent capability without calling a factory', async () => {
    let called = false; const statuses: StageSoundStatus[] = [];
    const legacy = createStageSound(status => statuses.push(status), { legacy: true, createContext: () => { called = true; return fakeContext().context; } });
    expect(await legacy.enable()).toBe(false); expect(called).toBe(false); expect(statuses.at(-1)?.state).toBe('unavailable');
    const absent = createStageSound(status => statuses.push(status), { legacy: false, createContext: null });
    expect(await absent.enable()).toBe(false); expect(statuses.at(-1)?.message).toContain('静音');
  });

  it('reports a refused resume, closes resources, and permits an explicit fresh attempt', async () => {
    const gate = deferred(), { sound, contexts, statuses } = setup(gate);
    sound.update(sample()); const attempt = sound.enable(); gate.reject(new Error('autoplay refused'));
    expect(await attempt).toBe(false); expect(contexts[0]!.closeCount).toBe(1);
    expect(statuses.at(-1)).toMatchObject({ state: 'error' }); expect(statuses.at(-1)?.message).toContain('autoplay refused');
    sound.dispose(); expect(await sound.enable()).toBe(false);
  });

  it('cleans partially created sources after an actual source-start failure', async () => {
    const { sound, contexts, statuses } = setup(); sound.update(sample()); await sound.enable(); contexts[0]!.failStart();
    sound.update(sample({ playing: true }));
    expect(contexts[0]!.sources[0]!.disconnected).toBe(1); expect(contexts[0]!.gains[0]!.disconnected).toBe(1);
    expect(contexts[0]!.closeCount).toBe(1); expect(statuses.at(-1)?.state).toBe('error');
    expect(statuses.at(-1)?.message).toContain('device start failed');
  });

  it('ties mountain and search effects to actual events once, never to interactive waiting time', async () => {
    const { sound, contexts } = setup(); sound.update(sample({ nodeId: 'split-axe' })); await sound.enable();
    sound.update(sample({ nodeId: 'split-axe', playing: true, elapsedMs: 60000 }));
    expect(contexts[0]!.sources).toHaveLength(0);
    sound.update(sample({ nodeId: 'split-axe', playing: true, elapsedMs: 60000, event: 'mountain-open' }));
    sound.update(sample({ nodeId: 'split-axe', playing: true, elapsedMs: 60016, event: 'mountain-open' }));
    expect(contexts[0]!.sources).toHaveLength(2);
    const noise = contexts[0]!.sources.find(item => item.buffer)!;
    expect(noise.buffer!.getChannelData().length).toBe(23040);
    expect(noise.buffer!.getChannelData().some(value => value !== 0)).toBe(true);
    sound.update(sample({ nodeId: 'split-search', playing: true, event: 'light-found' }));
    expect(contexts[0]!.sources).toHaveLength(3);
    expect(contexts[0]!.sources[0]!.disconnected).toBe(1);
  });

  it('keeps the reunion hold completely silent for its first two seconds in both modes', async () => {
    for (const definitionVersion of [1,2,3] as const) for (const mode of ['full', 'guided'] as const) {
      const { sound, contexts } = setup(); sound.update(sample({ nodeId: 'reunion-hold', mode,definitionVersion })); await sound.enable();
      for (const elapsedMs of [0, 1000, 1999, 2000, 2499]) sound.update(sample({ nodeId: 'reunion-hold', mode,definitionVersion, playing: true, elapsedMs }));
      expect(contexts[0]!.sources).toHaveLength(0);
      sound.update(sample({ nodeId: 'reunion-hold', mode,definitionVersion, playing: true, elapsedMs: 2500 }));
      expect(contexts[0]!.sources).toHaveLength(1); sound.dispose();
    }
  });

  it('maps finite cues to the same shot proportions in both modes and only permits relevant event types', () => {
    for (const node of reunionDefinition.nodes) {
      const full = stageSoundCues(node.id, 'full'), guided = stageSoundCues(node.id, 'guided');
      expect(full.length).toBe(guided.length);
      for (let index = 0; index < full.length; index++) {
        expect(full[index]!.atMs).toBeLessThan(node.fullTiming.targetMs);
        expect(guided[index]!.atMs).toBeLessThan(node.guidedTiming.targetMs);
        expect(guided[index]!.atMs / node.guidedTiming.targetMs).toBeCloseTo(full[index]!.atMs / node.fullTiming.targetMs);
      }
    }
    expect(stageEventTimbre('reunion-hold', 'mountain-open')).toBeNull();
    expect(stageEventTimbre('call-split', 'mountain-open')).toBe('mountain');
    expect(stageEventTimbre('call-light', 'light-found')).toBe('lamp');
    expect(stageEventTimbre('reunion-reach', 'hands-meet')).toBe('settle');
  });
  it('maps cues using the actual restored definition rather than the current default',()=>{
    for(const definitionVersion of [1,2,3] as const){
      const definition=definitionFor({definitionVersion}),node=definition.nodes.find(item=>item.id==='intro')!;
      const cues=stageSoundCues('intro','guided',definitionVersion);
      expect(cues.find(cue=>cue.id==='separate')!.atMs).toBeCloseTo(4000/node.fullTiming.targetMs*node.guidedTiming.targetMs);
    }
    expect(stageSoundCues('intro','guided',1)).not.toEqual(stageSoundCues('intro','guided',3));
  });
  it('seeks silently, stops old voices and consumes passed cues without a catch-up sound',async()=>{
    const {sound,contexts}=setup();sound.update(sample());await sound.enable();sound.update(sample({playing:true}));
    sound.seek(sample({elapsedMs:4000,playing:true}));expect(contexts[0]!.sources[0]!.disconnected).toBe(1);
    sound.update(sample({elapsedMs:4000,playing:true}));sound.update(sample({elapsedMs:4016,playing:true}));
    expect(contexts[0]!.sources).toHaveLength(1);
    sound.seek(sample({elapsedMs:0,playing:true}));sound.update(sample({elapsedMs:0,playing:true}));
    expect(contexts[0]!.sources).toHaveLength(1);
    sound.update(sample({elapsedMs:4000,playing:true}));expect(contexts[0]!.sources).toHaveLength(2);
  });
});
