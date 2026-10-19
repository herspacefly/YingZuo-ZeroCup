import { describe, expect, it } from 'vitest';
import { createStageMusic } from '../../src/audio/stage-music';
import type { MusicMedia, MusicStatus, MusicTrack } from '../../src/audio/stage-music';

function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

function fakeMedia() {
  const listeners = new Set<() => void>();
  const gates: (ReturnType<typeof deferred> | null)[] = [];
  const calls = { play: 0, pause: 0, load: 0, removeSrc: 0, removeListener: 0 };
  const failures = { play: false, pause: false, load: false, removeSrc: false, removeListener: false };
  let audible = false, currentTime = 0;
  const media = {
    src: '', preload: '', volume: 1, loop: false, error: null as { code: number; message?: string } | null,
    get currentTime() { return currentTime; }, set currentTime(value: number) { currentTime = value; },
    play() {
      calls.play++;
      if (failures.play) throw new Error('play failed');
      const gate = gates.shift();
      if (gate) return gate.promise.then(() => { audible = true; });
      audible = true;
      return undefined;
    },
    pause() { calls.pause++; if (failures.pause) throw new Error('pause failed'); audible = false; },
    load() { calls.load++; if (failures.load) throw new Error('load failed'); },
    removeAttribute(name: string) {
      calls.removeSrc++;
      if (failures.removeSrc) throw new Error('remove src failed');
      if (name === 'src') media.src = '';
    },
    addEventListener(_type: 'error', listener: () => void) { listeners.add(listener); },
    removeEventListener(_type: 'error', listener: () => void) {
      calls.removeListener++;
      if (failures.removeListener) throw new Error('remove listener failed');
      listeners.delete(listener);
    },
  } satisfies MusicMedia & { currentTime: number };
  return { media, calls, failures, gates, listeners, get audible() { return audible; },
    error(message: string) { media.error = { code: 3, message }; for (const listener of Array.from(listeners)) listener(); } };
}

const tracks: readonly MusicTrack[] = [
  { id: 'instrumental', src: '/assets/audio/instrumental.mp3', title: '器乐', credit: '来源A', volume: .25, loop: true },
  { id: 'curtain', src: '/assets/audio/curtain.mp3', title: '谢幕唱段', credit: '来源B', volume: .4, loop: false },
];

function setup(gates: ReturnType<typeof deferred>[] = []) {
  const statuses: MusicStatus[] = [], players: ReturnType<typeof fakeMedia>[] = [];
  const music = createStageMusic(status => statuses.push(status), { tracks, createAudio: () => {
    const fake = fakeMedia(); if (!players.length) fake.gates.push(...gates); players.push(fake); return fake.media;
  } });
  return { music, statuses, players };
}

const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); };

