import { useEffect, useState } from 'react';
import { fetchCommits } from '../api/reviews';
import type { CommitInfo } from '../types/review';

export interface UseCommitsResult {
  commits: CommitInfo[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the list of commits for a session's base..head range.
 * Pass an empty string or `null` to skip fetching.
 */
export function useCommits(commitSha: string | null): UseCommitsResult {
  const [commits, setCommits] = useState<CommitInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!commitSha) {
      setCommits([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchCommits(commitSha)
      .then((response) => {
        if (!cancelled) {
          setCommits(response.commits);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch commits');
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

  return { commits, loading, error };
}
