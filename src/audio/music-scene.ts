import type { StageSoundSample } from './stage-sound';
import type { MusicSample } from './stage-music';

/** The director owns all story timing. The media player never advances it. */
export function musicForScene(sample:StageSoundSample|null,storyPage:boolean,visible:boolean):MusicSample {
  if(!storyPage)return {trackId:'instrumental',playing:visible};
  if(!sample)return {trackId:null,playing:false};
  const quiet=(['reunion-reach','reunion-hold'].includes(sample.nodeId)||sample.nodeId.endsWith('-hold'))&&sample.elapsedMs<2000;
  return {trackId:quiet?null:sample.nodeId==='curtain'?'curtain':'instrumental',playing:visible&&sample.playing&&!quiet};
}
