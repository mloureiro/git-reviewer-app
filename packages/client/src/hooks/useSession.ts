import { useCallback, useEffect, useState } from 'react';
import { fetchSession, updateSessionStatus } from '../api/reviews';
import type { ReviewData, ReviewStatus } from '../types/review';

export interface UseSessionResult {
  data: ReviewData | null;
  loading: boolean;
  error: string | null;
  updateStatus: (status: ReviewStatus) => Promise<void>;
}

/**
 * Loads a review session by commit SHA and exposes an `updateStatus` mutation.
 * Re-fetches whenever `commitSha` changes.
 */
export function useSession(commitSha: string): UseSessionResult {
  const [data, setData] = useState<ReviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchSession(commitSha)
      .then((sessionData) => {
        if (!cancelled) {
          setData(sessionData);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch session');
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
      setData((prev) => {
        if (prev === null) return prev;
        return { ...prev, session: updatedSessionMeta };
      });
    },
    [commitSha],
  );

  return {
    data,
    loading,
    error,
    updateStatus: handleUpdateStatus,
  };
}
