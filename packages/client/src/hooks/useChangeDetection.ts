import { useState, useCallback, useEffect, useRef } from 'react';
import { fetchMergeBase, resolveRefs } from '../api/reviews';

const POLL_INTERVAL_MS = 30_000;

interface UseChangeDetectionOptions {
  baseRef: string;
  headRef: string;
  headCommit: string;
  enabled: boolean;
  repo?: string;
}

export interface UseChangeDetectionReturn {
  hasChanges: boolean;
  changedRefs: string[];
  revision: number;
  refresh: () => void;
  dismiss: () => void;
}

/**
 * Polls for changes that would affect the session's diff. Fires when:
 *   - `headRef` resolves to a new commit (new commits on the branch), or
 *   - the merge-base of (baseRef, headRef) shifts (rebase happened on either side).
 *
 * Does NOT fire when `baseRef` advances past the existing merge-base — the diff
 * uses three-dot semantics so unrelated commits on the base branch don't affect it.
 */
export function useChangeDetection({
  baseRef,
  headRef,
  headCommit,
  enabled,
  repo,
}: UseChangeDetectionOptions): UseChangeDetectionReturn {
  const [hasChanges, setHasChanges] = useState(false);
  const [changedRefs, setChangedRefs] = useState<string[]>([]);
  const [revision, setRevision] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // Tracks the merge-base computed at session-open time (or last refresh).
  // null until the initial fetch completes; while null, only head-movement is checked.
  const knownMergeBaseRef = useRef<string | null>(null);
  const knownHeadCommitRef = useRef(headCommit);
  knownHeadCommitRef.current = headCommit;

  const refresh = useCallback(() => {
    knownMergeBaseRef.current = null;
    setRevision((r) => r + 1);
    setHasChanges(false);
    setChangedRefs([]);
    setDismissed(false);
  }, []);

  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Capture the initial merge-base whenever refs change (or after refresh).
  useEffect(() => {
    if (!enabled || !baseRef || !headRef) return;

    let cancelled = false;
    fetchMergeBase(baseRef, headRef, repo)
      .then((res) => {
        if (!cancelled) knownMergeBaseRef.current = res.mergeBase;
      })
      .catch(() => {
        // If we can't compute the merge-base, fall back to head-only polling.
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, baseRef, headRef, repo, revision]);

  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(async () => {
      if (document.visibilityState === 'hidden') return;
      if (hasChanges) return;

      try {
        const changed: string[] = [];

        // 1. Did the head ref advance?
        if (headRef) {
          const refsResult = await resolveRefs([headRef], repo);
          const currentHead = refsResult.refs[headRef];
          if (currentHead && currentHead !== knownHeadCommitRef.current) {
            changed.push(headRef);
          }
        }

        // 2. Did the merge-base shift? (only meaningful once we have a baseline)
        if (baseRef && headRef && knownMergeBaseRef.current != null) {
          const mb = await fetchMergeBase(baseRef, headRef, repo);
          if (mb.mergeBase !== knownMergeBaseRef.current) {
            changed.push(baseRef);
          }
        }

        if (changed.length > 0) {
          setHasChanges(true);
          setChangedRefs(changed);
        }
      } catch {
        // Silently ignore poll errors — will retry next interval
      }
    }, POLL_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [enabled, baseRef, headRef, hasChanges, repo]);

  return {
    hasChanges: hasChanges && !dismissed,
    changedRefs,
    revision,
    refresh,
    dismiss,
  };
}
