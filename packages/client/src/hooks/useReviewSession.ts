import { useCallback, useEffect, useState } from 'react';
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
      .then((data) => {
        if (!cancelled) {
          setSession(data);
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

  const handleUpdateStatus = useCallback(
    async (status: ReviewStatus): Promise<void> => {
      const updatedSessionMeta = await updateSessionStatus(commitSha, { status });
      setSession((prev) => {
        if (prev === null) return prev;
        return { ...prev, session: updatedSessionMeta };
      });
    },
    [commitSha],
  );

  const handleAddComment = useCallback(
    async (data: CreateCommentRequest): Promise<ReviewComment> => {
      const comment = await postComment(commitSha, data);
      setSession((prev) => {
        if (prev === null) return prev;
        return { ...prev, comments: [...prev.comments, comment] };
      });
      return comment;
    },
    [commitSha],
  );

  const handleResolveComment = useCallback(
    async (commentId: string, resolved: boolean): Promise<void> => {
      const updatedComment = await patchComment(commitSha, commentId, { resolved });
      setSession((prev) => {
        if (prev === null) return prev;
        const comments = prev.comments.map((c) => (c.id === commentId ? updatedComment : c));
        return { ...prev, comments };
      });
    },
    [commitSha],
  );

  const handleMarkViewed = useCallback(
    async (path: string): Promise<void> => {
      // Optimistic update
      setSession((prev) => {
        if (prev === null) return prev;
        const viewedFiles = prev.viewedFiles ?? [];
        const optimistic: ViewedFile = {
          path,
          viewedAt: new Date().toISOString(),
          diffHash: '',
        };
        const existing = viewedFiles.findIndex((vf) => vf.path === path);
        const next = [...viewedFiles];
        if (existing >= 0) {
          next[existing] = optimistic;
        } else {
          next.push(optimistic);
        }
        return { ...prev, viewedFiles: next };
      });

      const viewedFile = await markFileViewed(commitSha, path);
      // Update with server response (has correct diffHash)
      setSession((prev) => {
        if (prev === null) return prev;
        const viewedFiles = (prev.viewedFiles ?? []).map((vf) =>
          vf.path === path ? viewedFile : vf,
        );
        return { ...prev, viewedFiles };
      });
    },
    [commitSha],
  );

  const handleUnmarkViewed = useCallback(
    async (path: string): Promise<void> => {
      // Optimistic update
      setSession((prev) => {
        if (prev === null) return prev;
        return {
          ...prev,
          viewedFiles: (prev.viewedFiles ?? []).filter((vf) => vf.path !== path),
        };
      });

      await unmarkFileViewed(commitSha, path);
    },
    [commitSha],
  );

  const handleSetAutoMarkRules = useCallback(
    async (rules: AutoMarkRule[]): Promise<void> => {
      const response = await updateAutoMarkRules(commitSha, rules);
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
    },
    [commitSha],
  );

  const handleReapplyAutoMarkRules = useCallback(async (): Promise<void> => {
    const response = await applyAutoMarkRules(commitSha);
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
  }, [commitSha]);

  return {
    session,
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
