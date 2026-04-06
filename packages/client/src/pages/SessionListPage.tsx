import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { ReviewData } from '../types/review';
import { StatusBadge } from '../components/StatusBadge';
import { useSessions } from '../hooks/useSessions';
import { removeRepo } from '../api/reviews';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function useRepoCheck(onRepoAdded?: () => void) {
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
      await invoke('register_repo', { path: selected });
      setRepoPath(selected);
      setNeedsRepo(false);
      onRepoAdded?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
  }, [onRepoAdded]);

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

  const openInNewWindow = useCallback(async () => {
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('open_session_window', {
        commitSha: session.headCommit,
        title: session.title,
      });
    } catch {
      // Fallback: navigate in current window
      window.location.href = `/session/${session.headCommit}`;
    }
  }, [session.headCommit, session.title]);

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
        {isTauri() && (
          <button
            className="btn btn--ghost btn--sm"
            onClick={openInNewWindow}
            title="Open in new window"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        )}
        <StatusBadge status={session.status} />
      </div>
    </li>
  );
}

function KebabMenu({ repoPath, onRemoved }: { repoPath: string; onRemoved: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirming(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const handleRemove = useCallback(async () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    try {
      await removeRepo(repoPath);
      onRemoved();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    }
    setOpen(false);
    setConfirming(false);
  }, [confirming, repoPath, onRemoved]);

  return (
    <div className="kebab-menu" ref={menuRef}>
      <button
        className="kebab-menu__trigger"
        onClick={() => {
          setOpen((v) => !v);
          setConfirming(false);
        }}
        title="More actions"
      >
        &#x22EE;
      </button>
      {open && (
        <div className="kebab-menu__dropdown">
          <button className="kebab-menu__item kebab-menu__item--danger" onClick={handleRemove}>
            {confirming ? 'Confirm remove?' : 'Remove repository'}
          </button>
        </div>
      )}
    </div>
  );
}

function SessionGroups({
  sessions,
  onRepoRemoved,
}: {
  sessions: ReviewData[];
  onRepoRemoved: () => void;
}) {
  const grouped = useMemo(() => {
    const groups = new Map<string, ReviewData[]>();
    for (const rd of sessions) {
      const key = rd.session.repoPath ?? '';
      const list = groups.get(key) ?? [];
      list.push(rd);
      groups.set(key, list);
    }
    // Sort by repo path
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [sessions]);

  const hasManyGroups = grouped.length > 1;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const toggleCollapse = useCallback((repoPath: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(repoPath)) {
        next.delete(repoPath);
      } else {
        next.add(repoPath);
      }
      return next;
    });
  }, []);

  return (
    <div className="session-groups">
      {grouped.map(([repoPath, groupSessions]) => {
        const key = repoPath || '__default';
        const isCollapsed = collapsed.has(key);

        return (
          <div key={key} className="session-group">
            {hasManyGroups && (
              <div className="session-group__header" title={repoPath || undefined}>
                <button
                  className="session-group__toggle"
                  onClick={() => toggleCollapse(key)}
                  aria-expanded={!isCollapsed}
                  aria-label={isCollapsed ? 'Expand group' : 'Collapse group'}
                >
                  <svg
                    className={`session-group__chevron${isCollapsed ? ' session-group__chevron--collapsed' : ''}`}
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>
                <span className="session-group__name">{repoDisplayName(repoPath)}</span>
                <span className="session-group__path">{repoPath}</span>
                <span className="session-group__count">{groupSessions.length}</span>
                {repoPath && <KebabMenu repoPath={repoPath} onRemoved={onRepoRemoved} />}
              </div>
            )}
            {!isCollapsed && (
              <ul className="session-list__items">
                {groupSessions.map((rd) => (
                  <SessionCard key={rd.session.id} reviewData={rd} />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SessionListPage() {
  const { sessions, loading, error, refetch } = useSessions();
  const { checking, needsRepo, selectRepo } = useRepoCheck(refetch);

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
    return <div className="loading">Loading reviews...</div>;
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
        <h1 className="session-list__title">Reviews</h1>
        <div className="session-list__actions">
          <InstallCliButton />
          {isTauri() && (
            <button className="btn btn--secondary" onClick={selectRepo}>
              Add Repository
            </button>
          )}
          <Link to="/new" className="btn btn--primary">
            New Review
          </Link>
        </div>
      </div>

      <SessionGroups sessions={sessions} onRepoRemoved={refetch} />
    </div>
  );
}
