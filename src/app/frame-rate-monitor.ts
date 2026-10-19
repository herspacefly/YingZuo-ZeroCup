import type { FrameObserver } from './animation-clock';

export interface SlowFrameRate { fps: number; durationMs: number }

/** Ten consecutive slow one-second windows, fed only by the existing active clock. */
export function createFrameRateMonitor(onSlow: (reading: SlowFrameRate) => void): FrameObserver {
  let elapsed = 0, frames = 0, slowMs = 0, notified = false;
  function reset() { elapsed = 0; frames = 0; slowMs = 0; }
  return {
    reset,
    frame(deltaMs) {
      if (notified) return;
      if (!Number.isFinite(deltaMs) || deltaMs < 0 || deltaMs > 250) { reset(); return; }
      if (deltaMs === 0) return;
      elapsed += deltaMs; frames++;
      if (elapsed + 1e-7 < 1000) return;
      const fps = frames * 1000 / elapsed;
      slowMs = fps < 24 - 1e-6 ? slowMs + elapsed : 0;
      elapsed = 0; frames = 0;
      if (slowMs + 1e-7 >= 10_000) { notified = true; onSlow({ fps, durationMs: slowMs }); }
    },
  };
}
