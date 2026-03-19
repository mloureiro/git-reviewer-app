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
 * Pass `null` to skip fetching (returns idle state with no HTTP request).
 */
export function useDiff(params: DiffQueryParams | null): UseDiffResult {
  const [diff, setDiff] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stringify params to create a stable primitive dependency that changes only when params content changes
  // null is serialised as the string "null" so it also forms a stable key
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    const parsedParams = JSON.parse(paramsKey) as DiffQueryParams | null;

    if (parsedParams === null) {
      setDiff(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    const currentParams: DiffQueryParams = parsedParams;

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
