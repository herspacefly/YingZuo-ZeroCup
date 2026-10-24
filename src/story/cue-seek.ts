import { subtitlesForMode } from '../content/story-contract';
import type { StoryNode } from '../domain/story-types';

/** A local transport request, never a story command or a persisted checkpoint. */
export interface CueSeek { nodeToken: string; mode: 'full' | 'guided'; cueIndex: number }
export interface CueSeekState {
  nodeToken: string; mode: 'full' | 'guided'; node: StoryNode;
  ready: boolean; blocked: boolean; resolving: boolean; completed: boolean;
}
/** Resolve only the mounted fragment's actual mode timeline. Invalid/stale requests are inert. */
export function cueSeekTime(request: CueSeek, state: CueSeekState): number | null {
  if (!state.ready || state.blocked || state.resolving || state.completed ||
    request.nodeToken !== state.nodeToken || request.mode !== state.mode ||
    state.node.id === 'craft' || state.node.kind === 'terminal' ||
    !Number.isInteger(request.cueIndex) || request.cueIndex < 0) return null;
  return subtitlesForMode(state.node, state.mode)[request.cueIndex]?.startMs ?? null;
}
