import type { PuppetPart, PuppetTemplate, RenderActor } from '../../content/asset-types';
import { partTransform, transformPoint } from '../../domain/pose';
import { localToWorld } from '../../domain/projection';
import type { CanvasFrame } from '../canvas/types';

export type StageView = 'workshop' | 'front' | 'backstage' | 'exhibit';
export interface CameraPreset { position: [number, number, number]; target: [number, number, number]; height: number }

/** Fixed observation points: they never alter lamp, pose or the director's time. */
export function stageCamera(view: StageView): CameraPreset {
  switch (view) {
    case 'front': return { position: [0, 0, 3.6], target: [0, 0, 0], height: 2.05 };
    case 'backstage': return { position: [.25, .35, -3.6], target: [0, -.05, -.35], height: 2.35 };
    case 'exhibit': return { position: [3.4, 1.8, 3.4], target: [0, -.1, -.4], height: 2.65 };
    default: return { position: [2.7, 1.35, -3], target: [0, -.1, -.45], height: 2.6 };
  }
}

/** The point on a bitmap is bound/posed locally, then transformed once into the shared world. */
export function spatialPartPoint(actor: RenderActor, template: PuppetTemplate, part: PuppetPart,
  point: { x: number; y: number }, distance: number) {
  return { ...localToWorld(transformPoint(point, partTransform(template, actor.pose, part)), actor.pose), z: -distance };
}

/** Pose, fades, light and camera changes reuse one resource load and one set of GPU textures. */
export function spatialResourceScope(frame: CanvasFrame): string {
  return JSON.stringify([frame.stage.backgroundId, frame.actors.map(actor => {
    if (actor.actorId === 'chenxiang') return [actor.actorId, actor.templateId, actor.appearance];
    if (actor.actorId === 'mother') return [actor.actorId, actor.templateId, actor.paletteId, actor.sharedMotif];
    return [actor.actorId, actor.templateId, actor.paletteId];
  }), frame.attachments ?? []]);
}

export function boundedTextureSize(width: number, height: number, limit: number) {
  const safeLimit = Number.isFinite(limit) ? Math.max(1, Math.min(1024, Math.floor(limit))) : 512;
  const safeWidth = Number.isFinite(width) ? Math.max(1, width) : 1;
  const safeHeight = Number.isFinite(height) ? Math.max(1, height) : 1;
  const ratio = Math.min(1, safeLimit / Math.max(safeWidth, safeHeight));
  return { width: Math.max(1, Math.floor(safeWidth * ratio)), height: Math.max(1, Math.floor(safeHeight * ratio)) };
}
