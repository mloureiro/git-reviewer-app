import { useState, useEffect } from 'react';
import { fetchSessions } from '../api/reviews';
import type { ReviewData } from '../types/review';

interface UseSessionsResult {
  sessions: ReviewData[] | null;
  loading: boolean;
  error: string | null;
}

export function useSessions(): UseSessionsResult {
  const [sessions, setSessions] = useState<ReviewData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    setLoading(true);
    setError(null);

    fetchSessions()
      .then((response) => {
        if (!cancelled) {
          setSessions(response.sessions);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : 'Failed to fetch sessions';
          setError(message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { sessions, loading, error };
}
