import { describe, expect, it, vi } from 'vitest';
import { createFrameRateMonitor } from '../../src/app/frame-rate-monitor';

function frames(monitor: ReturnType<typeof createFrameRateMonitor>, hz: number, seconds: number) {
  for (let i = 0; i < hz * seconds; i++) monitor.frame(1000 / hz);
}

describe('sustained frame rate monitoring', () => {
  it('waits for ten continuous slow seconds and reports once for this stage', () => {
    const slow = vi.fn(), monitor = createFrameRateMonitor(slow);
    for (let i = 0; i < 199; i++) monitor.frame(50);
    expect(slow).not.toHaveBeenCalled(); monitor.frame(50);
    expect(slow).toHaveBeenCalledExactlyOnceWith({ fps: 20, durationMs: 10_000 });
    monitor.reset(); frames(monitor, 20, 20); expect(slow).toHaveBeenCalledTimes(1);
  });
  it.each([24, 30, 60, 120])('does not warn at %s fps', hz => {
    const slow = vi.fn(), monitor = createFrameRateMonitor(slow); frames(monitor, hz, 15);
    expect(slow).not.toHaveBeenCalled();
  });
  it('a recovered one-second window interrupts the slow streak', () => {
    const slow = vi.fn(), monitor = createFrameRateMonitor(slow);
    frames(monitor, 20, 5); frames(monitor, 60, 1); frames(monitor, 20, 5);
    expect(slow).not.toHaveBeenCalled(); frames(monitor, 20, 5); expect(slow).toHaveBeenCalledTimes(1);
  });
  it('pause or lifecycle reset discards earlier slow time', () => {
    const slow = vi.fn(), monitor = createFrameRateMonitor(slow);
    frames(monitor, 20, 8); monitor.reset(); frames(monitor, 20, 2);
    expect(slow).not.toHaveBeenCalled(); frames(monitor, 20, 8); expect(slow).toHaveBeenCalledTimes(1);
  });
  it.each([251, NaN, Infinity, -1])('invalid/gap delta %s resets rather than counting as slow playback', delta => {
    const slow = vi.fn(), monitor = createFrameRateMonitor(slow);
    frames(monitor, 20, 8); monitor.frame(delta); frames(monitor, 20, 2);
    expect(slow).not.toHaveBeenCalled();
  });
  it('zero-time callbacks do not inflate frame counts or interrupt a real slow streak', () => {
    const slow = vi.fn(), monitor = createFrameRateMonitor(slow);
    for (let i = 0; i < 200; i++) { monitor.frame(0); monitor.frame(50); }
    expect(slow).toHaveBeenCalledTimes(1);
  });
});
