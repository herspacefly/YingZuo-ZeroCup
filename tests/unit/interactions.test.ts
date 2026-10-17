import { describe, expect, it } from 'vitest';
import type { Bounds } from '../../src/content/asset-types';
import { emptyHoldObservation, handDistanceRatio, normalizedTargetBounds, observeHold,
  targetCoverageRatio, withinAngleRange } from '../../src/story/interactions';

const target: Bounds = { minX: 0, minY: 0, maxX: 1, maxY: 0.5 };

describe('finite geometry observations without story effects', () => {
  it('maps normalized top-left rectangles into y-up curtain world units', () => {
    expect(normalizedTargetBounds({ x: 0, y: 0, width: 1, height: 1 })).toEqual({ minX: -1, minY: -0.75, maxX: 1, maxY: 0.75 });
    expect(normalizedTargetBounds({ x: 0.5, y: 0, width: 0.5, height: 0.5 })).toEqual({ minX: 0, minY: 0, maxX: 1, maxY: 0.75 });
    const lower = normalizedTargetBounds({ x: 0, y: 0.5, width: 0.25, height: 0.5 })!;
    expect(lower).toEqual({ minX: -1, minY: -0.75, maxX: -0.5, maxY: 0 });
  });

  it('rejects invalid/nonfinite/empty/outside normalized targets', () => {
    for (const invalid of [{ x: NaN }, { y: Infinity }, { x: -0.1 }, { y: 1 }, { width: 0 }, { height: -1 }, { width: 2 }]) {
      expect(normalizedTargetBounds({ x: 0.2, y: 0.2, width: 0.2, height: 0.2, ...invalid })).toBeNull();
    }
  });

  it('uses target area as the coverage denominator, including exact 35 percent, edges and disjoint boxes', () => {
    expect(targetCoverageRatio({ minX: 0, minY: 0, maxX: 0.35, maxY: 0.5 }, target)).toBeCloseTo(0.35, 12);
    expect(targetCoverageRatio({ minX: -10, minY: -10, maxX: 10, maxY: 10 }, target)).toBe(1);
    expect(targetCoverageRatio({ minX: 1, minY: 0, maxX: 2, maxY: 1 }, target)).toBe(0);
    expect(targetCoverageRatio({ minX: -2, minY: -2, maxX: -1, maxY: -1 }, target)).toBe(0);
    expect(targetCoverageRatio({ minX: 0.5, minY: 0.25, maxX: 3, maxY: 3 }, target)).toBe(0.25);
  });

  it('conservatively rejects invalid/degenerate bounds and never mutates supplied geometry', () => {
    const before = JSON.stringify(target);
    for (const box of [{ ...target, minX: NaN }, { ...target, maxY: Infinity }, { ...target, maxX: 0 }, { ...target, maxY: -1 }]) {
      expect(targetCoverageRatio(box, target)).toBe(0); expect(targetCoverageRatio(target, box)).toBe(0);
    }
    expect(JSON.stringify(target)).toBe(before);
  });

  it('normalizes 2D projected hand distances by curtain width and rejects bad points/width', () => {
    expect(handDistanceRatio({ x: 0, y: 0 }, { x: 0.08, y: 0 })).toBe(0.04);
    expect(handDistanceRatio({ x: 0, y: 0 }, { x: 0.06, y: 0.08 })).toBe(0.05);
    expect(handDistanceRatio({ x: 0, y: 0 }, { x: 0, y: 0 })).toBe(0);
    expect(handDistanceRatio({ x: 0, y: 0 }, { x: 6, y: 8 }, 100)).toBe(0.1);
    for (const badWidth of [0, -1, NaN, Infinity]) expect(handDistanceRatio({ x: 0, y: 0 }, { x: 0, y: 0 }, badWidth)).toBe(Infinity);
    expect(handDistanceRatio({ x: NaN, y: 0 }, { x: 0, y: 0 })).toBe(Infinity);
  });

  it('observes inclusive local-radian intervals without a fabricated completion', () => {
    expect(withinAngleRange(0.4, [0.4, 1.2])).toBe(true); expect(withinAngleRange(1.2, [0.4, 1.2])).toBe(true);
    for (const angle of [0.39, 1.21, NaN, Infinity]) expect(withinAngleRange(angle, [0.4, 1.2])).toBe(false);
    expect(withinAngleRange(0.5, [1.2, 0.4])).toBe(false); expect(withinAngleRange(0.5, [0, NaN])).toBe(false);
  });
});

describe('continuous held-time observations', () => {
  it('starts at zero, accumulates only between matching node-clock samples and returns independent records', () => {
    const empty = emptyHoldObservation(); const first = observeHold(empty, true, 100);
    expect(first).toEqual({ lastElapsedMs: 100, heldMs: 0, matching: true });
    const second = observeHold(first, true, 300);
    const third = observeHold(second, true, 500);
    expect(third.heldMs).toBe(400); expect(observeHold(third, true, 700).heldMs).toBe(600);
    expect(empty).toEqual(emptyHoldObservation()); expect(first.heldMs).toBe(0);
    expect(observeHold(third, true, 500).heldMs).toBe(400);
  });

  it('clears on a nonmatch or pause and does not count unobserved time on resume', () => {
    const held = observeHold(observeHold(emptyHoldObservation(), true, 0), true, 200);
    for (const reset of [observeHold(held, false, 250), observeHold(held, true, 250, true)]) {
      expect(reset.heldMs).toBe(0); expect(reset.matching).toBe(false);
      expect(observeHold(reset, true, 400).heldMs).toBe(0);
    }
  });

  it('resets on reversed, invalid or discontinuous clocks rather than earning a hold', () => {
    const held = observeHold(observeHold(emptyHoldObservation(), true, 100), true, 300);
    for (const time of [50, 1000]) expect(observeHold(held, true, time).heldMs).toBe(0);
    for (const time of [NaN, Infinity, -1]) expect(observeHold(held, true, time)).toEqual(emptyHoldObservation());
    for (const gap of [0, -1, NaN, Infinity]) expect(observeHold(held, true, 400, false, gap)).toEqual(emptyHoldObservation());
    const invalidPrior = { ...held, heldMs: NaN };
    expect(observeHold(invalidPrior, true, 400).heldMs).toBe(0);
  });

  it('gives the same observed duration at 60Hz and 120Hz using absolute sample times', () => {
    for (const rate of [60, 120]) {
      let observation = emptyHoldObservation();
      for (let index = 0; index <= rate; index++) observation = observeHold(observation, true, index * 1000 / rate);
      expect(observation.heldMs).toBeCloseTo(1000, 10);
    }
  });
});
