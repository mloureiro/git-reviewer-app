import { useState, useCallback, useEffect, useRef } from 'react';
import { resolveRefs } from '../api/reviews';

const POLL_INTERVAL_MS = 30_000;

interface UseChangeDetectionOptions {
  baseRef: string;
  headRef: string;
  baseCommit: string;
  headCommit: string;
  enabled: boolean;
}

export interface UseChangeDetectionReturn {
  hasChanges: boolean;
  changedRefs: string[];
  revision: number;
  refresh: () => void;
  dismiss: () => void;
}

export function useChangeDetection({
  baseRef,
  headRef,
  baseCommit,
  headCommit,
  enabled,
}: UseChangeDetectionOptions): UseChangeDetectionReturn {
  const [hasChanges, setHasChanges] = useState(false);
  const [changedRefs, setChangedRefs] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Track latest commits so polling always compares against current values
  const knownCommitsRef = useRef({ baseCommit, headCommit });
  knownCommitsRef.current = { baseCommit, headCommit };

  const refresh = useCallback(() => {
    setRevision((r) => r + 1);
    setHasChanges(false);
    setChangedRefs([]);
    setDismissed(false);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | undefined;

    function startPolling() {
      timer = setInterval(async () => {
        // Skip if tab is hidden or changes already detected
        if (document.visibilityState === 'hidden') return;
        if (hasChanges) return;

        try {
          const refsToResolve = [baseRef, headRef].filter(Boolean);
          const uniqueRefs = [...new Set(refsToResolve)];
          if (uniqueRefs.length === 0) return;

          const result = await resolveRefs(uniqueRefs);
          const changed: string[] = [];
          const known = knownCommitsRef.current;

          if (result.refs[baseRef] && result.refs[baseRef] !== known.baseCommit) {
            changed.push(baseRef);
          }
          if (result.refs[headRef] && result.refs[headRef] !== known.headCommit) {
            changed.push(headRef);
          }

          if (changed.length > 0) {
            setHasChanges(true);
            setChangedRefs(changed);
          }
        } catch {
          // Silently ignore poll errors — will retry next interval
        }
      }, POLL_INTERVAL_MS);
    }

    startPolling();
    return () => clearInterval(timer);
  }, [enabled, baseRef, headRef, hasChanges]);

  return {
    hasChanges: hasChanges && !dismissed,
    changedRefs,
    revision,
    refresh,
    dismiss,
  };
}
