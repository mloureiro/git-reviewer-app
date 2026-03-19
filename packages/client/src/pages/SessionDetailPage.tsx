import React, { useCallback, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CommentThread } from '../components/CommentThread';
import { DiffView, filePathToId } from '../components/DiffView';
import { FileTree } from '../components/FileTree';
import { InlineCommentForm } from '../components/InlineCommentForm';
import { useActiveFileOnScroll } from '../hooks/useActiveFileOnScroll';
import { useDiff } from '../hooks/useDiff';
import { useFiles } from '../hooks/useFiles';
import { useReviewSession } from '../hooks/useReviewSession';
import type { CommentFormData, DiffLineData, ReviewComment, ReviewStatus } from '../types/review';

const STATUS_LABELS: Record<ReviewStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  changes_requested: 'Changes Requested',
};

function StatusBadge({ status }: { status: ReviewStatus }) {
  return <span className={`status-badge status-badge--${status}`}>{STATUS_LABELS[status]}</span>;
}

/** Stable key for grouping comments by file + line. */
function commentKey(file: string, line: number): string {
  return `${file}:${line}`;
}

/** Build a map from `file:line` to the list of comments on that line. */
function groupCommentsByLine(comments: ReviewComment[]): Map<string, ReviewComment[]> {
  const map = new Map<string, ReviewComment[]>();
  for (const comment of comments) {
    const key = commentKey(comment.file, comment.line);
    const existing = map.get(key);
    if (existing != null) {
      existing.push(comment);
    } else {
      map.set(key, [comment]);
    }
  }
  return map;
}

export function SessionDetailPage() {
  const { commitSha } = useParams<{ commitSha: string }>();
  const [activeFile, setActiveFile] = useState<string | undefined>(undefined);
  const [activeLine, setActiveLine] = useState<DiffLineData | null>(null);

  // When the user clicks a file in the sidebar we suppress scroll-based
  // activeFile updates for 1 s so the observer does not immediately override
  // the just-clicked file.
  const suppressScrollUpdateRef = useRef(false);

  const {
    session: reviewData,
    loading: sessionLoading,
    error: sessionError,
    addComment,
    resolveComment,
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

  function handleLineClick(lineData: DiffLineData): void {
    // Toggle: clicking the same line again closes the form.
    setActiveLine((prev) =>
      prev != null && prev.file === lineData.file && prev.line === lineData.line ? null : lineData,
    );
  }

  const handleCommentSubmit = useCallback(
    async (formData: CommentFormData): Promise<void> => {
      if (commitSha == null) return;
      await addComment({
        file: formData.file,
        line: formData.line,
        side: formData.side,
        body: formData.body,
        author: 'reviewer',
      });
      setActiveLine(null);
    },
    [addComment, commitSha],
  );

  const handleCommentResolve = useCallback(
    async (commentId: string, resolved: boolean): Promise<void> => {
      await resolveComment(commentId, resolved);
    },
    [resolveComment],
  );

  const comments = reviewData?.comments ?? [];
  const commentsByLine = groupCommentsByLine(comments);

  const renderAfterLine = useCallback(
    (lineData: DiffLineData): React.ReactNode => {
      const key = commentKey(lineData.file, lineData.line);
      const lineComments = commentsByLine.get(key);
      const isActiveLine =
        activeLine != null &&
        activeLine.file === lineData.file &&
        activeLine.line === lineData.line;

      if (!isActiveLine && (lineComments == null || lineComments.length === 0)) {
        return null;
      }

      return (
        <>
          {lineComments != null && lineComments.length > 0 && (
            <CommentThread
              comments={lineComments}
              onResolve={handleCommentResolve}
              onReply={isActiveLine ? undefined : () => setActiveLine(lineData)}
            />
          )}
          {isActiveLine && (
            <InlineCommentForm
              lineData={activeLine}
              onSubmit={handleCommentSubmit}
              onCancel={() => setActiveLine(null)}
            />
          )}
        </>
      );
    },
    [activeLine, commentsByLine, handleCommentResolve, handleCommentSubmit],
  );

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
          {!diffLoading && !diffError && diff != null && (
            <DiffView
              diffText={diff}
              onLineClick={handleLineClick}
              renderAfterLine={renderAfterLine}
            />
          )}
          {!diffLoading && !diffError && diff == null && (
            <div className="empty">No changes to review.</div>
          )}
        </div>
      </div>
    </div>
  );
}
