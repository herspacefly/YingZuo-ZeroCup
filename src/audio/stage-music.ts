export interface MusicTrack {
  id: string;
  src: string;
  title: string;
  credit: string;
  volume: number;
  loop: boolean;
}

export interface MusicSample { trackId: string | null; playing: boolean }
export interface MusicStatus {
  state: 'muted' | 'enabling' | 'enabled' | 'unavailable' | 'error' | 'disposed';
  message: string;
  trackId: string | null;
}

// HTMLAudioElement satisfies this interface. Tests use a structural substitute;
// it does not stand in for a browser autoplay policy or an actual speaker.
export interface MusicMedia {
  src: string;
  preload: string;
  volume: number;
  loop: boolean;
  readonly error?: { readonly code: number; readonly message?: string } | null;
  play(): Promise<void> | void;
  pause(): void;
  load(): void;
  removeAttribute(name: string): void;
  addEventListener(type: 'error', listener: () => void): void;
  removeEventListener(type: 'error', listener: () => void): void;
}

export interface StageMusicOptions {
  tracks: readonly MusicTrack[];
  createAudio?: () => MusicMedia | null;
}

interface Player {
  media: MusicMedia;
  track: MusicTrack;
  onError: () => void;
  retired: boolean;
  playing: boolean;
  revision: number;
  pending: Promise<boolean> | null;
}

const errorText = (error: unknown) => error instanceof Error ? error.message : String(error);

