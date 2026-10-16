import { MAX_PROJECT_BYTES, utf8Bytes } from './limits';
import type { ProjectV1, Pose } from './types';
import { ProjectValidationError, validateProject } from './validation';

// V1 is the first real format. No fictional v0/localStorage migration is provided.
export function migrateProject(input: unknown): ProjectV1 { return validateProject(input); }

export function parseProjectJSON(text: string): ProjectV1 {
  if (utf8Bytes(text) > MAX_PROJECT_BYTES) throw new ProjectValidationError('too-large', '项目文件超过 512 KiB。');
  let value: unknown;
  try { value = JSON.parse(text); }
  catch { throw new ProjectValidationError('invalid', '文件不是有效的项目 JSON，原始数据未改变。'); }
  return migrateProject(value);
}
function roundPose(pose: Pose) {
  for (const key of ['x', 'y', 'scale'] as const) pose[key] = Number(pose[key].toFixed(6));
  for (const key of Object.keys(pose.joints) as (keyof Pose['joints'])[]) pose.joints[key] = Number(pose.joints[key].toFixed(6));
}
export function serializeProject(input: ProjectV1): string {
  const project = validateProject(input);
  roundPose(project.pose);
  project.performance?.frames.forEach(roundPose);
  project.partialRecording?.frames.forEach(roundPose);
  return JSON.stringify(validateProject(project));
}
