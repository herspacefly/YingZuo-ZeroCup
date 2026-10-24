export type JointId = 'head' | 'leftShoulder' | 'leftElbow' | 'rightShoulder' | 'rightElbow' |
  'leftHip' | 'leftKnee' | 'rightHip' | 'rightKnee';
export interface Pose {
  x: number; y: number; scale: number; facing: 1 | -1;
  joints: Record<JointId, number>;
}
export type PatternId = 'cloud-v1' | 'wave-v1' | 'flower-v1';
export type PaletteId = 'vermilion-v1' | 'indigo-v1' | 'woodland-v1';
export interface Appearance {
  templateId: 'chenxiang-v1'; patternId: PatternId; paletteId: PaletteId;
  colorSlots: { body: number; sleeve: number; hem: number };
  carvedSegments: [boolean, boolean, boolean];
}
export interface StageConfig {
  backgroundId: 'plain-v1' | 'home-v1' | 'road-v1' | 'mountain-v1';
  lampX: number; puppetDistance: number;
}
export type StoryNodeId = 'intro' | 'craft' | 'memory-wave' | 'memory-separate' | 'road' |
  'training' | 'guardian' | 'approach-choice' | 'call-light' | 'call-response' | 'call-split' |
  'split-axe' | 'split-search' | 'split-response' | 'reunion-reach' | 'reunion-hold' | 'curtain' | 'completed' |
  'memory-words' | 'road-rest' | 'guardian-parley' | 'mountain-listen' | 'ending-choice' |
  'ending-home-epilogue' | 'ending-light-place' | 'ending-light-hold' | 'ending-light-epilogue' |
  'ending-road-walk' | 'ending-road-hold' | 'ending-road-epilogue' | 'ending-waiting-light' | 'ending-waiting-hold' | 'ending-waiting-epilogue' | 'ending-sacrifice-axe' | 'ending-sacrifice-hold' | 'ending-sacrifice-epilogue';
export type Approach = 'call-first' | 'split-first';
export type EndingId = 'home' | 'light' | 'road' | 'waiting' | 'sacrifice';
export interface CastSnapshot {
  appearance: Appearance; sharedMotif: PatternId;
  motherPaletteId: 'mother-v1'; guardianPaletteId: 'guardian-v1'; assetVersion: 1;
}
export interface StoryProgress {
  storyId: 'reunion'; definitionVersion: 1 | 2 | 3 | 4; runId: string; revision: number;
  mode: 'full' | 'guided'; nodeId: StoryNodeId;
  approach: Approach | null; approachSource: 'user' | null;
  castSnapshot: CastSnapshot | null; assistedNodeIds: StoryNodeId[];
  presetAppearanceUsed: boolean; completedAt: string | null;
  /** Present and required in definitionVersion 2/3/4; forbidden in legacy version 1 JSON. */
  ending?: EndingId | null; endingSource?: 'user' | null;
}
export type ExhibitId = 'E01' | 'E02' | 'E03' | 'E04' | 'E05' | 'E06' | 'E07' | 'E08';
export interface RecordingSnapshot {
  sampleRate: 30; frames: Pose[]; appearance: Appearance; stage: StageConfig; presetId: string | null;
}
export interface Performance extends RecordingSnapshot { durationMs: number }
export interface PartialRecording extends RecordingSnapshot { paused: true }
export type ProjectRoute = '/' | '/craft' | '/light' | '/story' | '/museum' | '/result' | '/practice' | '/about';
export interface ProjectV1 {
  schemaVersion: 1; assetVersion: 1; appVersion: string;
  projectId: string; title: string; savedAt: string; saveRevision: number; writerId: string;
  appearance: Appearance; stage: StageConfig; pose: Pose; story: StoryProgress | null;
  museum: { visitedExhibitIds: ExhibitId[] };
  performance: Performance | null; partialRecording: PartialRecording | null; lastRoute: ProjectRoute;
}
export interface ProjectBaseline { projectId: string; saveRevision: number; contentToken: string }
