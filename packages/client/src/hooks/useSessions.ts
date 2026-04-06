import { useState, useEffect, useCallback } from 'react';
import { fetchSessions, validateSessions } from '../api/reviews';
import type { ReviewData, SessionHealth, SessionStats } from '../types/review';

interface UseSessionsResult {
  sessions: ReviewData[] | null;
  loading: boolean;
  error: string | null;
  health: Record<string, SessionHealth>;
  stats: Record<string, SessionStats>;
  refetch: () => void;
}

export function useSessions(): UseSessionsResult {
  const [sessions, setSessions] = useState<ReviewData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<Record<string, SessionHealth>>({});
  const [stats, setStats] = useState<Record<string, SessionStats>>({});
  const [revision, setRevision] = useState(0);

  const refetch = useCallback(() => {
    setRevision((r) => r + 1);
  }, []);

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

        // Fire async validation after sessions load
        if (!cancelled) {
          validateSessions()
            .then((result) => {
              if (!cancelled) {
                setHealth(result.health);
                setStats(result.stats);
              }
            })
            .catch(() => {
              // Validation is best-effort; don't block the UI
            });
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
  }, [revision]);

  return { sessions, loading, error, health, stats, refetch };
}
