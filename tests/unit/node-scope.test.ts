import { afterEach, describe, expect, it, vi } from 'vitest';
import { createNodeScope } from '../../src/story/node-scope';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('node instance resource ownership', () => {
  it('rejects an old instance even if the replacement has the same token', () => {
    const first = createNodeScope('run:node:1', vi.fn()), callback = vi.fn();
    const old = first.guard(callback);
    old('before'); first.dispose();
    const next = createNodeScope(first.token, vi.fn());
    old('late');
    expect(callback).toHaveBeenCalledExactlyOnceWith('before');
    expect(first.isCurrent(next.token)).toBe(false);
    expect(next.isCurrent(first.token)).toBe(true);
    expect(next.isCurrent('other')).toBe(false);
  });

  it('preserves callback receiver, arguments, result and exceptions', () => {
    const scope = createNodeScope('node', vi.fn()), receiver = { value: 4 };
    const guarded = scope.guard(function (this: typeof receiver, extra: number) { return this.value + extra; });
    expect(guarded.call(receiver, 3)).toBe(7);
    const error = new Error('frame failed');
    expect(() => scope.guard(() => { throw error; })()).toThrow(error);
  });

  it('unregisters without running and disposes the remaining registrations in reverse order once', () => {
    const scope = createNodeScope('node', vi.fn()), events: string[] = [];
    scope.own(() => { events.push('first'); });
    const unregister = scope.own(() => { events.push('removed'); });
    scope.own(() => { events.push('last'); });
    unregister(); unregister();
    expect(events).toEqual([]);
    scope.dispose(); scope.dispose(); unregister();
    expect(events).toEqual(['last', 'first']);
    expect(scope.active).toBe(false);
  });

  it('registers repeated cleanup functions independently', () => {
    const scope = createNodeScope('node', vi.fn()), cleanup = vi.fn();
    const unregister = scope.own(cleanup); scope.own(cleanup); unregister(); scope.dispose();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it('marks inactive before cleanup and handles reentrant dispose and late registration', () => {
    const scope = createNodeScope('node', vi.fn()), events: string[] = [], stale = vi.fn();
    const guarded = scope.guard(stale);
    scope.own(() => { events.push('first'); });
    scope.own(() => {
      expect(scope.active).toBe(false); scope.dispose(); guarded();
      scope.own(() => { events.push('late'); }); events.push('last');
    });
    scope.dispose();
    const unregister = scope.own(() => { events.push('after'); }); unregister();
    expect(events).toEqual(['late', 'last', 'first', 'after']);
    expect(stale).not.toHaveBeenCalled();
  });

  it('reports every cleanup failure and still releases earlier resources', () => {
    const report = vi.fn(), scope = createNodeScope('node', report), earlier = vi.fn();
    const error = new Error('dispose failed');
    scope.own(earlier); scope.own(() => { throw error; }); scope.dispose();
    expect(report).toHaveBeenCalledExactlyOnceWith(error);
    expect(earlier).toHaveBeenCalledTimes(1);
  });

  it('defers reporter failures until all cleanup has finished, including nested late own', () => {
    const reporterError = new Error('report unavailable'), events: string[] = [];
    const report = vi.fn(() => { throw reporterError; }), scope = createNodeScope('node', report);
    scope.own(() => { events.push('earlier'); });
    scope.own(() => { throw new Error('last failure'); });
    scope.own(() => { scope.own(() => { throw new Error('nested failure'); }); events.push('nested done'); });
    let caught: unknown;
    try { scope.dispose(); } catch (error) { caught = error; }
    expect(events).toEqual(['nested done', 'earlier']);
    expect(report).toHaveBeenCalledTimes(2);
    expect(caught).toMatchObject({ name: 'NodeScopeReportError', errors: [reporterError, reporterError] });
    expect(() => scope.dispose()).not.toThrow();
  });

  it('reports and surfaces reporter failure for a resource registered after disposal', () => {
    const error = new Error('reporter'), scope = createNodeScope('node', () => { throw error; });
    scope.dispose();
    expect(() => scope.own(() => { throw new Error('cleanup'); })).toThrow('error reporter failed');
  });

  it('removes listeners and refuses a removed listener delivered late', () => {
    const scope = createNodeScope('node', vi.fn()), target = new EventTarget(), callback = vi.fn();
    const add = vi.spyOn(target, 'addEventListener'), remove = vi.spyOn(target, 'removeEventListener');
    scope.listen(target, 'input', callback);
    const listener = add.mock.calls[0]![1] as EventListener;
    target.dispatchEvent(new Event('input')); scope.dispose();
    target.dispatchEvent(new Event('input')); listener(new Event('input'));
    scope.listen(target, 'input', callback);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledExactlyOnceWith('input', listener);
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('cancels timers and rejects a cancelled callback delivered late', () => {
    vi.useFakeTimers();
    const set = vi.spyOn(globalThis, 'setTimeout'), callback = vi.fn(), scope = createNodeScope('node', vi.fn());
    scope.timeout(callback, 100);
    const late = set.mock.calls[0]![0] as () => void;
    expect(vi.getTimerCount()).toBe(1); scope.dispose();
    expect(vi.getTimerCount()).toBe(0); late(); vi.runAllTimers();
    scope.timeout(callback, 0);
    expect(callback).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it('forgets an elapsed timer before its callback can reenter disposal', () => {
    vi.useFakeTimers();
    const clear = vi.spyOn(globalThis, 'clearTimeout'), callback = vi.fn();
    const scope = createNodeScope('node', vi.fn());
    scope.timeout(() => { callback(); scope.dispose(); }, 10); vi.advanceTimersByTime(10);
    expect(callback).toHaveBeenCalledTimes(1);
    expect(clear).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0);
  });

  it('pauses and resets audio at exit without playing it', () => {
    const scope = createNodeScope('node', vi.fn()), media = { currentTime: 12, pause: vi.fn(), play: vi.fn() };
    scope.audio(media);
    expect(media.pause).not.toHaveBeenCalled(); expect(media.play).not.toHaveBeenCalled();
    scope.dispose(); scope.dispose();
    expect(media.pause).toHaveBeenCalledTimes(1); expect(media.currentTime).toBe(0);
  });

  it('attempts audio reset and other cleanup even when pause and the reporter throw', () => {
    const error = new Error('pause failed'), reporter = new Error('report failed');
    const report = vi.fn(() => { throw reporter; }), scope = createNodeScope('node', report), earlier = vi.fn();
    const media = { currentTime: 12, pause() { throw error; } };
    scope.own(earlier); scope.audio(media);
    expect(() => scope.dispose()).toThrow('error reporter failed');
    expect(media.currentTime).toBe(0); expect(earlier).toHaveBeenCalledTimes(1);
    expect(report).toHaveBeenCalledExactlyOnceWith(error);
  });
});
