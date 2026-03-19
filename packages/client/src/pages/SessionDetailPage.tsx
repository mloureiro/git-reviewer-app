import { Link, useParams } from 'react-router-dom';
import { DiffView } from '../components/DiffView';
import { useDiff } from '../hooks/useDiff';
import { useReviewSession } from '../hooks/useReviewSession';
import type { ReviewStatus } from '../types/review';

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
};

function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`status-badge status-badge--${status}`}>{STATUS_LABELS[status]}</span>;
}

export function SessionDetailPage() {
  const { commitSha } = useParams<{ commitSha: string }>();

  const {
    session: reviewData,
    loading: sessionLoading,
    error: sessionError,
  } = useReviewSession(commitSha ?? '');

  const diffParams =
    reviewData != null
      ? { base: reviewData.session.baseRef, head: reviewData.session.headRef }
      : null;

  const { diff, loading: diffLoading, error: diffError } = useDiff(diffParams);

  if (sessionLoading) {
    return <div className="loading">Loading session...</div>;
  }

  if (sessionError) {
    return (
      <div className="session-detail">
        <div className="session-detail__back">
          <Link to="/" className="btn btn--secondary">
            ← Back to sessions
          </Link>
        </div>
        <div className="error">Error loading session: {sessionError}</div>
      </div>
    );
  }

  if (reviewData == null) {
    return (
      <div className="session-detail">
        <div className="session-detail__back">
          <Link to="/" className="btn btn--secondary">
            ← Back to sessions
          </Link>
        </div>
        <div className="empty">Session not found.</div>
      </div>
    );
  }

  const { session } = reviewData;

  return (
    <div className="session-detail">
      <div className="session-detail__back">
        <Link to="/" className="btn btn--secondary">
          ← Back to sessions
        </Link>
      </div>

      <div className="session-detail__header">
        <div className="session-detail__title-row">
          <h1 className="session-detail__title">{session.title}</h1>
          <StatusBadge status={session.status} />
        </div>
        <div className="session-detail__refs">
          <code>{session.baseRef}</code>
          <span className="session-card__arrow">→</span>
          <code>{session.headRef}</code>
        </div>
      </div>

      {diffLoading && <div className="loading">Loading diff...</div>}
      {diffError && <div className="error">Error loading diff: {diffError}</div>}
      {!diffLoading && !diffError && diff != null && <DiffView diffText={diff} />}
      {!diffLoading && !diffError && diff == null && (
        <div className="empty">No changes to review.</div>
      )}
    </div>
  );
}
