import { describe, it, expect, beforeEach } from 'vitest';
import { withSessionLock, _activeLockCount } from './session-lock.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a deferred promise — resolve/reject are exposed for test control. */
function deferred<T = void>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: unknown) => void;
} {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Flushes the microtask queue. */
function flushMicrotasks(): Promise<void> {
  return Promise.resolve();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('withSessionLock', () => {
  // Flush any lingering microtasks between tests so lock cleanup completes
  beforeEach(async () => {
    // Three flushes are sufficient to drain nested promise chains
    await flushMicrotasks();
    await flushMicrotasks();
    await flushMicrotasks();
  });

  // ---------------------------------------------------------------------------
  // Basic behaviour
  // ---------------------------------------------------------------------------

  it('runs a single operation and returns its result', async () => {
    const result = await withSessionLock('sha-1', () => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('propagates errors thrown inside fn', async () => {
    await expect(
      withSessionLock('sha-err', () => Promise.reject(new Error('boom'))),
    ).rejects.toThrow('boom');
  });

  // ---------------------------------------------------------------------------
  // Serialisation guarantee
  // ---------------------------------------------------------------------------

  it('serialises concurrent operations on the same session key', async () => {
    const order: number[] = [];
    const d1 = deferred();
    const d2 = deferred();

    // Start op1 but do not resolve it yet
    const p1 = withSessionLock('sha-serial', async () => {
      await d1.promise;
      order.push(1);
    });

    // Start op2 — it should not run until op1 finishes
    const p2 = withSessionLock('sha-serial', async () => {
      await d2.promise;
      order.push(2);
    });

    // At this point neither has completed
    expect(order).toEqual([]);

    // Resolve op2's inner work first — but op2 hasn't even started yet
    d2.resolve();
    await flushMicrotasks();
    // Still only op1 is running; op2 waits for op1
    expect(order).toEqual([]);

    // Now finish op1
    d1.resolve();
    await p1;
    await p2;

    // op1 must have recorded before op2
    expect(order).toEqual([1, 2]);
  });

  it('queues three operations in arrival order', async () => {
    const order: number[] = [];
    const d0 = deferred();
    const d1 = deferred();
    const d2 = deferred();

    const p0 = withSessionLock('sha-queue', async () => {
      await d0.promise;
      order.push(0);
    });
    const p1 = withSessionLock('sha-queue', async () => {
      await d1.promise;
      order.push(1);
    });
    const p2 = withSessionLock('sha-queue', async () => {
      await d2.promise;
      order.push(2);
    });

    // Resolve in reverse order — serialisation must still enforce arrival order
    d2.resolve();
    d1.resolve();
    d0.resolve();

    await Promise.all([p0, p1, p2]);

    expect(order).toEqual([0, 1, 2]);
  });

  it('continues the queue after a failed operation', async () => {
    const order: string[] = [];

    const p1 = withSessionLock('sha-fail', async () => {
      order.push('started-1');
      throw new Error('op1 failed');
    });

    const p2 = withSessionLock('sha-fail', async () => {
      order.push('started-2');
    });

    await expect(p1).rejects.toThrow('op1 failed');
    await p2;

    expect(order).toEqual(['started-1', 'started-2']);
  });

  // ---------------------------------------------------------------------------
  // Independence across sessions
  // ---------------------------------------------------------------------------

  it('does not block operations on different session keys', async () => {
    const order: string[] = [];
    const d1 = deferred();
    const d2 = deferred();

    const p1 = withSessionLock('sha-a', async () => {
      await d1.promise;
      order.push('a');
    });

    const p2 = withSessionLock('sha-b', async () => {
      await d2.promise;
      order.push('b');
    });

    // Resolve b first — different key, should not be blocked by a
    d2.resolve();
    await p2;
    expect(order).toEqual(['b']);

    d1.resolve();
    await p1;
    expect(order).toEqual(['b', 'a']);
  });

  it('runs operations on different keys concurrently', async () => {
    const started: string[] = [];
    const d1 = deferred();
    const d2 = deferred();

    const p1 = withSessionLock('sha-x', async () => {
      started.push('x');
      await d1.promise;
    });

    const p2 = withSessionLock('sha-y', async () => {
      started.push('y');
      await d2.promise;
    });

    // Give both a tick to start
    await flushMicrotasks();

    // Both should have started (neither is waiting on the other)
    expect(started).toContain('x');
    expect(started).toContain('y');

    d1.resolve();
    d2.resolve();
    await Promise.all([p1, p2]);
  });

  // ---------------------------------------------------------------------------
  // Memory / cleanup
  // ---------------------------------------------------------------------------

  it('cleans up the lock entry after the operation completes', async () => {
    await withSessionLock('sha-cleanup', () => Promise.resolve());
    // Flush microtasks so the cleanup runs
    await flushMicrotasks();
    await flushMicrotasks();
    expect(_activeLockCount()).toBe(0);
  });

  it('cleans up the lock entry after a failed operation', async () => {
    await withSessionLock('sha-cleanup-err', () => Promise.reject(new Error('x'))).catch(() => {
      /* expected */
    });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(_activeLockCount()).toBe(0);
  });

  it('cleans up when a queue drains completely', async () => {
    const d1 = deferred();
    const d2 = deferred();

    const p1 = withSessionLock('sha-drain', () => d1.promise);
    const p2 = withSessionLock('sha-drain', () => d2.promise);

    d1.resolve();
    d2.resolve();

    await Promise.all([p1, p2]);
    await flushMicrotasks();
    await flushMicrotasks();
    expect(_activeLockCount()).toBe(0);
  });

  // ---------------------------------------------------------------------------
  // Value pass-through
  // ---------------------------------------------------------------------------

  it('correctly passes through values of various types', async () => {
    const obj = { x: 1 };
    expect(await withSessionLock('sha-val-obj', () => Promise.resolve(obj))).toBe(obj);
    expect(await withSessionLock('sha-val-str', () => Promise.resolve('hello'))).toBe('hello');
    expect(await withSessionLock('sha-val-null', () => Promise.resolve(null))).toBeNull();
  });
});
