import type { Bounds } from '../content/asset-types';
import type { Point } from '../domain/projection';
import { WORLD_HEIGHT, WORLD_WIDTH } from '../domain/projection';
import type { TargetRect } from '../domain/story-types';

function validBounds(bounds: Bounds): boolean {
  return [bounds.minX, bounds.minY, bounds.maxX, bounds.maxY].every(Number.isFinite) &&
    bounds.maxX > bounds.minX && bounds.maxY > bounds.minY;
}

/** Normalized top-left x-right/y-down rectangle -> curtain world x-right/y-up. Invalid input returns null. */
export function normalizedTargetBounds(target: TargetRect): Bounds | null {
  if (![target.x, target.y, target.width, target.height].every(Number.isFinite) ||
    target.x < 0 || target.y < 0 || target.width <= 0 || target.height <= 0 ||
    target.x + target.width > 1 || target.y + target.height > 1) return null;
  return { minX: -WORLD_WIDTH / 2 + target.x * WORLD_WIDTH,
    maxX: -WORLD_WIDTH / 2 + (target.x + target.width) * WORLD_WIDTH,
    minY: WORLD_HEIGHT / 2 - (target.y + target.height) * WORLD_HEIGHT,
    maxY: WORLD_HEIGHT / 2 - target.y * WORLD_HEIGHT };
}

/**
 * Intersection area / TARGET area, in shared projected curtain world units, clamped to [0, 1].
 * The observed bounds may be the projected motif or hand/body region, as selected by the director.
 * Invalid/empty boxes conservatively produce 0. This observes geometry; it never issues story evidence.
 */
export function targetCoverageRatio(projectedBounds: Bounds, targetBounds: Bounds): number {
  if (!validBounds(projectedBounds) || !validBounds(targetBounds)) return 0;
  const width = Math.max(0, Math.min(projectedBounds.maxX, targetBounds.maxX) - Math.max(projectedBounds.minX, targetBounds.minX));
  const height = Math.max(0, Math.min(projectedBounds.maxY, targetBounds.maxY) - Math.max(projectedBounds.minY, targetBounds.minY));
  const area = (targetBounds.maxX - targetBounds.minX) * (targetBounds.maxY - targetBounds.minY);
  const ratio = width * height / area;
  return Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0;
}

/** Euclidean projected hand distance / curtain width (2 world units by default), never CSS pixels. */
export function handDistanceRatio(first: Point, second: Point, curtainWidth = WORLD_WIDTH): number {
  if (![first.x, first.y, second.x, second.y, curtainWidth].every(Number.isFinite) || curtainWidth <= 0) return Infinity;
  const dx = first.x - second.x; const dy = first.y - second.y;
  return Math.sqrt(dx * dx + dy * dy) / curtainWidth;
}

/** Inclusive local-radian observation. Invalid values/ranges never match. */
export function withinAngleRange(angleRad: number, range: readonly [number, number]): boolean {
  return Number.isFinite(angleRad) && range.every(Number.isFinite) && range[0] <= range[1] &&
    angleRad >= range[0] && angleRad <= range[1];
}

export interface HoldObservation { lastElapsedMs: number | null; heldMs: number; matching: boolean }
export function emptyHoldObservation(): HoldObservation { return { lastElapsedMs: null, heldMs: 0, matching: false }; }

/**
 * Observe a continuous match using the caller's monotonic node clock in milliseconds.
 * The first matching sample earns no time. Pausing, invalid time, reversal or a non-match clears the hold.
 * A gap over maxGapMs also resets: sparse samples cannot prove an unobserved sustained interaction.
 * The caller pauses its unique clock; this function reads no clock and emits no command/callback.
 */
export function observeHold(previous: HoldObservation, matches: boolean, elapsedMs: number,
  paused = false, maxGapMs = 250): HoldObservation {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || !Number.isFinite(maxGapMs) || maxGapMs <= 0) {
    return emptyHoldObservation();
  }
  if (paused || !matches) return { lastElapsedMs: elapsedMs, heldMs: 0, matching: false };
  const priorTime = previous.lastElapsedMs;
  const validPrior = previous.matching && priorTime !== null && Number.isFinite(priorTime) && priorTime >= 0 &&
    Number.isFinite(previous.heldMs) && previous.heldMs >= 0;
  const delta = validPrior ? elapsedMs - priorTime! : 0;
  const heldMs = validPrior && delta >= 0 && delta <= maxGapMs ? previous.heldMs + delta : 0;
  return { lastElapsedMs: elapsedMs, heldMs, matching: true };
}
