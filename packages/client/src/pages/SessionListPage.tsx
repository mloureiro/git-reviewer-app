import { useState, useEffect, useCallback, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ReviewData } from '../types/review';
import { StatusBadge } from '../components/StatusBadge';
import { useSessions } from '../hooks/useSessions';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function useRepoCheck() {
  const [repoPath, setRepoPath] = useState<string | null>(null);
  const [checking, setChecking] = useState(isTauri());
  const [needsRepo, setNeedsRepo] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    (async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const result = (await invoke('get_current_repo')) as string | null;
        if (result) {
          setRepoPath(result);
        } else {
          setNeedsRepo(true);
        }
      } catch {
        setNeedsRepo(true);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  const selectRepo = useCallback(async () => {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const selected = await open({ directory: true, title: 'Select a Git Repository' });
      if (!selected) return;
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('select_repository', { path: selected });
      setRepoPath(selected);
      setNeedsRepo(false);
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return { repoPath, checking, needsRepo, selectRepo };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function InstallCliButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleInstall = useCallback(async () => {
    setStatus('loading');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = (await invoke('install_cli')) as string;
      setStatus('success');
      setMessage(result);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  if (!isTauri()) {
    return null;
  }

  return (
    <div className="install-cli">
      <button
        className="btn btn--secondary btn--sm"
        onClick={handleInstall}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Installing...' : 'Install CLI'}
      </button>
      {status === 'success' && (
        <span className="install-cli__message install-cli__message--success">{message}</span>
      )}
      {status === 'error' && (
        <span className="install-cli__message install-cli__message--error">{message}</span>
      )}
    </div>
  );
}

function repoDisplayName(repoPath: string): string {
  if (!repoPath) return 'Unknown';
  const segments = repoPath.replace(/\/+$/, '').split('/');
  return segments[segments.length - 1] || repoPath;
}

function SessionCard({ reviewData }: { reviewData: ReviewData }) {
  const { session } = reviewData;
  return (
    <li key={session.id} className="session-card">
      <div className="session-card__main">
        <Link to={`/session/${session.headCommit}`} className="session-card__title">
          {session.title}
        </Link>
        <div className="session-card__meta">
          <span className="session-card__refs">
            <code>{session.baseRef}</code>
            <span className="session-card__arrow">→</span>
            <code>{session.headRef}</code>
          </span>
          <span className="session-card__date">Updated {formatDate(session.updatedAt)}</span>
        </div>
      </div>
      <div className="session-card__aside">
        <StatusBadge status={session.status} />
      </div>
    </li>
  );
}

function SessionGroups({ sessions }: { sessions: ReviewData[] }) {
  const grouped = useMemo(() => {
    const groups = new Map<string, ReviewData[]>();
    for (const rd of sessions) {
      const key = rd.session.repoPath ?? '';
      const list = groups.get(key) ?? [];
      list.push(rd);
      groups.set(key, list);
    }
    return groups;
  }, [sessions]);

  const groupEntries = [...grouped.entries()];
  const hasManyGroups = groupEntries.length > 1;

  return (
    <div className="session-groups">
      {groupEntries.map(([repoPath, groupSessions]) => (
        <div key={repoPath || '__default'} className="session-group">
          {hasManyGroups && (
            <div className="session-group__header" title={repoPath || undefined}>
              <span className="session-group__name">{repoDisplayName(repoPath)}</span>
              <span className="session-group__path">{repoPath}</span>
            </div>
          )}
          <ul className="session-list__items">
            {groupSessions.map((rd) => (
              <SessionCard key={rd.session.id} reviewData={rd} />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export function SessionListPage() {
  const { checking, needsRepo, selectRepo } = useRepoCheck();
  const { sessions, loading, error } = useSessions();

  if (checking) {
    return <div className="loading">Checking repository...</div>;
  }

  if (needsRepo) {
    return (
      <div className="session-list-empty">
        <p className="session-list-empty__message">No git repository selected.</p>
        <p>Open a git repository to start reviewing code.</p>
        <button className="btn btn--primary" onClick={selectRepo}>
          Open Repository
        </button>
        <InstallCliButton />
      </div>
    );
  }

  if (loading) {
    return <div className="loading">Loading sessions...</div>;
  }

  if (error) {
    return <div className="error">Error: {error}</div>;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="session-list-empty">
        <p className="session-list-empty__message">No review sessions yet.</p>
        <Link to="/new" className="btn btn--primary">
          Create your first review
        </Link>
        <InstallCliButton />
      </div>
    );
  }

  return (
    <div className="session-list">
      <div className="session-list__header">
        <h1 className="session-list__title">Review Sessions</h1>
        <div className="session-list__actions">
          <InstallCliButton />
          <Link to="/new" className="btn btn--primary">
            New Review
          </Link>
        </div>
      </div>

      <SessionGroups sessions={sessions} />
    </div>
  );
}
