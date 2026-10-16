import type { Appearance, Pose, ProjectV1 } from './types';

export function defaultAppearance(): Appearance {
  return { templateId: 'chenxiang-v1', patternId: 'cloud-v1', paletteId: 'vermilion-v1',
    colorSlots: { body: 0, sleeve: 1, hem: 2 }, carvedSegments: [false, false, false] };
}
export function defaultPose(): Pose {
  return { x: 0.5, y: 0.55, scale: 0.8, facing: 1, joints: {
    head: 0, leftShoulder: 0, leftElbow: 0, rightShoulder: 0, rightElbow: 0,
    leftHip: 0, leftKnee: 0, rightHip: 0, rightKnee: 0,
  } };
}
export function createProject(projectId: string, writerId: string, now: string): ProjectV1 {
  return {
    schemaVersion: 1, assetVersion: 1, appVersion: '0.0.1', projectId, writerId,
    title: '一幕团圆', savedAt: now, saveRevision: 0, appearance: defaultAppearance(),
    stage: { backgroundId: 'plain-v1', lampX: 0, puppetDistance: 0.2 }, pose: defaultPose(),
    story: null, museum: { visitedExhibitIds: [] }, performance: null, partialRecording: null, lastRoute: '/',
  };
}