export function createStageMusic(onStatus: (status: MusicStatus) => void, options: StageMusicOptions) {
  const factory = options.createAudio ?? (typeof Audio === 'function' ? () => new Audio() : null);
  const tracks = new Map(options.tracks.map(track => [track.id, track]));
  let sample: MusicSample = { trackId: null, playing: false };
  let active: Player | null = null;
  let enabled = false, disposed = false;
  let state: MusicStatus['state'] = factory ? 'muted' : 'unavailable';

  function report(next: MusicStatus['state'], message: string) {
    state = next;
    onStatus({ state: next, message, trackId: sample.trackId });
  }

  function release(player: Player): string[] {
    if (player.retired) return [];
    player.retired = true; player.revision++; player.pending = null; player.playing = false;
    const errors: string[] = [];
    try { player.media.removeEventListener('error', player.onError); } catch (error) { errors.push(errorText(error)); }
    try { player.media.pause(); } catch (error) { errors.push(errorText(error)); }
    try { player.media.removeAttribute('src'); } catch (error) { errors.push(errorText(error)); }
    // Removing src followed by load aborts the old resource and its pending
    // requests. Assigning an empty src could instead request the current page.
    try { player.media.load(); } catch (error) { errors.push(errorText(error)); }
    return errors;
  }

  function releaseActive() {
    const old = active; active = null;
    return old ? release(old) : [];
  }

  function fail(error: unknown) {
    enabled = false;
    const cleanup = releaseActive();
    report('error', `音乐未能播放，可重新开启音乐：${errorText(error)}${cleanup.length ? `；清理报告：${cleanup.join('；')}` : ''}`);
  }

  function shouldPlay(player: Player) {
    return !disposed && enabled && active === player && !player.retired && sample.playing && sample.trackId === player.track.id;
  }

  function silenceLatePlay(player: Player) {
    // A new play of this same media may already be valid after a pause. An old
    // resolution must not stop that request, or stop a different current track.
    if (shouldPlay(player)) return;
    try { player.media.pause(); } catch (error) {
      report(state, `上一段音乐停止失败：${errorText(error)}。可通过音乐开关重试停止。`);
    }
  }

  function prepare(track: MusicTrack): Player | null {
    if (!factory) {
      enabled = false;
      report('unavailable', '当前浏览器不支持音频文件播放。');
      return null;
    }
    let media: MusicMedia | null;
    try { media = factory(); } catch (error) { fail(error); return null; }
    if (!media) {
      enabled = false;
      report('unavailable', '当前浏览器未提供音频播放器，可重新开启音乐重试。');
      return null;
    }
    const player: Player = {
      media, track, retired: false, playing: false, revision: 0, pending: null,
      onError: () => {
        if (active !== player || player.retired || disposed) return;
        const error = media.error;
        fail(new Error(error?.message || `音频文件加载或解码失败${error ? `（${error.code}）` : ''}。`));
      },
    };
    active = player;
    try {
      media.addEventListener('error', player.onError);
      media.preload = 'none';
      media.loop = track.loop;
      media.volume = Number.isFinite(track.volume) ? Math.max(0, Math.min(1, track.volume)) : .3;
      media.src = track.src;
    } catch (error) { fail(error); return null; }
    return active === player && !player.retired ? player : null;
  }

  function play(): Promise<boolean> {
    if (disposed || !enabled || !sample.playing || sample.trackId === null) return Promise.resolve(false);
    const track = tracks.get(sample.trackId);
    if (!track) { fail(new Error(`未知音乐资源：${sample.trackId}`)); return Promise.resolve(false); }
    const player = active ?? prepare(track);
    if (!player || !shouldPlay(player)) return Promise.resolve(false);
    if (player.playing) return Promise.resolve(true);
    if (player.pending) return player.pending;
    const revision = ++player.revision;
    report('enabling', `正在播放《${track.title}》…`);
    let result: Promise<void> | void;
    try { result = player.media.play(); } catch (error) { fail(error); return Promise.resolve(false); }
    if (!result) {
      if (!shouldPlay(player) || player.revision !== revision) { silenceLatePlay(player); return Promise.resolve(false); }
      player.playing = true;
      report('enabled', `音乐已开启：《${track.title}》。`);
      return Promise.resolve(true);
    }
    const operation = result.then(() => {
      if (!shouldPlay(player) || player.revision !== revision) { silenceLatePlay(player); return false; }
      player.pending = null; player.playing = true;
      report('enabled', `音乐已开启：《${track.title}》。`);
      return true;
    }, error => {
      if (shouldPlay(player) && player.revision === revision) fail(error);
      return false;
    });
    player.pending = operation;
    return operation;
  }

  function enable(): Promise<boolean> {
    if (disposed) return Promise.resolve(false);
    if (!factory) { report('unavailable', '当前浏览器不支持音频文件播放。'); return Promise.resolve(false); }
    enabled = true;
    // Preserve the explicit preference while paused, without creating a media
    // element or asking the browser to play a silent or unrelated resource.
    if (!sample.playing || sample.trackId === null) {
      report('enabled', '音乐已开启；演出暂停或静候时不发声。');
      return Promise.resolve(true);
    }
    return play();
  }

  function update(next: MusicSample) {
    if (disposed) return;
    const changedTrack = next.trackId !== sample.trackId;
    const changedPlayback = next.playing !== sample.playing;
    sample = { trackId: next.trackId, playing: next.playing };
    if (changedTrack) {
      const errors = releaseActive();
      if (errors.length) { enabled = false; report('error', `音乐切换时清理失败，可重新开启音乐：${errors.join('；')}`); return; }
    }
    if (!sample.playing || sample.trackId === null) {
      if (active && (active.playing || active.pending)) {
        active.revision++; active.pending = null; active.playing = false;
        try { active.media.pause(); } catch (error) { fail(error); return; }
      }
      if (enabled && (changedTrack || changedPlayback || state === 'enabling')) report('enabled', '音乐已开启；演出暂停或静候时不发声。');
      else if (!enabled && changedTrack && state === 'muted') report('muted', '默认静音。可选择开启音乐。');
      return;
    }
    if (enabled) void play();
    else if (changedTrack && state === 'muted') report('muted', '默认静音。可选择开启音乐。');
  }

  function mute() {
    if (disposed) return;
    enabled = false;
    const errors = releaseActive();
    report(errors.length ? 'error' : 'muted', errors.length ? `已请求静音；清理报告：${errors.join('；')}` : '音乐已静音。');
  }

  function reset() {
    if (disposed) return;
    sample = { trackId: null, playing: false };
    const errors = releaseActive();
    if (errors.length) { enabled = false; report('error', `音乐重开时清理失败，可重新开启音乐：${errors.join('；')}`); }
    else report(enabled ? 'enabled' : state === 'unavailable' ? 'unavailable' : 'muted', enabled ? '音乐已开启；等待下一段演出。' : '音乐已重开，保持静音。');
  }

  function dispose() {
    if (disposed) return;
    disposed = true; enabled = false;
    const errors = releaseActive();
    sample = { trackId: null, playing: false };
    report('disposed', errors.length ? `音乐已退出；清理报告：${errors.join('；')}` : '音乐已退出。');
  }

  report(state, factory ? '默认静音。可选择开启音乐。' : '当前浏览器不支持音频文件播放。');
  return { enable, mute, update, reset, dispose };
}
