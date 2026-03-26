import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '../components/StatusBadge';
import { useSessions } from '../hooks/useSessions';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
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

export function SessionListPage() {
  const { sessions, loading, error } = useSessions();

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

      <ul className="session-list__items">
        {sessions.map((reviewData) => {
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
                  <span className="session-card__date">
                    Updated {formatDate(session.updatedAt)}
                  </span>
                </div>
              </div>
              <div className="session-card__aside">
                <StatusBadge status={session.status} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
