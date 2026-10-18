import type { StoryNodeId, StoryProgress } from '../domain/types';
import { reunionDefinition } from './reunion';

export type StageTimbre = 'lamp' | 'low-drum' | 'mountain' | 'settle';
export type StageSoundEvent = 'mountain-open' | 'light-found' | 'hands-meet';
export interface StageSoundCue { id: string; atMs: number; timbre: StageTimbre }

// These are original synthetic stage cues, not recordings of regional music,
// traditional instruments, dialogue or an audience. Full-mode content time is
// mapped exactly as the scene director maps its shots in the guided mode.
const timeline: Partial<Record<StoryNodeId, readonly StageSoundCue[]>> = {
  intro: [{ id: 'lamp', atMs: 0, timbre: 'lamp' }, { id: 'separate', atMs: 4000, timbre: 'low-drum' }],
  'memory-wave': [{ id: 'memory-lamp', atMs: 0, timbre: 'lamp' }],
  'memory-separate': [{ id: 'mountain-close', atMs: 0, timbre: 'low-drum' }],
  training: [{ id: 'axe-received', atMs: 4200, timbre: 'lamp' }],
  guardian: [{ id: 'guardian', atMs: 0, timbre: 'low-drum' }],
  'call-response': [{ id: 'answer-before-opening', atMs: 0, timbre: 'settle' }],
  'split-response': [{ id: 'answer-after-opening', atMs: 0, timbre: 'settle' }],
  'reunion-hold': [{ id: 'quiet-reunion', atMs: 2500, timbre: 'settle' }],
  curtain: [{ id: 'curtain', atMs: 0, timbre: 'settle' }],
};

export function stageSoundCues(nodeId: StoryNodeId, mode: StoryProgress['mode']): StageSoundCue[] {
  const node = reunionDefinition.nodes.find(item => item.id === nodeId);
  if (!node || !node.fullTiming.targetMs) return [];
  const duration = mode === 'full' ? node.fullTiming.targetMs : node.guidedTiming.targetMs;
  return (timeline[nodeId] ?? []).map(cue => ({ ...cue, atMs: cue.atMs / node.fullTiming.targetMs * duration }));
}

export function stageEventTimbre(nodeId: StoryNodeId, event: StageSoundEvent): StageTimbre | null {
  if (event === 'mountain-open' && (nodeId === 'call-split' || nodeId === 'split-axe')) return 'mountain';
  if (event === 'light-found' && (nodeId === 'call-light' || nodeId === 'split-search')) return 'lamp';
  if (event === 'hands-meet' && nodeId === 'reunion-reach') return 'settle';
  return null;
}
