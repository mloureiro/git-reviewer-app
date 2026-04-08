import { useCallback, useEffect, useOptimistic, useState, useTransition } from 'react';
import {
  fetchSession,
  updateSessionStatus,
  postComment,
  patchComment,
  markFileViewed,
  unmarkFileViewed,
  updateAutoMarkRules,
  applyAutoMarkRules,
} from '../api/reviews';
import type {
  AutoMarkRule,
  ReviewData,
  ReviewStatus,
  ReviewComment,
  ViewedFile,
  CreateCommentRequest,
} from '../types/review';

export interface UseReviewSessionResult {
  session: ReviewData | null;
  loading: boolean;
  error: string | null;
  updateStatus: (status: ReviewStatus) => Promise<void>;
  addComment: (data: CreateCommentRequest) => Promise<ReviewComment>;
  resolveComment: (commentId: string, resolved: boolean) => Promise<void>;
  markViewed: (path: string) => Promise<void>;
  unmarkViewed: (path: string) => Promise<void>;
  setAutoMarkRules: (rules: AutoMarkRule[]) => Promise<void>;
  reapplyAutoMarkRules: () => Promise<void>;
}

type ViewedFilesAction = { type: 'mark'; path: string } | { type: 'unmark'; path: string };

function viewedFilesReducer(current: ViewedFile[], action: ViewedFilesAction): ViewedFile[] {
  if (action.type === 'unmark') {
    return current.filter((vf) => vf.path !== action.path);
  }
  // 'mark': insert or replace the entry for the path
  const optimistic: ViewedFile = {
    path: action.path,
    viewedAt: new Date().toISOString(),
    diffHash: '',
  };
  const existing = current.findIndex((vf) => vf.path === action.path);
  const next = [...current];
  if (existing >= 0) {
    next[existing] = optimistic;
  } else {
    next.push(optimistic);
  }
  return next;
}

/**
 * Loads a review session by commit SHA and exposes mutations for status and comments.
 * Re-fetches whenever `commitSha` changes.
 */
