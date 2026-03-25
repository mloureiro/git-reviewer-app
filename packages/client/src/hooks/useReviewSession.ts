import { useCallback, useEffect, useState } from 'react';
import { fetchSession, updateSessionStatus, postComment, patchComment } from '../api/reviews';
import type {
  ReviewData,
  ReviewStatus,
  ReviewComment,
  CreateCommentRequest,
} from '../types/review';

export interface UseReviewSessionResult {
  session: ReviewData | null;
  loading: boolean;
  error: string | null;
  updateStatus: (status: ReviewStatus) => Promise<void>;
  addComment: (data: CreateCommentRequest) => Promise<ReviewComment>;
  resolveComment: (commentId: string, resolved: boolean) => Promise<void>;
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

  return {
    session,
    loading,
    error,
    updateStatus: handleUpdateStatus,
    addComment: handleAddComment,
    resolveComment: handleResolveComment,
  };
}
