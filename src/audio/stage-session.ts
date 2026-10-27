import { musicForScene } from './music-scene';
import { createStageMusic } from './stage-music';
import type { MusicStatus, StageMusicOptions } from './stage-music';
import { createStageSound } from './stage-sound';
import type { StageSoundOptions, StageSoundSample } from './stage-sound';
import { createStageVoice } from './stage-voice';
import type { StageVoiceOptions, StageVoiceSample } from './stage-voice';

export interface StageAudioSessionOptions extends StageMusicOptions {
  onMusic(status: MusicStatus, enabled: boolean): void;
  effects?: StageSoundOptions;
  voice?: StageVoiceOptions;
}

/** Per-document intent, independent of pages and of browser playback permission.
 * Nothing here persists preferences or advances the director's clock. */
export function createStageAudioSession(options: StageAudioSessionOptions) {
  let musicIntent = true, effectsIntent = true, voiceIntent = true, active = true, disposed = false;
  let scene: StageSoundSample | null = null, storyPage = false;
  let voiceSample:StageVoiceSample|null=null,voiceScene:StageSoundSample|null=null;
  let musicState: MusicStatus['state'] = 'muted';
  const music = createStageMusic(status => {
    musicState = status.state; options.onMusic(status, musicIntent);
  }, options);
  const voiceEngine=createStageVoice(status=>{music.setGain(status.playing ? .25 : 1);},options.voice);
  const voice={...voiceEngine,
    enable(){voiceIntent=true;return voiceEngine.enable();},
    mute(){voiceIntent=false;voiceEngine.mute();},
  };
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
    const soundtrack=voiceScene??scene;
    const selected=musicForScene(soundtrack, storyPage||!!voiceScene, active);
    // v5 reserves a separate tail for the original curtain vocal recording.
    // It must never sing across the newly spoken dialogue, even when voice is muted.
    if(soundtrack?.definitionVersion===5&&soundtrack.nodeId==='curtain'&&voiceSample){
      const end=voiceSample.cues.reduce((max,cue)=>Math.max(max,cue.endMs),0);
      if(soundtrack.elapsedMs<end)selected.trackId='instrumental';
    }
    music.update(selected);
    if (scene) engine.update({ ...scene, playing: scene.playing && active && storyPage });
    voiceEngine.setActive(active);
  }
  function setVoice(sample:StageVoiceSample|null,soundtrack:StageSoundSample|null=null){
    if(disposed)return;voiceSample=sample;voiceScene=soundtrack;
    voiceEngine.update(sample?{...sample,playing:sample.playing&&active}:null);sync();
  }
  function setScene(sample: StageSoundSample | null, isStoryPage: boolean, isActive = active) {
    if (disposed) return;
    if (!sample && scene) engine.update({ ...scene, playing: false });
    active = isActive; scene = sample ? { ...sample } : null; storyPage = isStoryPage; sync();
  }
  function unlock() {
    if (disposed || !active) return;
    // Both calls reach play()/resume() synchronously in the trusted event.
    // This method is only called on entry or gestures, never from a frame loop.
    if (musicIntent && !['enabled', 'unavailable', 'disposed'].includes(musicState)) void music.enable();
    if (effectsIntent && !['enabled', 'unavailable', 'disposed'].includes(engine.getStatus().state)) void engine.enable(true);
    if (voiceIntent && !['enabled','unavailable','disposed'].includes(voiceEngine.getStatus().state)) void voiceEngine.enable();
  }
  function setActive(value: boolean) { if (active === value) return; active = value; sync(); }
  function toggleMusic() {
    if (disposed) return;
    musicIntent = !musicIntent;
    if (musicIntent) { sync(); void music.enable(); } else music.mute();
  }
  function toggleVoice(){
    if(disposed)return;
    if(voiceIntent&&['blocked','error'].includes(voiceEngine.getStatus().state)){void voiceEngine.enable();return;}
    voiceIntent=!voiceIntent;if(voiceIntent)void voiceEngine.enable();else voiceEngine.mute();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;voiceEngine.dispose(); music.dispose(); engine.dispose(); scene = null;voiceSample=null;voiceScene=null;
  }
  return { effects, voice, setVoice, setScene, setActive, unlock, toggleMusic, toggleVoice, dispose,
    musicEnabled: () => musicIntent, effectsEnabled: () => effectsIntent, voiceEnabled:()=>voiceIntent,
  };
}
export type StageAudioSession = ReturnType<typeof createStageAudioSession>;
