/// <reference types="vite/client" />
import { stageEventTimbre, stageSoundCues } from '../content/sound-cues';
import type { StageSoundEvent, StageTimbre } from '../content/sound-cues';
import type { StoryNodeId, StoryProgress } from '../domain/types';

export interface StageSoundStatus {
  state: 'muted' | 'blocked' | 'enabling' | 'enabled' | 'unavailable' | 'error' | 'disposed';
  message: string;
}
export interface StageSoundSample {
  nodeId: StoryNodeId; mode: StoryProgress['mode']; elapsedMs: number; playing: boolean;
  definitionVersion?: StoryProgress['definitionVersion'];
  event?: StageSoundEvent;
}

// The small structural interface permits lifecycle tests without pretending a
// fake context proves browser autoplay or speaker behaviour.
interface SoundParam {
  setValueAtTime(value: number, time: number): unknown;
  linearRampToValueAtTime(value: number, time: number): unknown;
}
interface SoundNode { connect(destination: unknown): unknown; disconnect(): void }
interface SoundSource extends SoundNode {
  onended: (() => void) | null; start(time?: number): void; stop(time?: number): void;
}
interface SoundOscillator extends SoundSource { type: OscillatorType; frequency: SoundParam }
interface SoundBuffer { getChannelData(channel: number): Float32Array }
interface SoundBufferSource extends SoundSource { buffer: SoundBuffer | null }
interface SoundGain extends SoundNode { gain: SoundParam }
export interface StageAudioContext {
  readonly currentTime: number; readonly sampleRate: number; readonly state: string;
  readonly destination: unknown;
  resume(): Promise<void>; close(): Promise<void>;
  createGain(): SoundGain; createOscillator(): SoundOscillator;
  createBuffer(channels: number, length: number, sampleRate: number): SoundBuffer;
  createBufferSource(): SoundBufferSource;
}
export interface StageSoundOptions {
  legacy?: boolean;
  createContext?: (() => StageAudioContext) | null;
}
interface Voice { source: SoundSource; gain: SoundGain; started: boolean; released: boolean }
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);
const maxLatenessMs = 220;

function browserFactory(): (() => StageAudioContext) | null {
  if (typeof window === 'undefined' || typeof window.AudioContext !== 'function') return null;
  // Native AudioNode.connect has overloads; the internal structural interface
  // deliberately hides them from callers, which never provide arbitrary nodes.
  return () => new window.AudioContext() as unknown as StageAudioContext;
}

