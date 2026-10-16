import type { Approach, Pose, StoryNodeId, StageConfig } from './types';

export type ActorId = 'chenxiang' | 'mother' | 'guardian';
export type StoryAction = 'CHOOSE' | 'COMPLETE_INTERACTION' | 'COMPLETE_SCENE' | 'SET_MODE';
export type Completion =
  | { kind: 'scene'; activation: 'automatic' | 'user'; skippable: boolean }
  | { kind: 'craft' }
  | { kind: 'wave' | 'road' | 'block'; target: TargetRect; overlapRatio: number; holdMs: number }
  | { kind: 'light'; target: TargetRect; overlapRatio: number; holdMs: number }
  | { kind: 'axe'; target: TargetRect; raisedAngleRange: [number,number]; landedAngleRange: [number,number]; holdMs: number }
  | { kind: 'reach'; target: TargetRect; maxDistanceRatio: number; maxSnapRatio: number }
  | { kind: 'choice' | 'terminal' };
export interface TargetRect { x: number; y: number; width: number; height: number }
export interface StoryTiming { targetMs: number; minDurationMs: number }
export interface StoryNode {
  id: StoryNodeId; kind: 'cinematic' | 'interaction' | 'choice' | 'curtain' | 'terminal'; act: number;
  title: string; lead: string; actors: ActorId[]; entryPoses: Partial<Record<ActorId,Pose>>;
  entryStage: StageConfig; entrySceneLayers: { id: string; x: number; y: number; opacity: number }[];
  entryAttachments: { actorId: ActorId; attachmentId: string }[];
  subtitles: { startMs: number; endMs: number; speaker: ActorId | 'narrator'; text: string; contentKind: 'original-adaptation' }[];
  fullTiming: StoryTiming; guidedTiming: StoryTiming; allowedActions: StoryAction[];
  completion: Completion; next: { default: StoryNodeId } | { 'call-first': StoryNodeId; 'split-first': StoryNodeId } | null;
  prerequisites: { approach: Approach | null; frozenCast: boolean };
  assetIds: string[]; sourceIds: string[]; contentKind: 'original-adaptation';
}
export interface StoryDefinition {
  storyId: 'reunion'; definitionVersion: 1; assetVersion: 1; startNodeId: 'intro';
  title: string; adaptationCredit: string; nodes: StoryNode[];
  subtitleTimebase: 'full-target-ms';
}
export interface StoryGuard { runId: string; expectedRevision: number; expectedNodeId: StoryNodeId }
export type InteractionEvidence =
  | { kind: 'craft'; presetAppearanceUsed: boolean }
  | { kind: 'wave' | 'road' | 'block' | 'light'; overlapRatio: number; heldMs: number }
  | { kind: 'axe'; stableBody: boolean; raisedAngleRad: number; raisedHoldMs: number; landedAngleRad: number; lowered: boolean }
  | { kind: 'reach'; handDistanceRatio: number };
export type StoryPayload =
  | { action: 'CHOOSE'; approach: Approach }
  | { action: 'SET_MODE'; mode: 'full' | 'guided' }
  | { action: 'COMPLETE_INTERACTION'; source: 'user'; evidence: InteractionEvidence }
  | { action: 'COMPLETE_INTERACTION'; source: 'assistance' }
  | { action: 'COMPLETE_SCENE'; source: 'script' | 'user' | 'assistance'; skipped?: boolean }
;
export type StoryCommand = StoryGuard & StoryPayload;
// Transient facts from the mounted node. Not persisted, not accumulated while paused.
export interface StoryContext { paused: boolean; elapsedMs: number; now: string }
