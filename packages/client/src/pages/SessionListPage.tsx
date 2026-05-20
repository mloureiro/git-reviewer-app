import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { ReviewData, SessionHealth, SessionStats } from '../types/review';
import { StatusBadge } from '../components/StatusBadge';
import { Button, LinkButton } from '../components/ui';
import { useSessions } from '../hooks/useSessions';
import { removeRepo, deleteSession } from '../api/reviews';

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

function repoDisplayName(repoPath: string): string {
  if (!repoPath) return 'Unknown';
  const segments = repoPath.replace(/\/+$/, '').split('/');
  return segments[segments.length - 1] || repoPath;
}

function staleRemoveLabel(health: SessionHealth): string {
  if (health.status !== 'stale') return '';
  return health.reason === 'no-changes' ? 'Remove empty review' : 'Remove stale review';
}

function staleTooltip(health: SessionHealth): string {
  if (health.status !== 'stale') return '';
  switch (health.reason) {
    case 'base-ref-missing':
      return 'Base branch no longer exists';
    case 'head-ref-missing':
      return 'Head branch no longer exists';
    case 'both-refs-missing':
      return 'Both branches no longer exist';
    case 'no-changes':
      return 'No differences between branches';
    default:
      return '';
  }
}

function SessionCard({
  reviewData,
  health,
  stats,
  onRemoved,
}: {
  reviewData: ReviewData;
  health?: SessionHealth;
  stats?: SessionStats;
  onRemoved: () => void;
}) {
  const { session } = reviewData;
  const isStale = health?.status === 'stale';
  const [removing, setRemoving] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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

  const handleRemove = useCallback(async () => {
    setRemoving(true);
    try {
      await deleteSession(session.headCommit, session.repoPath);
      onRemoved();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setRemoving(false);
    }
  }, [session.headCommit, session.repoPath, onRemoved]);

  const handleDeleteHealthy = useCallback(async () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    setRemoving(true);
    try {
      await deleteSession(session.headCommit, session.repoPath);
      onRemoved();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
      setRemoving(false);
      setConfirmingDelete(false);
    }
  }, [confirmingDelete, session.headCommit, session.repoPath, onRemoved]);

  const cardClass = ['session-card', isStale ? 'session-card--stale' : '']
    .filter(Boolean)
    .join(' ');

  return (
    <li key={session.id} className={cardClass}>
      <div className="session-card__main">
        {isStale ? (
          <span className="session-card__title session-card__title--disabled">{session.title}</span>
        ) : (
          <Link to={`/session/${session.headCommit}`} className="session-card__title">
            {session.title}
          </Link>
        )}
        <div className="session-card__meta">
          <span className="session-card__refs">
            <code>{session.baseRef}</code>
            <span className="session-card__arrow">→</span>
            <code>{session.headRef}</code>
          </span>
          {session.headCommitDate && (
            <span className="session-card__date">Commit {formatDate(session.headCommitDate)}</span>
          )}
          <span className="session-card__date">Updated {formatDate(session.updatedAt)}</span>
          {stats != null && (
            <span className="session-card__stats">
              <span className="session-card__stat-files">{stats.files} files</span>
              {stats.additions > 0 && (
                <span className="session-card__stat-adds">+{stats.additions}</span>
              )}
              {stats.deletions > 0 && (
                <span className="session-card__stat-dels">-{stats.deletions}</span>
              )}
            </span>
          )}
        </div>
      </div>
      <div className="session-card__aside">
        {isStale && health != null && (
          <Button
            variant="danger"
            size="sm"
            onClick={handleRemove}
            disabled={removing}
            title={staleTooltip(health)}
          >
            {removing ? 'Removing...' : staleRemoveLabel(health)}
          </Button>
        )}
        {!isStale && isTauri() && (
          <Button variant="ghost" size="sm" onClick={openInNewWindow} title="Open in new window">
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
          </Button>
        )}
        {!isStale && (
          <Button
            variant="danger"
            size="sm"
            onClick={handleDeleteHealthy}
            disabled={removing}
            title="Delete review"
          >
            {removing ? 'Deleting...' : confirmingDelete ? 'Confirm delete?' : 'Delete'}
          </Button>
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
      if (menuRef.current && e.target instanceof Node && !menuRef.current.contains(e.target)) {
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
  health,
  stats,
  onRepoRemoved,
}: {
  sessions: ReviewData[];
  health: Record<string, SessionHealth>;
  stats: Record<string, SessionStats>;
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

    // Sort sessions within each group by head commit date descending (newest first)
    for (const [, list] of groups) {
      list.sort((a, b) => {
        const dateA = a.session.headCommitDate ?? a.session.updatedAt;
        const dateB = b.session.headCommitDate ?? b.session.updatedAt;
        return dateB.localeCompare(dateA);
      });
    }

    // Sort groups by repo path
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
                  <SessionCard
                    key={rd.session.id}
                    reviewData={rd}
                    health={health[rd.session.headCommit]}
                    stats={stats[rd.session.headCommit]}
                    onRemoved={onRepoRemoved}
                  />
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SessionListPage(): React.ReactNode {
  const { sessions, loading, error, health, stats, refetch } = useSessions();
  const { checking, needsRepo, selectRepo } = useRepoCheck(refetch);

  if (checking) {
    return <div className="loading">Checking repository...</div>;
  }

  if (needsRepo) {
    return (
      <div className="session-list-empty">
        <p className="session-list-empty__message">No git repository selected.</p>
        <p>Open a git repository to start reviewing code.</p>
        <Button variant="primary" onClick={selectRepo}>
          Open Repository
        </Button>
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
        <LinkButton variant="primary" to="/new">
          Create your first review
        </LinkButton>
      </div>
    );
  }

  return (
    <div className="session-list">
      <div className="session-list__header">
        <h1 className="session-list__title">Reviews</h1>
        <div className="session-list__actions">
          {isTauri() && (
            <Button variant="secondary" onClick={selectRepo}>
              Add Repository
            </Button>
          )}
          <LinkButton variant="primary" to="/new">
            New Review
          </LinkButton>
        </div>
      </div>

      <SessionGroups sessions={sessions} health={health} stats={stats} onRepoRemoved={refetch} />
    </div>
  );
}
