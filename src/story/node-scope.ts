type Cleanup = () => void;
type Registration = { cleanup: Cleanup };

class NodeScopeReportError extends Error {
  readonly errors: readonly unknown[];
  constructor(errors: unknown[]) {
    super('NodeScope finished cleanup, but its error reporter failed.');
    this.name = 'NodeScopeReportError';
    this.errors = errors;
  }
}

/**
 * Owns one mounted node instance. Tokens identify the node; the private active
 * flag also rejects callbacks from an old instance with an identical token.
 * Cleanup runs in reverse registration order, even when cleanup/reporting fails.
 * Cleanup errors go to onError. If onError itself throws, dispose (or a late
 * own call) finishes every cleanup before throwing NodeScopeReportError, whose
 * errors array contains those reporter failures. A guarded callback's own
 * exception propagates to its caller; guard does not turn it into success.
 */
export function createNodeScope(token: string, onError: (error: unknown) => void) {
  let active = true, cleanupDepth = 0;
  let reporterFailures: unknown[] = [];
  const registrations = new Set<Registration>();

  function clean(cleanups: readonly Cleanup[]) {
    cleanupDepth++;
    try {
      for (const cleanup of cleanups) {
        try { cleanup(); }
        catch (error) {
          try { onError(error); }
          catch (reporterError) { reporterFailures.push(reporterError); }
        }
      }
    } finally {
      cleanupDepth--;
      if (cleanupDepth === 0 && reporterFailures.length > 0) {
        const failures = reporterFailures;
        reporterFailures = [];
        throw new NodeScopeReportError(failures);
      }
    }
  }

  function own(cleanup: Cleanup): () => void {
    if (!active) { clean([cleanup]); return () => undefined; }
    const registration = { cleanup };
    registrations.add(registration);
    return () => { registrations.delete(registration); };
  }

  function guard<T extends (...args: any[]) => unknown>(callback: T): T {
    return function (this: unknown, ...args: Parameters<T>) {
      if (active) return callback.apply(this, args);
      return undefined;
    } as T;
  }

  return {
    get token() { return token; },
    get active() { return active; },
    isCurrent(candidate: string) { return active && candidate === token; },
    own,
    guard,
    listen(target: EventTarget, type: string, listener: EventListener) {
      if (!active) return;
      const guarded = guard(listener);
      target.addEventListener(type, guarded);
      own(() => { target.removeEventListener(type, guarded); });
    },
    timeout(callback: () => void, ms: number) {
      if (!active) return;
      let unregister: Cleanup = () => undefined;
      const timer = setTimeout(() => {
        unregister();
        if (active) callback();
      }, ms);
      unregister = own(() => { clearTimeout(timer); });
    },
    audio(media: { pause(): void; currentTime: number }) {
      own(() => { clean([() => { media.pause(); }, () => { media.currentTime = 0; }]); });
    },
    dispose() {
      if (!active) return;
      active = false;
      const pending = Array.from(registrations).reverse().map(item => item.cleanup);
      registrations.clear();
      clean(pending);
    },
  };
}
