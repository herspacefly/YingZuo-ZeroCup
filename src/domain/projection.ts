import type { Pose, StageConfig } from './types';

export interface Point { x: number; y: number }
export interface Viewport { x: number; y: number; width: number; height: number; scale: number }

export const WORLD_WIDTH = 2;
export const WORLD_HEIGHT = 1.5;
export const LAMP_DEPTH = 1.2;

function bounded(value: number, min: number, max: number, fallback: number): number {
  return Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

/** Runtime inputs use the same finite lamp/distance range as ProjectV1. */
export function minimumLampDepth(stage: Pick<StageConfig, 'puppetDistance'>): number {
  return Math.max(.6, Math.round(3 * bounded(stage.puppetDistance, .05, .4, .2) * 1e6) / 1e6);
}

export function projectionParameters(stage: StageConfig): { lampX: number; lampDepth: number; magnification: number } {
  const lampX = bounded(stage.lampX, -0.8, 0.8, 0);
  const distance = bounded(stage.puppetDistance, 0.05, 0.4, 0.2);
  const lampDepth = bounded(stage.lampGeometry?.depth ?? LAMP_DEPTH, minimumLampDepth(stage), 2.4, LAMP_DEPTH);
  return { lampX, lampDepth, magnification: lampDepth / (lampDepth - distance) };
}

export function projectPoint(world: Point, stage: StageConfig): Point {
  const { lampX, magnification } = projectionParameters(stage);
  return { x: lampX + magnification * (world.x - lampX), y: magnification * world.y };
}

export function unprojectPoint(screen: Point, stage: StageConfig): Point {
  const { lampX, magnification } = projectionParameters(stage);
  return { x: lampX + (screen.x - lampX) / magnification, y: screen.y / magnification };
}

/** Pose roots are normalized x-right/y-down; template/world points are x-right/y-up. */
export function localToWorld(point: Point, pose: Pose): Point {
  return { x: (pose.x - 0.5) * WORLD_WIDTH + point.x * pose.scale * pose.facing,
    y: (0.5 - pose.y) * WORLD_HEIGHT + point.y * pose.scale };
}

export function worldToLocal(point: Point, pose: Pose): Point {
  if (!Number.isFinite(pose.scale) || pose.scale <= 0) throw new RangeError('Pose scale must be positive and finite.');
  return { x: (point.x - (pose.x - 0.5) * WORLD_WIDTH) * pose.facing / pose.scale,
    y: (point.y - (0.5 - pose.y) * WORLD_HEIGHT) / pose.scale };
}

export function projectLocalPoint(point: Point, pose: Pose, stage: StageConfig): Point {
  return projectPoint(localToWorld(point, pose), stage);
}

export function screenToLocalPoint(point: Point, pose: Pose, stage: StageConfig): Point {
  return worldToLocal(unprojectPoint(point, stage), pose);
}

/** Fit the 4:3 curtain inside a CSS-pixel rectangle; DPR is a renderer concern. */
export function fitViewport(width: number, height: number): Viewport {
  const w = Number.isFinite(width) ? Math.max(0, width) : 0;
  const h = Number.isFinite(height) ? Math.max(0, height) : 0;
  const scale = Math.min(w / WORLD_WIDTH, h / WORLD_HEIGHT);
  return { x: (w - WORLD_WIDTH * scale) / 2, y: (h - WORLD_HEIGHT * scale) / 2,
    width: WORLD_WIDTH * scale, height: WORLD_HEIGHT * scale, scale };
}

export function worldToViewport(point: Point, viewport: Viewport): Point {
  return { x: viewport.x + (point.x + WORLD_WIDTH / 2) * viewport.scale,
    y: viewport.y + (WORLD_HEIGHT / 2 - point.y) * viewport.scale };
}

/** Letterbox input never becomes a puppet target. Curtain edges themselves are valid. */
export function viewportToWorld(point: Point, viewport: Viewport): Point | null {
  if (viewport.scale <= 0 || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
    point.x < viewport.x || point.x > viewport.x + viewport.width ||
    point.y < viewport.y || point.y > viewport.y + viewport.height) return null;
  return { x: (point.x - viewport.x) / viewport.scale - WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2 - (point.y - viewport.y) / viewport.scale };
}
