import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { DiffView, filePathToId } from '../components/DiffView';
import { FileTree } from '../components/FileTree';
import { useActiveFileOnScroll } from '../hooks/useActiveFileOnScroll';
import { useDiff } from '../hooks/useDiff';
import { useFiles } from '../hooks/useFiles';
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
  const [activeFile, setActiveFile] = useState<string | undefined>(undefined);

  // When the user clicks a file in the sidebar we suppress scroll-based
  // activeFile updates for 1 s so the observer does not immediately override
  // the just-clicked file.
  const suppressScrollUpdateRef = useRef(false);

  const {
    session: reviewData,
    loading: sessionLoading,
    error: sessionError,
  } = useReviewSession(commitSha ?? '');

  const filesParams =
    reviewData != null
      ? { base: reviewData.session.baseRef, head: reviewData.session.headRef }
      : null;

  const diffParams = filesParams;

  const { files } = useFiles(filesParams);
  const { diff, loading: diffLoading, error: diffError } = useDiff(diffParams);

  const filePaths = files.map((f) => f.path);

  useActiveFileOnScroll(filePaths, setActiveFile, suppressScrollUpdateRef);

  function handleFileClick(filePath: string): void {
    setActiveFile(filePath);

    // Suppress observer-driven updates while the smooth scroll is in flight.
    suppressScrollUpdateRef.current = true;
    setTimeout(() => {
      suppressScrollUpdateRef.current = false;
    }, 1000);

    const sectionId = filePathToId(filePath);
    const element = document.getElementById(sectionId);
    if (element != null) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

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

      <div className="review-layout">
        {files.length > 0 && (
          <aside className="review-layout__sidebar">
            <FileTree files={files} onFileClick={handleFileClick} activeFile={activeFile} />
          </aside>
        )}

        <div className="review-layout__main">
          {diffLoading && <div className="loading">Loading diff...</div>}
          {diffError && <div className="error">Error loading diff: {diffError}</div>}
          {!diffLoading && !diffError && diff != null && <DiffView diffText={diff} />}
          {!diffLoading && !diffError && diff == null && (
            <div className="empty">No changes to review.</div>
          )}
        </div>
      </div>
    </div>
  );
}
