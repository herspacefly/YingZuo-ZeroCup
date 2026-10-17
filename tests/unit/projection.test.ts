import { describe, expect, it } from 'vitest';
import { defaultPose } from '../../src/domain/defaults';
import { fitViewport, localToWorld, projectLocalPoint, projectPoint, projectionParameters, screenToLocalPoint,
  unprojectPoint, viewportToWorld, worldToLocal, worldToViewport } from '../../src/domain/projection';
import type { Point } from '../../src/domain/projection';
import type { StageConfig } from '../../src/domain/types';

const stage: StageConfig = { backgroundId: 'plain-v1', lampX: 0, puppetDistance: 0.2 };
function closePoint(actual: Point, expected: Point): void {
  expect(actual.x).toBeCloseTo(expected.x, 11); expect(actual.y).toBeCloseTo(expected.y, 11);
}

describe('curtain projection', () => {
  it('projects from the fixed lamp onto z=0 with the documented geometric ratio', () => {
    closePoint(projectPoint({ x: 0.3, y: 0.4 }, stage), { x: 0.36, y: 0.48 });
    closePoint(projectPoint({ x: 0.3, y: 0.4 }, { ...stage, lampX: 0.8, puppetDistance: 0.4 }), { x: 0.05, y: 0.6 });
  });

  it('round-trips screen/world at both lamp extremes and both legal distances', () => {
    for (const lampX of [-0.8, 0.8]) for (const puppetDistance of [0.05, 0.4]) {
      const config = { ...stage, lampX, puppetDistance };
      for (const point of [{ x: -0.9, y: -0.7 }, { x: 0, y: 0 }, { x: 0.8, y: 0.6 }]) {
        closePoint(unprojectPoint(projectPoint(point, config), config), point);
      }
    }
  });

  it('keeps invalid runtime lamp inputs away from the projection singularity', () => {
    for (const puppetDistance of [Infinity, NaN, 1.2, 30, -30]) {
      const parameters = projectionParameters({ ...stage, lampX: Infinity, puppetDistance });
      expect(parameters.lampX).toBe(0);
      expect(parameters.magnification).toBeGreaterThan(1);
      expect(parameters.magnification).toBeLessThanOrEqual(1.5 + 1e-12);
      const projected = projectPoint({ x: 0.3, y: 0.4 }, { ...stage, puppetDistance });
      expect(Number.isFinite(projected.x) && Number.isFinite(projected.y)).toBe(true);
    }
  });

  it('maps normalized roots to world coordinates and mirrors exactly once', () => {
    const pose = { ...defaultPose(), x: 0.25, y: 0.75, scale: 0.6, facing: -1 as const };
    closePoint(localToWorld({ x: 0.2, y: 0.5 }, pose), { x: -0.62, y: -0.075 });
    closePoint(worldToLocal({ x: -0.62, y: -0.075 }, pose), { x: 0.2, y: 0.5 });
  });

  it('round-trips local targets after translation, mirror, scale, distance and lamp changes', () => {
    for (const facing of [-1, 1] as const) for (const scale of [0.6, 0.8, 1]) for (const lampX of [-0.8, 0.8]) {
      const pose = { ...defaultPose(), x: 0.37, y: 0.64, facing, scale };
      const config = { ...stage, lampX, puppetDistance: 0.4 };
      const point = { x: 0.23, y: -0.29 };
      closePoint(screenToLocalPoint(projectLocalPoint(point, pose, config), pose, config), point);
    }
    expect(() => worldToLocal({ x: 0, y: 0 }, { ...defaultPose(), scale: 0 })).toThrow(RangeError);
  });
});

describe('curtain viewport and letterbox', () => {
  it('fits wide and tall containers without stretching the 4:3 curtain', () => {
    expect(fitViewport(1000, 600)).toEqual({ x: 100, y: 0, width: 800, height: 600, scale: 400 });
    expect(fitViewport(390, 600)).toEqual({ x: 0, y: 153.75, width: 390, height: 292.5, scale: 195 });
  });

  it('maps screen-world points to CSS pixels, with positive world y toward the top', () => {
    const viewport = fitViewport(1000, 600);
    closePoint(worldToViewport({ x: -1, y: 0.75 }, viewport), { x: 100, y: 0 });
    closePoint(worldToViewport({ x: 1, y: -0.75 }, viewport), { x: 900, y: 600 });
    const point = { x: -0.23, y: 0.32 };
    closePoint(viewportToWorld(worldToViewport(point, viewport), viewport)!, point);
  });

  it('rejects black bars, nonfinite pointers and zero-sized hidden containers', () => {
    expect(viewportToWorld({ x: 99, y: 300 }, fitViewport(1000, 600))).toBeNull();
    expect(viewportToWorld({ x: 200, y: 100 }, fitViewport(390, 600))).toBeNull();
    expect(viewportToWorld({ x: NaN, y: 0 }, fitViewport(1000, 600))).toBeNull();
    expect(viewportToWorld({ x: 0, y: 0 }, fitViewport(0, 600))).toBeNull();
    expect(fitViewport(Infinity, -20)).toEqual({ x: 0, y: 0, width: 0, height: 0, scale: 0 });
  });
});
