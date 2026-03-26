import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * On mount, checks if the Tauri backend was launched with CLI args that
 * auto-created a review session. If so, navigates to that session.
 *
 * This is a no-op when running in the browser (non-Tauri) environment.
 */
export function useInitialSession(): void {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === 'undefined' || !('__TAURI_INTERNALS__' in window)) {
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const commitSha = (await invoke('get_initial_session')) as string | null;

        if (!cancelled && commitSha) {
          navigate(`/session/${commitSha}`, { replace: true });
        }
      } catch {
        // Silently ignore — the command may not exist in older builds
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);
}
