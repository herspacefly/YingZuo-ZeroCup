export interface VoiceClip { id: string; src: string; durationMs: number }
export interface VoiceCue { startMs: number; endMs: number; clip: VoiceClip }
export interface StageVoiceSample { token: string; elapsedMs: number; playing: boolean; cues: readonly VoiceCue[] }
export interface StageVoiceStatus {
  state: 'muted' | 'blocked' | 'loading' | 'enabled' | 'unavailable' | 'error' | 'disposed';
  playing: boolean;
  message: string;
}
type MediaEvent = 'error' | 'loadedmetadata' | 'playing' | 'waiting' | 'pause' | 'ended';
/** Native HTMLAudioElement satisfies this interface; test substitutes do not prove autoplay or listening quality. */
export interface VoiceMedia {
  src: string; preload: string; volume: number; loop: boolean; currentTime: number;
  readonly readyState: number;
  readonly error?: { readonly code: number; readonly message?: string } | null;
  play(): Promise<void> | void;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
  addEventListener(type: MediaEvent, listener: () => void): void;
  removeEventListener(type: MediaEvent, listener: () => void): void;
}
export interface StageVoiceOptions { createAudio?: (() => VoiceMedia | null) | null }
interface Player {
  media: VoiceMedia; token: string; cueIndex: number; cue: VoiceCue;
  retired: boolean; requested: boolean; finished: boolean; revision: number;
  pending: Promise<boolean> | null;
  listeners: { type: MediaEvent; listener: () => void }[];
}
const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