export function createStageSound(onStatus: (status: StageSoundStatus) => void, options: StageSoundOptions = {}) {
  const legacy = options.legacy ?? !!import.meta.env.LEGACY;
  const factory = legacy ? null : options.createContext === undefined ? browserFactory() : options.createContext;
  let context: StageAudioContext | null = null, disposed = false, enabled = false, generation = 0;
  let pending: Promise<boolean> | null = null, sample: StageSoundSample | null = null, cursor = -1;
  const voices = new Set<Voice>(), consumed = new Set<string>();
  const listeners = new Set<(status: StageSoundStatus) => void>();
  let status: StageSoundStatus = { state: factory ? 'muted' : 'unavailable', message: '' };

  function report(state: StageSoundStatus['state'], message: string) {
    status = { state, message }; onStatus(status); listeners.forEach(listener => listener(status));
  }
  function release(voice: Voice, stop: boolean): string[] {
    if (voice.released) return [];
    voice.released = true; voices.delete(voice); voice.source.onended = null;
    const errors: string[] = [];
    if (stop && voice.started) try { voice.source.stop(); } catch (error) { errors.push(errorText(error)); }
    try { voice.source.disconnect(); } catch (error) { errors.push(errorText(error)); }
    try { voice.gain.disconnect(); } catch (error) { errors.push(errorText(error)); }
    return errors;
  }
  function stopVoices() {
    const errors: string[] = [];
    for (const voice of Array.from(voices)) errors.push(...release(voice, true));
    return errors;
  }
  function closeContext() {
    const old = context; context = null;
    if (!old || old.state === 'closed') return;
    const failedClose=(error:unknown)=>report(disposed?'disposed':enabled?'enabled':pending?'enabling':'error',`上一音频设备关闭失败：${errorText(error)}。${enabled?'当前音效仍可通过开关关闭。':'静音下仍可完成本场。'}`);
    try {
      void old.close().catch(failedClose);
    } catch (error) { failedClose(error); }
  }
  function fail(error: unknown) {
    generation++; pending = null; enabled = false;
    const cleanup = stopVoices(); closeContext();
    const blocked = !!error && typeof error === 'object' && 'name' in error && error.name === 'NotAllowedError';
    report(blocked ? 'blocked' : 'error', blocked ? '舞台音效默认开启；点击或按键后由浏览器自动解锁。' : `声音未能播放，静音下仍可完成本场。可重新开启声音：${errorText(error)}${cleanup.length ? `；清理报告：${cleanup.join('；')}` : ''}`);
  }
  function consumePast(time: number, preserveStart = false) {
    if (!sample) return;
    for (const cue of stageSoundCues(sample.nodeId, sample.mode, sample.definitionVersion)) {
      if (cue.atMs <= time && !(preserveStart && cue.atMs === 0 && time === 0)) consumed.add(cue.id);
    }
  }
  function synthesize(timbre: StageTimbre) {
    const active = context;
    if (!active || !enabled || active.state !== 'running') throw new Error('音频设备未运行。');
    const now = active.currentTime;
    function voice(kind: 'sine' | 'triangle' | 'noise', hz: number, endHz: number, duration: number, volume: number) {
      const gain = active!.createGain();
      let source: SoundSource;
      try {
        source = kind === 'noise' ? active!.createBufferSource() : active!.createOscillator();
      } catch (error) {
        try { gain.disconnect(); } catch (cleanup) { throw new Error(`${errorText(error)}；${errorText(cleanup)}`); }
        throw error;
      }
      const owned: Voice = { source, gain, started: false, released: false }; voices.add(owned);
      try {
        if (kind === 'noise') {
          const buffer = active!.createBuffer(1, Math.max(1, Math.floor(active!.sampleRate * duration)), active!.sampleRate);
          const data = buffer.getChannelData(0); let seed = 20261018, previous = 0;
          for (let index = 0; index < data.length; index++) {
            seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
            previous = previous * .72 + ((seed >>> 0) / 2147483648 - 1) * .28;
            data[index] = previous;
          }
          (source as SoundBufferSource).buffer = buffer;
        } else {
          const oscillator = source as SoundOscillator; oscillator.type = kind;
          oscillator.frequency.setValueAtTime(hz, now);
          oscillator.frequency.linearRampToValueAtTime(endHz, now + duration);
        }
        source.connect(gain); gain.connect(active!.destination);
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + .012);
        gain.gain.linearRampToValueAtTime(0, now + duration);
        source.onended = () => {
          const errors = release(owned, false);
          if (errors.length) fail(new Error(errors.join('；')));
        };
        source.start(now); owned.started = true; source.stop(now + duration);
      } catch (error) {
        const cleanup = release(owned, true);
        throw new Error(`${errorText(error)}${cleanup.length ? `；${cleanup.join('；')}` : ''}`);
      }
    }
    if (timbre === 'lamp') voice('triangle', 660, 440, .24, .035);
    else if (timbre === 'low-drum') voice('sine', 118, 52, .42, .075);
    else if (timbre === 'settle') voice('triangle', 392, 294, .48, .028);
    else { voice('noise', 0, 0, .48, .055); voice('sine', 94, 43, .36, .065); }
  }

  function update(next: StageSoundSample) {
    if (disposed) return;
    const elapsedMs = Number.isFinite(next.elapsedMs) ? Math.max(0, next.elapsedMs) : 0;
    const changed = !sample || next.nodeId !== sample.nodeId || next.mode !== sample.mode || next.definitionVersion !== sample.definitionVersion;
    const resumed = !!sample && !sample.playing && next.playing;
    if (changed) {
      const errors = stopVoices(); if (errors.length) fail(new Error(errors.join('；')));
      consumed.clear(); cursor = -1;
    }
    sample = { ...next, elapsedMs };
    if (!next.playing) {
      const errors = stopVoices(); if (errors.length) fail(new Error(errors.join('；')));
      consumePast(elapsedMs, true);
      if (next.event) consumed.add(`event:${next.event}`);
      cursor = elapsedMs === 0 ? -1 : elapsedMs;
      return;
    }
    // Resuming does not backfill cues from a pause or from a muted interval.
    if (resumed) consumePast(elapsedMs, true);
    for (const cue of stageSoundCues(next.nodeId, next.mode, next.definitionVersion)) {
      if (consumed.has(cue.id) || cue.atMs > elapsedMs) continue;
      consumed.add(cue.id);
      if (enabled && cue.atMs > cursor && elapsedMs - cue.atMs <= maxLatenessMs) {
        try { synthesize(cue.timbre); } catch (error) { fail(error); }
      }
    }
    if (next.event) {
      const key = `event:${next.event}`, timbre = stageEventTimbre(next.nodeId, next.event);
      if (!consumed.has(key)) {
        consumed.add(key);
        if (enabled && timbre) try { synthesize(timbre); } catch (error) { fail(error); }
      }
    }
    cursor = elapsedMs;
  }

  function enable(retryPending = false): Promise<boolean> {
    if (disposed) return Promise.resolve(false);
    if (!factory) { report('unavailable', '当前浏览器不支持声音合成，静音下仍可完成本场。'); return Promise.resolve(false); }
    if (pending) {
      // resume() may stay pending until a user gesture. Invoke it again inside
      // that gesture, rather than just returning the pre-gesture promise.
      if (retryPending && context) {
        const retryContext=context,retryGeneration=generation;
        const retryFailed=(error:unknown)=>{if(!disposed&&retryContext===context&&retryGeneration===generation)fail(error);};
        try { void retryContext.resume().catch(retryFailed); } catch (error) { retryFailed(error); }
      }
      return pending ?? Promise.resolve(false);
    }
    if (enabled && context?.state === 'running') return Promise.resolve(true);
    const token = ++generation;
    report('enabling', '正在开启原创合成舞台音效…');
    try { context ??= factory(); } catch (error) { fail(error); return Promise.resolve(false); }
    const active = context;
    // Mark already passed cues before resume, so enabling midway never replays
    // a low drum or an opening effect from earlier in the scene.
    consumePast(sample?.elapsedMs ?? 0, true);
    let resumed: Promise<void>;
    try { resumed = active.resume(); } catch (error) { fail(error); return Promise.resolve(false); }
    if (active.state !== 'running') report('blocked', '舞台音效默认开启；点击或按键后由浏览器自动解锁。');
    const operation = resumed.then(() => {
        if (disposed || token !== generation || active !== context) return false;
        pending = null;
        if (active.state !== 'running') { fail(new Error('浏览器未允许音频设备运行。')); return false; }
        enabled = true; report('enabled', '原创合成舞台音效已开启；暂停时不发声。'); return true;
      }, error => {
        if (!disposed && token === generation && active === context) fail(error);
        return false;
      });
    pending = operation; return operation;
  }

  function mute() {
    if (disposed) return;
    generation++; pending = null; enabled = false;
    const errors = stopVoices(); closeContext(); consumePast(sample?.elapsedMs ?? 0, true);
    report(errors.length ? 'error' : 'muted', errors.length ? `已静音；清理报告：${errors.join('；')}` : '声音已静音。字幕与互动保持完整。');
  }
  function reset(nodeId: StoryNodeId) {
    if (disposed) return;
    const errors = stopVoices(); if (errors.length) fail(new Error(errors.join('；')));
    consumed.clear(); cursor = -1;
    sample = sample ? { nodeId, mode: sample.mode, definitionVersion: sample.definitionVersion, elapsedMs: 0, playing: false } : null;
  }
  function seek(next: StageSoundSample) {
    if (disposed) return;
    const errors = stopVoices(); if (errors.length) fail(new Error(errors.join('；')));
    sample = { ...next, elapsedMs: Number.isFinite(next.elapsedMs) ? Math.max(0, next.elapsedMs) : 0 };
    consumed.clear(); consumePast(sample.elapsedMs); cursor = sample.elapsedMs;
    if (next.event) consumed.add(`event:${next.event}`);
  }
  function dispose() {
    if (disposed) return;
    disposed = true; generation++; pending = null; enabled = false;
    const errors = stopVoices(); closeContext(); consumed.clear(); sample = null;
    report('disposed', errors.length ? `声音已退出；清理报告：${errors.join('；')}` : '声音已退出。');
  }
  report(factory ? 'muted' : 'unavailable', factory ? '默认静音。可选择开启原创合成舞台音效。' : '当前浏览器不支持声音合成，静音下仍可完成本场。');
  return { enable, mute, update, reset, seek, dispose,
    getStatus: () => ({ ...status }),
    subscribe(listener: (next: StageSoundStatus) => void) { listeners.add(listener); listener({ ...status }); return () => { listeners.delete(listener); }; },
  };
}
