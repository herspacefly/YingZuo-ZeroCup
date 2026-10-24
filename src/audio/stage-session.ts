import { musicForScene } from './music-scene';
import { createStageMusic } from './stage-music';
import type { MusicStatus, StageMusicOptions } from './stage-music';
import { createStageSound } from './stage-sound';
import type { StageSoundOptions, StageSoundSample } from './stage-sound';

export interface StageAudioSessionOptions extends StageMusicOptions {
  onMusic(status: MusicStatus, enabled: boolean): void;
  effects?: StageSoundOptions;
}

/** Per-document intent, independent of pages and of browser playback permission.
 * Nothing here persists preferences or advances the director's clock. */
export function createStageAudioSession(options: StageAudioSessionOptions) {
  let musicIntent = true, effectsIntent = true, active = true, disposed = false;
  let scene: StageSoundSample | null = null, storyPage = false;
  let musicState: MusicStatus['state'] = 'muted';
  const music = createStageMusic(status => {
    musicState = status.state; options.onMusic(status, musicIntent);
  }, options);
  const engine = createStageSound(() => {}, options.effects);
  const effects = {
    ...engine,
    enable(retryPending = true) { effectsIntent = true; return engine.enable(retryPending); },
    mute() { effectsIntent = false; engine.mute(); },
    update(sample: StageSoundSample) {
      scene = { ...sample };
      engine.update({ ...sample, playing: sample.playing && active && !disposed });
    },
    seek(sample: StageSoundSample) {
      scene = { ...sample };
      engine.seek({ ...sample, playing: sample.playing && active && !disposed });
    },
  };
  function sync() {
    if (disposed) return;
    music.update(musicForScene(scene, storyPage, active));
    if (scene) engine.update({ ...scene, playing: scene.playing && active && storyPage });
  }
  function setScene(sample: StageSoundSample | null, isStoryPage: boolean) {
    if (disposed) return;
    if (!sample && scene) engine.update({ ...scene, playing: false });
    scene = sample ? { ...sample } : null; storyPage = isStoryPage; sync();
  }
  function unlock() {
    if (disposed || !active) return;
    // Both calls reach play()/resume() synchronously in the trusted event.
    // This method is only called on entry or gestures, never from a frame loop.
    if (musicIntent && !['enabled', 'unavailable', 'disposed'].includes(musicState)) void music.enable();
    if (effectsIntent && !['enabled', 'unavailable', 'disposed'].includes(engine.getStatus().state)) void engine.enable(true);
  }
  function setActive(value: boolean) { active = value; sync(); }
  function toggleMusic() {
    if (disposed) return;
    musicIntent = !musicIntent;
    if (musicIntent) { sync(); void music.enable(); } else music.mute();
  }
  function dispose() {
    if (disposed) return;
    disposed = true; music.dispose(); engine.dispose(); scene = null;
  }
  return { effects, setScene, setActive, unlock, toggleMusic, dispose,
    musicEnabled: () => musicIntent, effectsEnabled: () => effectsIntent,
  };
}
export type StageAudioSession = ReturnType<typeof createStageAudioSession>;