/** A clock follower only: captions/director supply the authoritative time and no media callback advances the story. */
export function createStageVoice(onStatus: (status: StageVoiceStatus) => void, options: StageVoiceOptions = {}) {
  const factory = options.createAudio === undefined ? (typeof Audio === 'function' ? () => new Audio() : null) : options.createAudio;
  let sample: StageVoiceSample | null = null, player: Player | null = null;
  let enabled = false, active = true, disposed = false;
  let status: StageVoiceStatus = { state: factory ? 'muted' : 'unavailable', playing: false, message: '' };
  const listeners = new Set<(status: StageVoiceStatus) => void>();
  function report(state: StageVoiceStatus['state'], playing: boolean, message: string) {
    if (status.state === state && status.playing === playing && status.message === message) return;
    status = { state, playing, message }; onStatus({ ...status }); listeners.forEach(listener => listener({ ...status }));
  }
  function selected() {
    if (!sample || !Number.isFinite(sample.elapsedMs)) return null;
    const index = sample.cues.findIndex(cue => Number.isFinite(cue.startMs) && Number.isFinite(cue.endMs) &&
      cue.startMs <= sample!.elapsedMs && sample!.elapsedMs < Math.min(cue.endMs, cue.startMs + cue.clip.durationMs));
    return index < 0 ? null : { index, cue: sample.cues[index]! };
  }
  function matches(item: Player) {
    const current = selected();
    return !!sample && !disposed && player === item && !item.retired && item.token === sample.token &&
      current?.index === item.cueIndex && current.cue.clip.id === item.cue.clip.id;
  }
  function wants(item: Player) { return matches(item) && enabled && active && sample!.playing && !item.finished; }
  function release(): string[] {
    const old = player; player = null;
    if (!old || old.retired) return [];
    old.retired = true; old.revision++; old.pending = null; old.requested = false;
    const errors: string[] = [];
    for (const event of old.listeners) try { old.media.removeEventListener(event.type, event.listener); } catch (error) { errors.push(errorText(error)); }
    try { old.media.pause(); } catch (error) { errors.push(errorText(error)); }
    try { old.media.removeAttribute('src'); } catch (error) { errors.push(errorText(error)); }
    try { old.media.load(); } catch (error) { errors.push(errorText(error)); }
    return errors;
  }
  function fail(error: unknown) {
    enabled = false; const errors = release();
    const blocked = !!error && typeof error === 'object' && 'name' in error && error.name === 'NotAllowedError';
    report(blocked ? 'blocked' : 'error', false, blocked ? '中文配音等待首次操作；点击或按键后可开启。' :
      `中文配音未能播放，可重试配音：${errorText(error)}${errors.length ? `；清理报告：${errors.join('；')}` : ''}`);
  }
  function align(item: Player, force = false) {
    if (!matches(item) || item.media.readyState < 1) return;
    const offset = Math.max(0, (sample!.elapsedMs - item.cue.startMs) / 1000);
    if (force || !Number.isFinite(item.media.currentTime) || Math.abs(item.media.currentTime - offset) > .25) item.media.currentTime = offset;
  }
  function silenceLate(item: Player) {
    if (wants(item)) return;
    try { item.media.pause(); } catch (error) { if (!disposed) report(status.state, false, `上一句配音停止失败：${errorText(error)}`); }
  }
  function prepare(cue: VoiceCue, cueIndex: number): Player | null {
    if (!factory || !sample) { report('unavailable', false, '当前浏览器不支持中文配音文件播放。'); return null; }
    let media: VoiceMedia | null;
    try { media = factory(); } catch (error) { fail(error); return null; }
    if (!media) { enabled = false; report('unavailable', false, '当前浏览器未提供中文配音播放器。'); return null; }
    const item: Player = { media, token: sample.token, cueIndex, cue, retired: false, requested: false, finished: false, revision: 0, pending: null, listeners: [] };
    player = item;
    function on(type: MediaEvent, listener: () => void) { item.listeners.push({ type, listener }); media!.addEventListener(type, listener); }
    try {
      on('error', () => { if (matches(item)) fail(new Error(media!.error?.message || `配音文件加载或解码失败${media!.error ? `（${media!.error.code}）` : ''}。`)); });
      on('loadedmetadata', () => { if (matches(item)) try { align(item, true); } catch (error) { fail(error); } else silenceLate(item); });
      on('playing', () => {
        if (!wants(item)) { silenceLate(item); return; }
        // A seek itself emits another native playing event. Only correct real
        // drift here; forcing currentTime would create a seek/playing loop.
        try { align(item); report('enabled', true, '中文配音播放中。'); } catch (error) { fail(error); }
      });
      on('waiting', () => { if (wants(item)) report('loading', false, '正在载入中文配音；字幕和画面继续。'); });
      on('pause', () => { if (matches(item)) report(enabled ? 'enabled' : 'muted', false, enabled ? '中文配音已暂停。' : '中文配音已关闭。'); });
      on('ended', () => { if (matches(item)) { item.finished = true; item.requested = false; item.pending = null; report('enabled', false, '本句配音已结束。'); } });
      media.preload = 'auto'; media.loop = false; media.volume = 1; media.src = cue.clip.src;
    } catch (error) { fail(error); return null; }
    return player === item ? item : null;
  }
  function play(item: Player): Promise<boolean> {
    if (!wants(item)) return Promise.resolve(false);
    if (item.pending) return item.pending;
    if (item.requested) return Promise.resolve(true);
    const revision = ++item.revision; item.requested = true;
    let result: Promise<void> | void;
    try { align(item, true); report('loading', false, '正在载入中文配音；字幕和画面继续。'); result = item.media.play(); }
    catch (error) { fail(error); return Promise.resolve(false); }
    if (!result) {
      if (!wants(item) || item.revision !== revision) { silenceLate(item); return Promise.resolve(false); }
      return Promise.resolve(true);
    }
    const operation = result.then(() => {
      if (!wants(item) || item.revision !== revision) { silenceLate(item); return false; }
      item.pending = null;
      try { align(item); } catch (error) { fail(error); return false; }
      return true;
    }, error => { if (wants(item) && item.revision === revision) fail(error); return false; });
    item.pending = operation; return operation;
  }
  function sync(): Promise<boolean> {
    if (disposed) return Promise.resolve(false);
    const current = selected();
    if (player && !matches(player)) {
      const errors = release(); if (errors.length) { enabled = false; report('error', false, `切换配音时清理失败：${errors.join('；')}`); return Promise.resolve(false); }
      if (enabled) report('enabled', false, '中文配音已开启。');
    }
    if (!enabled || !active || !sample?.playing || !current) {
      if (player && (player.requested || player.pending)) {
        player.revision++; player.pending = null; player.requested = false;
        try { player.media.pause(); } catch (error) { fail(error); return Promise.resolve(false); }
      }
      if (enabled) report('enabled', false, '中文配音已开启；当前暂停或静候。');
      return Promise.resolve(false);
    }
    const item = player ?? prepare(current.cue, current.index);
    if (!item) return Promise.resolve(false);
    if (item.requested && !item.finished) try { align(item); } catch (error) { fail(error); return Promise.resolve(false); }
    return play(item);
  }
  function update(next: StageVoiceSample | null) { if (disposed) return; sample = next ? { ...next } : null; void sync(); }
  function seek(next: StageVoiceSample | null) {
    if (disposed) return;
    const errors = release(); sample = next ? { ...next } : null;
    if (errors.length) { enabled = false; report('error', false, `定位配音时清理失败：${errors.join('；')}`); return; }
    void sync();
  }
  function enable(): Promise<boolean> {
    if (disposed) return Promise.resolve(false);
    if (!factory) { report('unavailable', false, '当前浏览器不支持中文配音文件播放。'); return Promise.resolve(false); }
    enabled = true;
    if (!sample?.playing || !active || !selected()) { report('enabled', false, '中文配音已开启；当前暂停或静候。'); return Promise.resolve(true); }
    return sync();
  }
  function mute() {
    if (disposed) return; enabled = false; const errors = release();
    report(errors.length ? 'error' : 'muted', false, errors.length ? `已请求关闭配音；清理报告：${errors.join('；')}` : '中文配音已关闭。');
  }
  function setActive(value: boolean) {
    if (disposed || active === value) return; active = value;
    // Reactivation alone never revives the last page's playback request.
    if (!value) { if (sample) sample = { ...sample, playing: false }; void sync(); }
  }
  function dispose() {
    if (disposed) return; disposed = true; enabled = false; sample = null;
    const errors = release(); report('disposed', false, errors.length ? `中文配音已退出；清理报告：${errors.join('；')}` : '中文配音已退出。'); listeners.clear();
  }
  function subscribe(listener: (value: StageVoiceStatus) => void) { listeners.add(listener); listener({ ...status }); return () => { listeners.delete(listener); }; }
  report(status.state, false, factory ? '中文配音已关闭。' : '当前浏览器不支持中文配音文件播放。');
  return { update, seek, enable, mute, setActive, getStatus: () => ({ ...status }), subscribe, dispose };
}
