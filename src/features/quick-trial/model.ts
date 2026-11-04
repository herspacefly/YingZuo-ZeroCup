import { createProject, defaultPose } from '../../domain/defaults';
import { beginStory, storyGuard } from '../../domain/story';
import { choiceDefinition } from '../../content/reunion';
import { arrangeVoiceNode, voiceCuesForNode } from '../../content/voice-arrangement';
import { createSceneDirector } from '../../story/director';
import { createInteractionClip } from '../../story/interaction-clip';
import type { StoryNodeId } from '../../domain/types';
import type { CanvasFrame } from '../../renderers/canvas/types';

export const TRIAL_SEGMENTS = [
  { id: 'light-up', title: '点亮这一张幕', durationMs: 6000 },
  { id: 'intro', title: '听一声家常', durationMs: 20455 },
  { id: 'lamp', title: '挪一挪灯，看影子回应', durationMs: 12000 },
  { id: 'wave', title: '接过影偶，向母亲招手', durationMs: 18396 },
  { id: 'response', title: '你的一次招手，演成了', durationMs: 7000 },
  { id: 'training', title: '收住斧刃，走到华山前', durationMs: 20235 },
  { id: 'invitation', title: '下一幕，由你来演', durationMs: 5914 },
] as const;
export const TRIAL_DURATION_MS = TRIAL_SEGMENTS.reduce((sum, segment) => sum + segment.durationMs, 0);
export type TrialWait = 'lamp' | 'wave';
export type TrialSegmentId = typeof TRIAL_SEGMENTS[number]['id'];
export interface TrialPosition { index: number; elapsedMs: number; automaticMs: number; waiting: TrialWait | null; ended: boolean }

/** Native voice may trail its nominal end. Keep its last millisecond selected until output ends. */
export function trialAdvanceBeforeVoiceTail(position: TrialPosition, deltaMs: number, voicePlaying: boolean): number {
  const segment = TRIAL_SEGMENTS[position.index]!;
  if (!voicePlaying || !['intro', 'wave', 'training'].includes(segment.id) || position.waiting) return deltaMs;
  return Math.max(0, Math.min(deltaMs, segment.durationMs - 1 - position.elapsedMs));
}

/** Local playback only. Neither a Project nor a persistence/command port can enter this timeline. */
export function createTrialTimeline() {
  let index = 0, elapsedMs = 0, waiting: TrialWait | null = null, ended = false;
  function position(): TrialPosition {
    return { index, elapsedMs, waiting, ended, automaticMs: TRIAL_SEGMENTS.slice(0, index).reduce((sum, segment) => sum + segment.durationMs, 0) + elapsedMs };
  }
  return {
    position,
    reset() { index = 0; elapsedMs = 0; waiting = null; ended = false; },
    advance(deltaMs: number) {
      if (!Number.isFinite(deltaMs) || deltaMs <= 0 || ended || waiting) return position();
      let remaining = deltaMs;
      while (remaining > 0 && !ended && !waiting) {
        const segment = TRIAL_SEGMENTS[index]!;
        const used = Math.min(remaining, segment.durationMs - elapsedMs);
        elapsedMs += used; remaining -= used;
        if (elapsedMs === segment.durationMs) {
          if (segment.id === 'lamp' || segment.id === 'wave') waiting = segment.id;
          else if (index === TRIAL_SEGMENTS.length - 1) ended = true;
          else { index++; elapsedMs = 0; }
        }
      }
      return position();
    },
    completeWait(kind: TrialWait) {
      if (waiting !== kind) return false;
      waiting = null; index++; elapsedMs = 0; return true;
    },
  };
}

const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

/** Source scenes are sampled into temporary drawing inputs, never submitted as story checkpoints. */
export function createTrialScenes() {
  const project = beginStory(createProject('quick-trial', 'quick-trial', '2026-11-04T00:00:00.000Z'), 'quick-trial', 'guided', 5)!;
  function scene(id: StoryNodeId) {
    const node = arrangeVoiceNode(copy(choiceDefinition.nodes.find(item => item.id === id)!), 5);
    const transient = copy(project); transient.story!.nodeId = id;
    const director = createSceneDirector(transient, { node, token: 'trial:' + id, guard: storyGuard(transient.story!), paused: true, elapsedMs: 0 });
    return { node, director, voice: voiceCuesForNode(node, 'guided', 5) };
  }
  const intro = scene('intro'), wave = scene('memory-wave'), training = scene('training');
  const response = createInteractionClip(wave.node, wave.director);
  const lamp: CanvasFrame = { actors: [{ actorId: 'chenxiang', templateId: 'chenxiang-v1', costumeTreatment: 'original-texture', appearance: copy(project.appearance), pose: defaultPose() }], stage: { backgroundId: 'plain-v1', lampX: 0, puppetDistance: .2, lampGeometry: { version: 1, depth: 1.2 } }, showRods: true };
  return {
    intro, wave, training,
    lampFrame: () => copy(lamp),
    sample(position: TrialPosition, reduced: boolean) {
      const segment = TRIAL_SEGMENTS[position.index]!, elapsed = position.elapsedMs;
      const selected = segment.id === 'intro' ? intro : segment.id === 'wave' ? wave : segment.id === 'training' ? training : null;
      if (selected) {
        const sample = selected.director.sample(elapsed, undefined, reduced);
        return { frame: sample.frame, cues: sample.cues, light: sample.lightLevel, voice: selected.voice, voiceElapsed: elapsed, nodeId: selected.node.id };
      }
      if (segment.id === 'lamp') return { frame: copy(lamp), cues: [], light: 1, voice: [], voiceElapsed: 0, nodeId: null };
      if (segment.id === 'response') {
        const sample = response.showcase(Math.min(response.durationMs, elapsed), reduced);
        return { frame: sample.frame, cues: [], light: sample.lightLevel, voice: [], voiceElapsed: 0, nodeId: null };
      }
      const sample = (segment.id === 'light-up' ? intro : training).director.sample(segment.id === 'light-up' ? 0 : Infinity, undefined, reduced);
      return { frame: sample.frame, cues: [], light: segment.id === 'light-up' && !reduced ? .08 + .92 * elapsed / segment.durationMs : 1, voice: [], voiceElapsed: 0, nodeId: null };
    },
  };
}
