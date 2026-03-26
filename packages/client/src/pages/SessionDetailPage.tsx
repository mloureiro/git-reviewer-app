import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AutoMarkSettings } from '../components/AutoMarkSettings';
import { CommentThread } from '../components/CommentThread';
import { ColorSchemeType } from 'diff2html/lib-esm/types';
import { DiffView, filePathToId } from '../components/DiffView';
import { DiffViewToggle } from '../components/DiffViewToggle';
import { FileTree } from '../components/FileTree';
import { InlineCommentForm } from '../components/InlineCommentForm';
import { ReviewActions } from '../components/ReviewActions';
import { ReviewSummaryBar } from '../components/ReviewSummaryBar';
import { ShortcutsHelpModal } from '../components/ShortcutsHelpModal';
import { StatusBadge } from '../components/StatusBadge';
import { useActiveFileOnScroll } from '../hooks/useActiveFileOnScroll';
import { useDiff } from '../hooks/useDiff';
import { useFileFocus } from '../hooks/useFileFocus';
import { useFiles } from '../hooks/useFiles';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useLineFocus } from '../hooks/useLineFocus';
import { useLocalStorage } from '../hooks/useLocalStorage';
import { useResponsiveDiffMode } from '../hooks/useResponsiveDiffMode';
import { useReviewSession } from '../hooks/useReviewSession';
import { useTheme } from '../hooks/useTheme';
import { extractFocusableLines } from '../utils/diffLines';
import type {
  AutoMarkRule,
  CommentFormData,
  DiffLineData,
  DiffViewMode,
  ReviewComment,
  ReviewStatus,
} from '../types/review';

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
  const { theme } = useTheme();
  const colorScheme = theme === 'dark' ? ColorSchemeType.DARK : ColorSchemeType.LIGHT;
  const [activeFile, setActiveFile] = useState<string | undefined>(undefined);
  const [activeLine, setActiveLine] = useState<DiffLineData | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  // The user's stored preference (persisted to localStorage).
  const [diffViewMode, setDiffViewMode] = useLocalStorage<DiffViewMode>(
    'git-reviewer:diff-view-mode',
    'line-by-line',
  );

  // The mode actually rendered — may be overridden to 'line-by-line' on narrow
  // screens regardless of the stored preference.
  const [activeDiffViewMode, setActiveDiffViewMode] = useState<DiffViewMode>(diffViewMode);

  // When the user explicitly changes the mode via the toggle, persist the
  // preference AND apply it as the active mode immediately.
  const handleDiffViewModeChange = useCallback(
    (mode: DiffViewMode): void => {
      setDiffViewMode(mode);
      setActiveDiffViewMode(mode);
    },
    [setDiffViewMode],
  );

  // Sync activeDiffViewMode when the viewport width crosses the narrow
  // threshold (e.g. resize to mobile → force line-by-line; resize back →
  // restore stored preference).
  useResponsiveDiffMode(diffViewMode, activeDiffViewMode, setActiveDiffViewMode);

  // When the user clicks a file in the sidebar we suppress scroll-based
  // activeFile updates for 1 s so the observer does not immediately override
  // the just-clicked file.
  const suppressScrollUpdateRef = useRef(false);

  const {
    session: reviewData,
    loading: sessionLoading,
    error: sessionError,
    updateStatus,
    addComment,
    resolveComment,
    markViewed,
    unmarkViewed,
    setAutoMarkRules,
    reapplyAutoMarkRules,
  } = useReviewSession(commitSha ?? '');

  const filesParams =
    reviewData != null
      ? { base: reviewData.session.baseRef, head: reviewData.session.headRef }
      : null;

  const diffParams = filesParams;

  const { files, diffHashes } = useFiles(filesParams);
  const { diff, loading: diffLoading, error: diffError } = useDiff(diffParams);

  const filePaths = files.map((f) => f.path);

  const { focusedFilePath, focusNext, focusPrev, clearFocus } = useFileFocus(filePaths);

  // Derive the flat list of focusable lines from the parsed diff.
  const focusableLines = useMemo(() => extractFocusableLines(diff ?? ''), [diff]);

  // When the line focus crosses a file boundary, sync the file-level focus.
  const handleLineBoundary = useCallback(
    (filePath: string): void => {
      const fileIndex = filePaths.indexOf(filePath);
      if (fileIndex === -1) return;

      // Directly scroll the section into view; file focus state is managed by
      // useFileFocus internally via focusNext/focusPrev, so here we just scroll.
      const sectionId = filePathToId(filePath);
      const element = document.getElementById(sectionId);
      if (element != null) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    },
    [filePaths],
  );

  const { focusedLine, focusLineNext, focusLinePrev, clearLineFocus } = useLineFocus(
    focusableLines,
    handleLineBoundary,
  );

  // Reset all focus and the open comment form whenever the diff data changes
  // (e.g. when the session's refs produce a different diff set). This prevents
  // stale focused indices from pointing at lines that no longer exist.
  useEffect(() => {
    clearFocus();
    clearLineFocus();
    setActiveLine(null);
  }, [diff, clearFocus, clearLineFocus]);

  /**
   * Open the inline comment form for the currently focused line.
   * No-op when no line is focused.
   */
  const handleOpenCommentOnFocusedLine = useCallback((): void => {
    if (focusedLine == null) return;

    // Find the full DiffLineData (with content) for the focused line.
    // We need the content field which FocusableLine doesn't carry, so we look
    // up the matching entry from the parsed focusableLines array and use an
    // empty string as the content fallback (content is only used for display,
    // not for storing the comment).
    setActiveLine({
      file: focusedLine.file,
      line: focusedLine.line,
      side: focusedLine.side,
      content: '',
    });
  }, [focusedLine]);

  /**
   * Hierarchical Escape handler:
   *   1. Close the help modal if it is open.
   *   2. Dismiss open comment form if one is active.
   *   3. Clear line focus if a line is focused but no form is open.
   *   4. Clear file focus if a file is focused but no line is focused.
   *
   * Note: when the comment form's textarea has DOM focus the global keydown
   * listener is suppressed by isTypingTarget, so InlineCommentForm handles
   * Escape internally. This handler fires only when the textarea is NOT focused
   * (e.g. the form row is visible but focus has moved away).
   *
   * Note: when the help modal is open, ShortcutsHelpModal has its own Escape
   * listener that fires first. The shortcut registry is also disabled while
   * the modal is open, so this handler only fires when the modal is closed.
   */
  const handleEscape = useCallback((): void => {
    if (activeLine != null) {
      setActiveLine(null);
      return;
    }
    if (focusedLine != null) {
      clearLineFocus();
      return;
    }
    if (focusedFilePath != null) {
      clearFocus();
    }
  }, [activeLine, focusedLine, focusedFilePath, clearLineFocus, clearFocus]);

  const handleToggleHelp = useCallback((): void => {
    setIsHelpOpen((prev) => !prev);
  }, []);

  const handleCloseHelp = useCallback((): void => {
    setIsHelpOpen(false);
  }, []);

  // Shortcuts are disabled while the help modal is open so that pressing keys
  // while reading the modal does not trigger navigation or comment actions.
  // The modal's own Escape listener handles closing it independently.
  const shortcutEntries = useKeyboardShortcuts(
    [
      { key: 'n', description: 'Focus next file', handler: focusNext },
      { key: 'p', description: 'Focus previous file', handler: focusPrev },
      { key: 'j', description: 'Focus next diff line', handler: focusLineNext },
      { key: 'k', description: 'Focus previous diff line', handler: focusLinePrev },
      { key: 'c', description: 'Comment on focused line', handler: handleOpenCommentOnFocusedLine },
      { key: 'Escape', description: 'Dismiss / clear focus', handler: handleEscape },
      { key: '?', description: 'Show keyboard shortcuts', handler: handleToggleHelp },
    ],
    !isHelpOpen,
  );

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

  const handleStatusChange = useCallback(
    async (status: ReviewStatus): Promise<void> => {
      setStatusUpdating(true);
      try {
        await updateStatus(status);
      } finally {
        setStatusUpdating(false);
      }
    },
    [updateStatus],
  );

  const comments = reviewData?.comments ?? [];
  const commentsByLine = groupCommentsByLine(comments);

  /** Returns true if any comment exists on the given diff line. */
  const hasCommentOnLine = useCallback(
    (lineData: DiffLineData): boolean => {
      const key = commentKey(lineData.file, lineData.line);
      const lineComments = commentsByLine.get(key);
      return lineComments != null && lineComments.length > 0;
    },
    [commentsByLine],
  );

  /** Map of file path -> count of unresolved comments on that file. */
  const unresolvedCounts: Record<string, number> = {};
  for (const comment of comments) {
    if (!comment.resolved) {
      unresolvedCounts[comment.file] = (unresolvedCounts[comment.file] ?? 0) + 1;
    }
  }

  const totalUnresolved = comments.filter((c) => !c.resolved).length;
  const summaryStats = { total: comments.length, unresolved: totalUnresolved };

  // Viewed files sets
  const viewedFilesSet = useMemo(() => {
    const set = new Set<string>();
    for (const vf of reviewData?.viewedFiles ?? []) {
      set.add(vf.path);
    }
    return set;
  }, [reviewData?.viewedFiles]);

  const changedSinceViewedSet = useMemo(() => {
    const set = new Set<string>();
    for (const vf of reviewData?.viewedFiles ?? []) {
      const currentHash = diffHashes[vf.path];
      if (currentHash != null && vf.diffHash !== '' && currentHash !== vf.diffHash) {
        set.add(vf.path);
      }
    }
    return set;
  }, [reviewData?.viewedFiles, diffHashes]);

  const handleToggleViewed = useCallback(
    (filePath: string, isCurrentlyViewed: boolean): void => {
      if (isCurrentlyViewed) {
        void unmarkViewed(filePath);
      } else {
        void markViewed(filePath);
      }
    },
    [markViewed, unmarkViewed],
  );

  // Auto-mark rule management
  const handleAutoMarkRulesChange = useCallback(
    (rules: AutoMarkRule[]): void => {
      void setAutoMarkRules(rules);
    },
    [setAutoMarkRules],
  );

  const handleAutoMarkApply = useCallback((): void => {
    void reapplyAutoMarkRules();
  }, [reapplyAutoMarkRules]);

  // Map of file path -> auto-mark rule for display in FileTree
  const autoMarkedByMap = useMemo(() => {
    const map: Record<string, AutoMarkRule> = {};
    for (const vf of reviewData?.viewedFiles ?? []) {
      if (vf.autoMarkedBy != null) {
        map[vf.path] = vf.autoMarkedBy;
      }
    }
    return map;
  }, [reviewData?.viewedFiles]);

  const renderAfterLine = useCallback(
    (lineData: DiffLineData, colSpan?: number): React.ReactNode => {
      const key = commentKey(lineData.file, lineData.line);
      const lineComments = commentsByLine.get(key);
      const isActiveLine =
        activeLine != null &&
        activeLine.file === lineData.file &&
        activeLine.line === lineData.line &&
        activeLine.side === lineData.side;

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
              colSpan={colSpan}
            />
          )}
          {isActiveLine && (
            <InlineCommentForm
              lineData={activeLine}
              onSubmit={handleCommentSubmit}
              onCancel={() => setActiveLine(null)}
              colSpan={colSpan}
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
        <div className="session-detail__review-bar">
          <ReviewSummaryBar status={session.status} stats={summaryStats} />
          <ReviewActions
            currentStatus={session.status}
            onStatusChange={handleStatusChange}
            disabled={statusUpdating}
          />
          <DiffViewToggle mode={activeDiffViewMode} onChange={handleDiffViewModeChange} />
          <AutoMarkSettings
            activeRules={reviewData.autoMarkRules ?? []}
            onRulesChange={handleAutoMarkRulesChange}
            onApplyNow={handleAutoMarkApply}
          />
        </div>
      </div>

      <div className="review-layout">
        {files.length > 0 && (
          <aside className="review-layout__sidebar">
            <FileTree
              files={files}
              onFileClick={handleFileClick}
              activeFile={activeFile}
              unresolvedCounts={unresolvedCounts}
              viewedFiles={viewedFilesSet}
              changedSinceViewed={changedSinceViewedSet}
              onToggleViewed={handleToggleViewed}
              autoMarkedBy={autoMarkedByMap}
            />
          </aside>
        )}

        <div className="review-layout__main">
          {diffLoading && <div className="loading">Loading diff...</div>}
          {diffError && <div className="error">Error loading diff: {diffError}</div>}
          {!diffLoading && !diffError && diff != null && (
            <DiffView
              diffText={diff}
              colorScheme={colorScheme}
              viewMode={activeDiffViewMode}
              focusedFile={focusedFilePath}
              focusedLine={focusedLine}
              onLineClick={handleLineClick}
              renderAfterLine={renderAfterLine}
              hasCommentOnLine={hasCommentOnLine}
              viewedFiles={viewedFilesSet}
              changedSinceViewed={changedSinceViewedSet}
              onToggleViewed={handleToggleViewed}
            />
          )}
          {!diffLoading && !diffError && diff == null && (
            <div className="empty">No changes to review.</div>
          )}
        </div>
      </div>

      <ShortcutsHelpModal
        isOpen={isHelpOpen}
        onClose={handleCloseHelp}
        shortcuts={shortcutEntries}
      />
    </div>
  );
}