describe('opt-in local stage music lifecycle', () => {
  it('creates and loads nothing until an enabled sample actually asks for a track', async () => {
    const { music, statuses, players } = setup();
    music.update({ trackId: 'instrumental', playing: true });
    expect(players).toHaveLength(0); expect(statuses.at(-1)?.state).toBe('muted');
    music.update({ trackId: 'instrumental', playing: false });
    expect(await music.enable()).toBe(true); expect(players).toHaveLength(0);
    music.update({ trackId: null, playing: true }); expect(players).toHaveLength(0);
    music.update({ trackId: 'instrumental', playing: true });
    expect(players).toHaveLength(1); expect(players[0]!.media.src).toBe(tracks[0]!.src);
    expect(players[0]!.media.volume).toBe(.25); expect(players[0]!.media.loop).toBe(true);
    expect(statuses.at(-1)).toMatchObject({ state: 'enabled', trackId: 'instrumental' });
  });

  it('calls play synchronously during explicit enable, deduplicating pending and running samples', async () => {
    const gate = deferred(), { music, players, statuses } = setup([gate]);
    music.update({ trackId: 'instrumental', playing: true });
    const first = music.enable(), second = music.enable();
    expect(first).toBe(second); expect(players[0]!.calls.play).toBe(1);
    expect(statuses.at(-1)?.state).toBe('enabling');
    music.update({ trackId: 'instrumental', playing: true }); expect(players[0]!.calls.play).toBe(1);
    gate.resolve(); expect(await first).toBe(true);
    music.update({ trackId: 'instrumental', playing: true });
    expect(players[0]!.calls.play).toBe(1); expect(statuses.at(-1)?.state).toBe('enabled');
  });

  it('pauses immediately and resumes the same track at the same position without loading again', async () => {
    const { music, players } = setup(); music.update({ trackId: 'instrumental', playing: true }); await music.enable();
    const first = players[0]!; first.media.currentTime = 12.4;
    music.update({ trackId: 'instrumental', playing: false });
    expect(first.audible).toBe(false); expect(first.media.currentTime).toBe(12.4);
    expect(first.calls.removeSrc).toBe(0); expect(first.calls.load).toBe(0);
    music.update({ trackId: 'instrumental', playing: true });
    expect(players).toHaveLength(1); expect(first.media.currentTime).toBe(12.4); expect(first.calls.play).toBe(2);
  });

  it('releases old tracks and keeps null-track reunion samples silent', async () => {
    const { music, players, statuses } = setup(); music.update({ trackId: 'instrumental', playing: true }); await music.enable();
    const first = players[0]!;
    music.update({ trackId: null, playing: true });
    expect(first.audible).toBe(false); expect(first.media.src).toBe(''); expect(first.listeners.size).toBe(0);
    expect(first.calls.load).toBe(1); expect(players).toHaveLength(1);
    music.update({ trackId: 'curtain', playing: true });
    expect(players).toHaveLength(2); expect(players[1]!.media.src).toBe(tracks[1]!.src);
    expect(players[1]!.media.loop).toBe(false); expect(statuses.at(-1)?.trackId).toBe('curtain');
  });

  for (const action of ['pause', 'mute', 'reset', 'dispose'] as const) {
    it(`cannot revive audio after a pending play resolves following ${action}`, async () => {
      const gate = deferred(), { music, players, statuses } = setup([gate]);
      music.update({ trackId: 'instrumental', playing: true }); const enabling = music.enable();
      if (action === 'pause') music.update({ trackId: 'instrumental', playing: false });
      else music[action]();
      const expected = action === 'dispose' ? 'disposed' : action === 'mute' ? 'muted' : 'enabled';
      gate.resolve(); expect(await enabling).toBe(false); expect(players[0]!.audible).toBe(false);
      expect(statuses.at(-1)?.state).toBe(expected);
      if (action !== 'pause') expect(players[0]!.listeners.size).toBe(0);
    });
  }

  it('does not let late old playback success or a queued error stop a new track', async () => {
    const oldGate = deferred(), { music, players, statuses } = setup([oldGate]);
    music.update({ trackId: 'instrumental', playing: true }); const oldAttempt = music.enable();
    const queuedError = Array.from(players[0]!.listeners)[0]!;
    music.update({ trackId: 'curtain', playing: true });
    const fresh = players[1]!; await flush();
    expect(fresh.audible).toBe(true);
    oldGate.resolve(); expect(await oldAttempt).toBe(false); queuedError();
    expect(players[0]!.audible).toBe(false); expect(fresh.audible).toBe(true);
    expect(statuses.at(-1)).toMatchObject({ state: 'enabled', trackId: 'curtain' });
  });

  it('ignores an old rejection after mute and a new explicit enable', async () => {
    const oldGate = deferred(), { music, players, statuses } = setup([oldGate]);
    music.update({ trackId: 'instrumental', playing: true }); const oldAttempt = music.enable();
    music.mute(); const freshAttempt = music.enable();
    expect(await freshAttempt).toBe(true); oldGate.reject(new Error('old autoplay refusal'));
    expect(await oldAttempt).toBe(false); expect(players[1]!.audible).toBe(true);
    expect(statuses.at(-1)?.state).toBe('enabled');
  });

  it('does not let an old resolution interrupt a valid same-track resume', async () => {
    const oldGate = deferred(), freshGate = deferred(), { music, players, statuses } = setup([oldGate, freshGate]);
    music.update({ trackId: 'instrumental', playing: true }); const oldAttempt = music.enable();
    music.update({ trackId: 'instrumental', playing: false });
    music.update({ trackId: 'instrumental', playing: true });
    freshGate.resolve(); await flush(); expect(players[0]!.audible).toBe(true);
    const paused = players[0]!.calls.pause;
    oldGate.resolve(); expect(await oldAttempt).toBe(false);
    expect(players[0]!.calls.pause).toBe(paused); expect(players[0]!.audible).toBe(true);
    expect(statuses.at(-1)?.state).toBe('enabled');
  });

  it('reports a real play rejection, frees the resource and permits an explicit retry', async () => {
    const gate = deferred(), { music, players, statuses } = setup([gate]);
    music.update({ trackId: 'instrumental', playing: true }); const refused = music.enable();
    gate.reject(new Error('autoplay refused')); expect(await refused).toBe(false);
    expect(statuses.at(-1)?.state).toBe('error'); expect(statuses.at(-1)?.message).toContain('autoplay refused');
    expect(players[0]!.media.src).toBe(''); expect(players[0]!.listeners.size).toBe(0);
    music.update({ trackId: 'instrumental', playing: true }); expect(players).toHaveLength(1);
    const retry = music.enable(); expect(await retry).toBe(true);
  });

  it('reports decoding errors and ignores stale error callbacks after cleanup', async () => {
    const { music, players, statuses } = setup(); music.update({ trackId: 'instrumental', playing: true }); await music.enable();
    const stale = Array.from(players[0]!.listeners)[0]!; players[0]!.error('bad audio decode');
    expect(statuses.at(-1)?.state).toBe('error'); expect(statuses.at(-1)?.message).toContain('bad audio decode');
    expect(players[0]!.calls.load).toBe(1); expect(players[0]!.listeners.size).toBe(0);
    await music.enable(); stale(); expect(statuses.at(-1)?.state).toBe('enabled');
  });

  it('handles old void play implementations, resets the source and makes disposal idempotent', async () => {
    const { music, players, statuses } = setup(); music.update({ trackId: 'curtain', playing: true });
    expect(await music.enable()).toBe(true); music.reset();
    expect(players[0]!.calls.load).toBe(1); expect(statuses.at(-1)).toMatchObject({ state: 'enabled', trackId: null });
    music.update({ trackId: 'curtain', playing: true }); expect(players).toHaveLength(2);
    music.dispose(); music.dispose();
    expect(players[1]!.calls.load).toBe(1); expect(players[1]!.calls.removeListener).toBe(1);
    expect(statuses.at(-1)).toMatchObject({ state: 'disposed', trackId: null });
    expect(await music.enable()).toBe(false); music.update({ trackId: 'instrumental', playing: true }); expect(players).toHaveLength(2);
  });

  it('attempts every cleanup step and reports actual cleanup failures', async () => {
    const { music, players, statuses } = setup(); music.update({ trackId: 'curtain', playing: true }); await music.enable();
    const fake = players[0]!;
    fake.failures.removeListener = true; fake.failures.pause = true; fake.failures.removeSrc = true; fake.failures.load = true;
    music.mute(); expect(fake.calls).toMatchObject({ pause: 1, load: 1, removeSrc: 1, removeListener: 1 });
    expect(statuses.at(-1)?.state).toBe('error');
    for (const failure of ['remove listener failed', 'pause failed', 'remove src failed', 'load failed']) expect(statuses.at(-1)?.message).toContain(failure);
  });

  it('reports synchronous playback failures and a missing media factory without crashing', async () => {
    const statuses: MusicStatus[] = [], fake = fakeMedia(); fake.failures.play = true;
    const music = createStageMusic(status => statuses.push(status), { tracks, createAudio: () => fake.media });
    music.update({ trackId: 'instrumental', playing: true }); expect(await music.enable()).toBe(false);
    expect(statuses.at(-1)?.message).toContain('play failed'); expect(fake.calls.load).toBe(1);
    const absent = createStageMusic(status => statuses.push(status), { tracks, createAudio: () => null });
    absent.update({ trackId: 'instrumental', playing: true }); expect(await absent.enable()).toBe(false);
    expect(statuses.at(-1)?.state).toBe('unavailable');
  });

  it('rejects unknown track ids without constructing media', async () => {
    const { music, players, statuses } = setup(); music.update({ trackId: 'missing', playing: true });
    expect(await music.enable()).toBe(false); expect(players).toHaveLength(0);
    expect(statuses.at(-1)?.message).toContain('未知音乐资源');
  });
});
