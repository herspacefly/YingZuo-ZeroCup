import { describe, expect, it } from 'vitest';
import { createStageVoice } from '../../src/audio/stage-voice';
import type { StageVoiceSample, StageVoiceStatus, VoiceMedia } from '../../src/audio/stage-voice';

function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}
function fake() {
  const listeners = new Map<string, Set<() => void>>(), gates: ReturnType<typeof deferred>[] = [];
  let audible = false, time = 0;
  const calls = { plays: 0, pauses: 0, loads: 0, seeks: 0 };
  const media: VoiceMedia = {
    src: '', preload: '', volume: 1, loop: false, readyState: 1, error: null,
    get currentTime() { return time; }, set currentTime(value: number) { calls.seeks++; time = value; },
    play() { calls.plays++; const gate = gates.shift(); if (gate) return gate.promise.then(() => { audible = true; }); audible = true; },
    pause() { calls.pauses++; audible = false; }, load() { calls.loads++; },
    removeAttribute(name) { if (name === 'src') media.src = ''; },
    addEventListener(type, listener) { let group = listeners.get(type); if (!group) { group = new Set(); listeners.set(type, group); } group.add(listener); },
    removeEventListener(type, listener) { listeners.get(type)?.delete(listener); },
  };
  return { media, calls, gates, listeners, get audible() { return audible; }, emit(type: string) { for (const listener of [...(listeners.get(type) ?? [])]) listener(); } };
}
const cues = [
  { startMs: 0, endMs: 1500, clip: { id: 'one', src: '/voice/one.mp3', durationMs: 1200 } },
  { startMs: 1500, endMs: 3000, clip: { id: 'two', src: '/voice/two.mp3', durationMs: 1300 } },
];
function sample(elapsedMs = 0, playing = true, token = 'run:revision:node'): StageVoiceSample { return { token, elapsedMs, playing, cues }; }
function setup(gate?: ReturnType<typeof deferred>) {
  const players: ReturnType<typeof fake>[] = [], statuses: StageVoiceStatus[] = [];
  const voice = createStageVoice(value => statuses.push(value), { createAudio: () => {
    const item = fake(); if (!players.length && gate) item.gates.push(gate); players.push(item); return item.media;
  } });
  return { voice, players, statuses };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('clock-following local dialogue audio', () => {
  it('does not allocate before enable, invokes play synchronously in enable and deduplicates frame updates', async () => {
    const gate = deferred(), { voice, players } = setup(gate);
    voice.update(sample(200)); expect(players).toHaveLength(0);
    const attempt = voice.enable(); expect(players).toHaveLength(1); expect(players[0]!.calls.plays).toBe(1);
    expect(players[0]!.media.currentTime).toBe(.2);
    voice.update(sample(216)); voice.update(sample(232)); expect(players[0]!.calls.plays).toBe(1);
    gate.resolve(); expect(await attempt).toBe(true);
    voice.update(sample(248)); expect(players[0]!.calls.plays).toBe(1);
    voice.dispose();
  });
  it('only reports audible playback from the native playing event and restores it on waiting, pause and end', async () => {
    const { voice, players } = setup(); voice.update(sample()); await voice.enable();
    const item = players[0]!; expect(voice.getStatus()).toMatchObject({ state: 'loading', playing: false });
    item.emit('playing'); expect(voice.getStatus()).toMatchObject({ state: 'enabled', playing: true });
    item.emit('waiting'); expect(voice.getStatus()).toMatchObject({ state: 'loading', playing: false });
    item.emit('playing'); item.emit('pause'); expect(voice.getStatus().playing).toBe(false);
    item.emit('playing'); item.emit('ended'); expect(voice.getStatus().playing).toBe(false);
    voice.update(sample(300)); expect(item.calls.plays).toBe(1); voice.dispose();
  });
  it('pauses immediately, retains the media and resumes at director time rather than the start of the line', async () => {
    const { voice, players } = setup(); voice.update(sample(350)); await voice.enable(); const item = players[0]!;
    voice.update(sample(550, false)); expect(item.audible).toBe(false); expect(item.media.src).toBe('/voice/one.mp3');
    voice.update(sample(550, true)); expect(players).toHaveLength(1); expect(item.calls.plays).toBe(2); expect(item.media.currentTime).toBe(.55);
    voice.dispose();
  });
  it('does not seek again on playing after a native seek, and explicit seek can replay an ended cue', async () => {
    const { voice, players } = setup(); voice.update(sample(350)); await voice.enable();
    const item=players[0]!,seeks=item.calls.seeks;
    item.emit('playing');item.emit('waiting');item.emit('playing');
    expect(item.calls.seeks).toBe(seeks);
    item.emit('ended');voice.seek(sample(350));
    expect(players).toHaveLength(2);expect(players[1]!.media.currentTime).toBe(.35);
    expect(players[1]!.audible).toBe(true);voice.dispose();
  });
  it('lets a started native tail finish in the reserved pause without seeking past its duration', async () => {
    const { voice, players } = setup(); voice.update(sample()); await voice.enable(); const first = players[0]!;
    first.emit('playing');first.media.currentTime=1.1;const seeks=first.calls.seeks;
    voice.update(sample(1200)); expect(first.audible).toBe(true); expect(first.media.src).toBe('/voice/one.mp3');
    voice.update(sample(1300,false));expect(first.audible).toBe(false);
    voice.update(sample(1300));expect(first.audible).toBe(true);expect(first.media.currentTime).toBe(1.1);expect(first.calls.seeks).toBe(seeks);
    first.emit('ended');expect(voice.getStatus().playing).toBe(false);
    voice.update(sample(1450)); expect(players).toHaveLength(1);expect(first.media.src).toBe('');
    voice.update(sample(1500)); expect(players).toHaveLength(2); expect(players[1]!.media.src).toBe('/voice/two.mp3');
    voice.dispose();
  });
  it('does not start or revive unstarted late media in the reserved pause, and retires tails at the next cue', async () => {
    const gate=deferred(),{voice,players}=setup(gate);voice.update(sample());const attempt=voice.enable();
    voice.update(sample(1250));gate.resolve();expect(await attempt).toBe(false);expect(players[0]!.audible).toBe(false);
    voice.update(sample(1400));expect(players).toHaveLength(1);
    voice.update(sample(1500));const second=players[1]!;second.emit('playing');second.media.currentTime=1.2;
    voice.update(sample(2850));expect(second.audible).toBe(true);
    voice.update(sample(3000));expect(second.audible).toBe(false);expect(second.media.src).toBe('');voice.dispose();
  });
  it('never replays an ended line and never advances or changes the supplied cue list', async () => {
    const { voice, players } = setup(), input = sample(200); voice.update(input); await voice.enable(); players[0]!.emit('ended');
    voice.update(input); voice.update(sample(400)); expect(players[0]!.calls.plays).toBe(1); expect(input.elapsedMs).toBe(200); expect(input.cues).toBe(cues);
    voice.dispose();
  });
  it('seeks explicitly into the current line, releases the previous request and silences a late resolution', async () => {
    const gate = deferred(), { voice, players } = setup(gate); voice.update(sample()); const oldAttempt = voice.enable();
    voice.seek(sample(700)); expect(players).toHaveLength(2); expect(players[1]!.media.currentTime).toBe(.7);
    gate.resolve(); expect(await oldAttempt).toBe(false); expect(players[0]!.audible).toBe(false); expect(players[1]!.audible).toBe(true);
    voice.dispose();
  });
  it('silences pending play after pause and does not stop a newer valid request on the same media', async () => {
    const gate = deferred(), { voice, players } = setup(gate); voice.update(sample()); const oldAttempt = voice.enable(); const item = players[0]!;
    voice.update(sample(200, false)); voice.update(sample(200, true)); expect(item.calls.plays).toBe(2);
    gate.resolve(); expect(await oldAttempt).toBe(false); expect(item.audible).toBe(true);
    voice.update(sample(250, false)); expect(item.audible).toBe(false); voice.dispose();
  });
  it('aligns delayed metadata and play resolution to the newest time and never reads a missed line from its start', async () => {
    const gate = deferred(), { voice, players } = setup(gate); voice.update(sample(100)); const attempt = voice.enable(); const item = players[0]!;
    Object.assign(item.media, { readyState: 0 }); voice.update(sample(850));
    Object.assign(item.media, { readyState: 1 }); item.emit('loadedmetadata'); expect(item.media.currentTime).toBe(.85);
    voice.update(sample(1100)); gate.resolve(); await attempt; expect(item.media.currentTime).toBeCloseTo(1.1);
    voice.update(sample(1500)); expect(players[1]!.media.currentTime).toBe(0); voice.dispose();
  });
  it('discards delayed media when a new token owns the channel, even if both nodes use the same clip', async () => {
    const gate = deferred(), { voice, players } = setup(gate); voice.update(sample()); const attempt = voice.enable();
    voice.update(sample(100, true, 'another-node')); gate.resolve(); await attempt;
    expect(players[0]!.audible).toBe(false); expect(players[0]!.media.src).toBe(''); expect(players[1]!.audible).toBe(true); voice.dispose();
  });
  it('reports blocked playback, avoids frame retry loops and retries at the current position on explicit enable', async () => {
    const gate = deferred(), { voice, players } = setup(gate); voice.update(sample()); const attempt = voice.enable();
    gate.reject(new DOMException('gesture required', 'NotAllowedError')); expect(await attempt).toBe(false);
    expect(voice.getStatus()).toMatchObject({ state: 'blocked', playing: false });
    voice.update(sample(200)); voice.update(sample(400)); expect(players).toHaveLength(1);
    await voice.enable(); expect(players).toHaveLength(2); expect(players[1]!.media.currentTime).toBe(.4); voice.dispose();
  });
  it('reports decode errors, restores silence and rejects stale errors after disposal', async () => {
    const { voice, players } = setup(); voice.update(sample()); await voice.enable(); const item = players[0]!;
    item.emit('playing'); Object.assign(item.media, { error: { code: 3, message: 'bad media' } }); item.emit('error');
    expect(voice.getStatus()).toMatchObject({ state: 'error', playing: false }); expect(item.audible).toBe(false);
    expect(voice.getStatus().message).toContain('bad media'); voice.update(sample(50)); expect(players).toHaveLength(1);
    await voice.enable(); expect(players).toHaveLength(2); voice.dispose(); item.emit('error'); expect(voice.getStatus().state).toBe('disposed');
  });
  it('activation alone cannot revive old playback, and manual mute survives newer samples', async () => {
    const { voice, players } = setup(); voice.update(sample()); await voice.enable(); voice.setActive(false); expect(players[0]!.audible).toBe(false);
    voice.setActive(true); expect(players[0]!.audible).toBe(false); voice.update(sample(200)); expect(players[0]!.audible).toBe(true);
    voice.mute(); voice.update(sample(300)); expect(players).toHaveLength(1); expect(voice.getStatus().state).toBe('muted'); voice.dispose();
  });
  it('cleans all media listeners and old requests on null, mute, repeated mounts and disposal', async () => {
    const gate = deferred(), { voice, players, statuses } = setup(gate), subscriber: StageVoiceStatus[] = [];
    const unsubscribe = voice.subscribe(value => subscriber.push(value)); voice.update(sample()); const attempt = voice.enable();
    voice.update(null); gate.resolve(); await attempt; expect(players[0]!.audible).toBe(false);
    voice.update(sample(10, true, 'mount-2')); voice.mute(); await voice.enable(); voice.update(sample(20, true, 'mount-3'));
    unsubscribe(); const before = subscriber.length; voice.dispose(); voice.dispose(); voice.update(sample()); await voice.enable();
    expect(subscriber).toHaveLength(before); expect(statuses.at(-1)?.state).toBe('disposed');
    expect(players.every(item => [...item.listeners.values()].every(set => set.size === 0))).toBe(true);
    expect(players.every(item => !item.audible && item.media.src === '')).toBe(true); await flush();
  });
  it('reports missing capability without allocating or throwing', async () => {
    const voice = createStageVoice(() => {}, { createAudio: null }); voice.update(sample()); expect(await voice.enable()).toBe(false);
    expect(voice.getStatus()).toMatchObject({ state: 'unavailable', playing: false }); voice.dispose();
  });
});
