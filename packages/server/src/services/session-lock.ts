/**
 * Per-session write lock using a promise chain (Map<string, Promise<void>>).
 *
 * Each session key maps to the tail of its current operation chain. When a new
 * write arrives for that session it is enqueued after the current tail, so all
 * writes for a given session run serially even under concurrent request load.
 *
 * Different sessions are fully independent — their chains never block each other.
 */

const locks = new Map<string, Promise<void>>();

/**
 * Enqueue `fn` after any in-flight operation for `sessionKey`.
 * Returns whatever `fn` resolves with; re-throws if `fn` rejects.
 *
 * The map entry for `sessionKey` is removed once the chain drains so the map
 * does not grow unboundedly.
 */
export async function withSessionLock<T>(sessionKey: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(sessionKey) ?? Promise.resolve();

  let resolveSlot!: () => void;
  const slot = new Promise<void>((resolve) => {
    resolveSlot = resolve;
  });

  // Register the new tail immediately so the next caller chains after this one.
  locks.set(
    sessionKey,
    previous.then(() => slot),
  );

  try {
    // Wait for all preceding operations to finish first.
    await previous;
    return await fn();
  } finally {
    resolveSlot();

    // If no other operation queued after us, clean up the map entry so it does
    // not leak memory across the lifetime of the server process.
    const current = locks.get(sessionKey);
    // The tail we registered resolves as soon as `slot` resolves (which
    // `resolveSlot()` just triggered). Schedule cleanup via microtask so that
    // any already-chained follower has had a chance to call `locks.set` first.
    void current?.then(() => {
      if (locks.get(sessionKey) === current) {
        locks.delete(sessionKey);
      }
    });
  }
}

/**
 * Exposed for testing only — returns the number of active lock chains.
 * Do NOT call from production code.
 */
export function _activeLockCount(): number {
  return locks.size;
}
