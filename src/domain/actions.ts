import actionContent from '../content/actions.json';
import type { Bounds, PuppetTemplate } from '../content/asset-types';
import { JOINT_IDS, PRESET_IDS } from './limits';
import { constrainPose, constrainPoseToStage } from './pose';
import type { JointId, Pose, StageConfig } from './types';

/** These versioned IDs are also reserved by persisted optional recordings. */
export type ActionId = typeof PRESET_IDS[number];
export interface ActionDefinition {
  readonly id: ActionId; readonly label: string; readonly durationMs: number;
  readonly attachmentIds: readonly string[];
}
export interface ActionSample {
  pose: Pose; finished: boolean; elapsedMs: number; attachmentIds: string[];
  /** Actual projected silhouette, including requested attachments. Never infer success from pose alone. */
  bounds: Bounds; fits: boolean;
}
interface OffsetKeyframe {
  atMs: number; x?: number; y?: number; joints: Partial<Record<JointId, number>>;
}
interface ActionTrack extends ActionDefinition { keyframes: OffsetKeyframe[] }

const tracks = (actionContent.actions as ActionTrack[]).map((track) => ({ ...track,
  attachmentIds: [...track.attachmentIds],
  keyframes: track.keyframes.map((frame) => ({ ...frame, joints: { ...frame.joints } })),
}));
/** Only metadata is public. Callers cannot mutate the private animation tracks. */
export const actionDefinitions: readonly ActionDefinition[] = Object.freeze(tracks.map((track) => Object.freeze({
  id: track.id, label: track.label, durationMs: track.durationMs,
  attachmentIds: Object.freeze([...track.attachmentIds]),
})));

function interpolate(from: number, to: number, weight: number): number {
  return from + (to - from) * weight;
}

/**
 * Sample a captured base pose at absolute elapsed milliseconds. No frame history or wall clock is read.
 * Negative/NaN/-Infinity time means zero; +Infinity and late time hold the final frame.
 * Offsets use template-local radians and normalized root units; root x follows the captured facing.
 * A new pose, joints, bounds and attachment array are returned on every call. fits=false stays explicit.
 */
export function sampleAction(id: ActionId, basePose: Pose, elapsedMs: number, template: PuppetTemplate,
  stage: StageConfig): ActionSample {
  const track = tracks.find((item) => item.id === id);
  if (!track) throw new RangeError(`Unknown action: ${id}`);
  for (const attachmentId of track.attachmentIds) {
    if (!template.attachments.some((attachment) => attachment.id === attachmentId)) {
      throw new RangeError(`Action ${id} requires missing attachment: ${attachmentId}`);
    }
  }
  const time = elapsedMs === Infinity ? track.durationMs : Number.isFinite(elapsedMs)
    ? Math.max(0, Math.min(track.durationMs, elapsedMs)) : 0;
  const first = track.keyframes[0]!;
  let from = first; let to = first;
  for (let index = 1; index < track.keyframes.length; index++) {
    to = track.keyframes[index]!;
    if (time <= to.atMs) break;
    from = to;
  }
  const fraction = to.atMs > from.atMs ? (time - from.atMs) / (to.atMs - from.atMs) : 0;
  const weight = fraction * fraction * (3 - 2 * fraction);
  const pose = constrainPose(basePose, template);
  pose.x += interpolate(from.x ?? 0, to.x ?? 0, weight) * pose.facing;
  pose.y += interpolate(from.y ?? 0, to.y ?? 0, weight);
  for (const joint of JOINT_IDS) {
    pose.joints[joint] += interpolate(from.joints[joint] ?? 0, to.joints[joint] ?? 0, weight);
  }
  const attachmentIds = [...track.attachmentIds];
  const fit = constrainPoseToStage(pose, template, stage, attachmentIds);
  return { ...fit, finished: time >= track.durationMs, elapsedMs: time, attachmentIds };
}
