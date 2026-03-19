import { useEffect, useState } from 'react';
import { fetchDiff } from '../api/reviews';
import type { DiffQueryParams } from '../types/review';

export interface UseDiffResult {
  diff: string | null;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches diff text from the API for the given query params.
 * Re-fetches whenever params change.
 */
export function useDiff(params: DiffQueryParams): UseDiffResult {
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stringify params to create a stable primitive dependency that changes only when params content changes
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    const currentParams: DiffQueryParams = JSON.parse(paramsKey) as DiffQueryParams;

    fetchDiff(currentParams)
      .then((response) => {
        if (!cancelled) {
          setDiff(response.diff);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch diff');
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
  }, [paramsKey]);

  return { diff, loading, error };
}