export function useReviewSession(commitSha: string): UseReviewSessionResult {
  const [session, setSession] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchSession(commitSha)
      .then((response: unknown) => {
        if (!cancelled) {
          const resp = response as { session: ReviewData };
          setSession(resp.session);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch review session');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [commitSha]);

  const repo = session?.session.repoPath;

  // useOptimistic for viewed-file mutations. While a mark/unmark transition is
  // pending, optimisticViewedFiles shows the expected result; it automatically
  // reverts to session?.viewedFiles if the transition fails.
  const [optimisticViewedFiles, dispatchOptimisticViewedFiles] = useOptimistic(
    session?.viewedFiles ?? [],
    viewedFilesReducer,
  );

  const [, startViewedTransition] = useTransition();

  const handleUpdateStatus = useCallback(
    async (status: ReviewStatus): Promise<void> => {
      const response = await updateSessionStatus(commitSha, { status }, repo);
      setSession((prev) => {
        if (prev === null) return prev;
        return { ...prev, session: response.session };
      });
    },
    [commitSha, repo],
  );

  const handleAddComment = useCallback(
    async (data: CreateCommentRequest): Promise<ReviewComment> => {
      const comment = await postComment(commitSha, data, repo);
      setSession((prev) => {
        if (prev === null) return prev;
        return { ...prev, comments: [...prev.comments, comment] };
      });
      return comment;
    },
    [commitSha, repo],
  );

  const handleResolveComment = useCallback(
    async (commentId: string, resolved: boolean): Promise<void> => {
      const updatedComment = await patchComment(commitSha, commentId, { resolved }, repo);
      setSession((prev) => {
        if (prev === null) return prev;
        const comments = prev.comments.map((c) => (c.id === commentId ? updatedComment : c));
        return { ...prev, comments };
      });
    },
    [commitSha, repo],
  );

  const handleMarkViewed = useCallback(
    (path: string): Promise<void> =>
      new Promise((resolve, reject) => {
        startViewedTransition(async () => {
          dispatchOptimisticViewedFiles({ type: 'mark', path });
          try {
            const viewedFile = await markFileViewed(commitSha, path, repo);
            // Commit the server response (includes the real diffHash) to state.
            setSession((prev) => {
              if (prev === null) return prev;
              const viewedFiles = (prev.viewedFiles ?? []).map((vf) =>
                vf.path === path ? viewedFile : vf,
              );
              // If the file wasn't in viewedFiles yet, append it.
              if (!viewedFiles.some((vf) => vf.path === path)) {
                viewedFiles.push(viewedFile);
              }
              return { ...prev, viewedFiles };
            });
            resolve();
          } catch (err) {
            // useOptimistic reverts to session?.viewedFiles automatically when
            // the transition settles with an error.
            reject(err);
          }
        });
      }),
    [commitSha, repo, dispatchOptimisticViewedFiles],
  );

  const handleUnmarkViewed = useCallback(
    (path: string): Promise<void> =>
      new Promise((resolve, reject) => {
        startViewedTransition(async () => {
          dispatchOptimisticViewedFiles({ type: 'unmark', path });
          try {
            await unmarkFileViewed(commitSha, path, repo);
            // Commit the removal to the real session state.
            setSession((prev) => {
              if (prev === null) return prev;
              return {
                ...prev,
                viewedFiles: (prev.viewedFiles ?? []).filter((vf) => vf.path !== path),
              };
            });
            resolve();
          } catch (err) {
            // useOptimistic reverts to session?.viewedFiles automatically when
            // the transition settles with an error.
            reject(err);
          }
        });
      }),
    [commitSha, repo, dispatchOptimisticViewedFiles],
  );

  const handleSetAutoMarkRules = useCallback(
    async (rules: AutoMarkRule[]): Promise<void> => {
      try {
        const response = await updateAutoMarkRules(commitSha, rules, repo);
        // Re-fetch the full session to get the merged viewedFiles state
        setSession((prev) => {
          if (prev === null) return prev;
          // Merge: keep manually-marked files, remove stale auto-marked, add new auto-marked
          const manuallyViewed = (prev.viewedFiles ?? []).filter((vf) => vf.autoMarkedBy == null);
          const autoMarkedPaths = new Set(response.autoMarked.map((vf) => vf.path));
          const kept = manuallyViewed.filter((vf) => !autoMarkedPaths.has(vf.path));
          return {
            ...prev,
            autoMarkRules: response.rules,
            viewedFiles: [...kept, ...response.autoMarked],
          };
        });
      } catch (err) {
        console.error('Failed to set auto-mark rules:', err);
      }
    },
    [commitSha, repo],
  );

  const handleReapplyAutoMarkRules = useCallback(async (): Promise<void> => {
    try {
      const response = await applyAutoMarkRules(commitSha, repo);
      setSession((prev) => {
        if (prev === null) return prev;
        const manuallyViewed = (prev.viewedFiles ?? []).filter((vf) => vf.autoMarkedBy == null);
        const autoMarkedPaths = new Set(response.autoMarked.map((vf) => vf.path));
        const kept = manuallyViewed.filter((vf) => !autoMarkedPaths.has(vf.path));
        return {
          ...prev,
          viewedFiles: [...kept, ...response.autoMarked],
        };
      });
    } catch (err) {
      console.error('Failed to re-apply auto-mark rules:', err);
    }
  }, [commitSha, repo]);

  // Merge the optimistic viewedFiles into the returned session so consumers
  // see the pending UI update without changing the public API shape.
  const sessionWithOptimistic =
    session === null ? null : { ...session, viewedFiles: optimisticViewedFiles };

  return {
    session: sessionWithOptimistic,
    loading,
    error,
    updateStatus: handleUpdateStatus,
    addComment: handleAddComment,
    resolveComment: handleResolveComment,
    markViewed: handleMarkViewed,
    unmarkViewed: handleUnmarkViewed,
    setAutoMarkRules: handleSetAutoMarkRules,
    reapplyAutoMarkRules: handleReapplyAutoMarkRules,
  };
}
