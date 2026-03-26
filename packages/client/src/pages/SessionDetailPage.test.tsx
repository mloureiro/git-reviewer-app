import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SessionDetailPage } from './SessionDetailPage';
import type { ReviewData, DiffFile } from '../types/review';
import type { ShortcutDescriptor } from '../hooks/useKeyboardShortcuts';

// ---------------------------------------------------------------------------
// Hook mocks
// ---------------------------------------------------------------------------

vi.mock('../hooks/useReviewSession');
vi.mock('../hooks/useFiles');
vi.mock('../hooks/useDiff');
vi.mock('../hooks/useKeyboardShortcuts');
vi.mock('../hooks/useResponsiveDiffMode');
vi.mock('../hooks/useActiveFileOnScroll');
vi.mock('../hooks/useFileFocus');
vi.mock('../hooks/useLineFocus');
vi.mock('../hooks/useTheme');
vi.mock('../hooks/useLocalStorage');

function getShortcutCall(index = 0) {
  const call = mockUseKeyboardShortcuts.mock.calls[index] ?? [];
  return call as [ShortcutDescriptor[], boolean | undefined];
}

function getLastShortcutCall() {
  const calls = mockUseKeyboardShortcuts.mock.calls;
  return getShortcutCall(calls.length - 1);
}

// Mock DiffView to a minimal stub that calls renderAfterLine for every line in
// a predictable way so tests can verify CommentThread and InlineCommentForm
// rendering without depending on the real diff2html output.
vi.mock('../components/DiffView', () => ({
  DiffView: ({
    onLineClick,
    renderAfterLine,
  }: {
    onLineClick?: (line: {
      file: string;
      line: number;
      side: 'left' | 'right';
      content: string;
    }) => void;
    renderAfterLine?: (line: {
      file: string;
      line: number;
      side: 'left' | 'right';
      content: string;
    }) => React.ReactNode;
  }) => {
    const testLine = {
      file: 'src/auth.ts',
      line: 2,
      side: 'right' as const,
      content: '+added line',
    };
    return (
      <table>
        <tbody>
          <tr data-testid="diff-line" onClick={() => onLineClick?.(testLine)}>
            <td>+added line</td>
          </tr>
          {renderAfterLine?.(testLine)}
        </tbody>
      </table>
    );
  },
  filePathToId: (path: string) => `diff-${path.replace(/\//g, '-').replace(/\./g, '-')}`,
}));

import { useReviewSession } from '../hooks/useReviewSession';
import { useFiles } from '../hooks/useFiles';
import { useDiff } from '../hooks/useDiff';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useResponsiveDiffMode } from '../hooks/useResponsiveDiffMode';
import { useFileFocus } from '../hooks/useFileFocus';
import { useLineFocus } from '../hooks/useLineFocus';
import { useTheme } from '../hooks/useTheme';
import { useLocalStorage } from '../hooks/useLocalStorage';

const mockUseReviewSession = vi.mocked(useReviewSession);
const mockUseFiles = vi.mocked(useFiles);
const mockUseDiff = vi.mocked(useDiff);
const mockUseKeyboardShortcuts = vi.mocked(useKeyboardShortcuts);
const mockUseResponsiveDiffMode = vi.mocked(useResponsiveDiffMode);
const mockUseFileFocus = vi.mocked(useFileFocus);
const mockUseLineFocus = vi.mocked(useLineFocus);
const mockUseTheme = vi.mocked(useTheme);
const mockUseLocalStorage = vi.mocked(useLocalStorage);

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SAMPLE_SESSION: ReviewData = {
  version: 1,
  session: {
    id: 'session-abc',
    title: 'Refactor auth module',
    baseRef: 'main',
    headRef: 'feature/auth',
    baseCommit: 'base123',
    headCommit: 'head456',
    status: 'pending',
    createdAt: '2026-03-25T10:00:00Z',
    updatedAt: '2026-03-25T10:00:00Z',
  },
  comments: [],
};

const SAMPLE_FILES: DiffFile[] = [
  { path: 'src/auth.ts', status: 'modified', additions: 10, deletions: 3 },
  { path: 'src/utils.ts', status: 'added', additions: 20, deletions: 0 },
];

const SAMPLE_DIFF = `diff --git a/src/auth.ts b/src/auth.ts
index 1234567..abcdefg 100644
--- a/src/auth.ts
+++ b/src/auth.ts
@@ -1,3 +1,4 @@
 existing line
+added line
 another line
`;

// ---------------------------------------------------------------------------
// Default mock implementations
// ---------------------------------------------------------------------------

const mockUpdateStatus = vi.fn();
const mockAddComment = vi.fn();
const mockResolveComment = vi.fn();
const mockFocusNext = vi.fn();
const mockFocusPrev = vi.fn();
const mockClearFocus = vi.fn();
const mockFocusLineNext = vi.fn();
const mockFocusLinePrev = vi.fn();
const mockClearLineFocus = vi.fn();

function setupDefaultMocks() {
  mockUseTheme.mockReturnValue({ theme: 'light' as const, toggleTheme: vi.fn() });

  mockUseLocalStorage.mockReturnValue(['line-by-line', vi.fn()]);

  mockUseResponsiveDiffMode.mockReturnValue(undefined);

  mockUseReviewSession.mockReturnValue({
    session: SAMPLE_SESSION,
    loading: false,
    error: null,
    updateStatus: mockUpdateStatus,
    addComment: mockAddComment,
    resolveComment: mockResolveComment,
  });

  mockUseFiles.mockReturnValue({
    files: SAMPLE_FILES,
    loading: false,
    error: null,
  });

  mockUseDiff.mockReturnValue({
    diff: SAMPLE_DIFF,
    loading: false,
    error: null,
  });

  mockUseKeyboardShortcuts.mockReturnValue([
    { key: 'n', description: 'Focus next file' },
    { key: 'p', description: 'Focus previous file' },
    { key: 'j', description: 'Focus next diff line' },
    { key: 'k', description: 'Focus previous diff line' },
    { key: 'c', description: 'Comment on focused line' },
    { key: 'Escape', description: 'Dismiss / clear focus' },
    { key: '?', description: 'Show keyboard shortcuts' },
  ]);

  mockUseFileFocus.mockReturnValue({
    focusedFilePath: null,
    focusNext: mockFocusNext,
    focusPrev: mockFocusPrev,
    clearFocus: mockClearFocus,
  });

  mockUseLineFocus.mockReturnValue({
    focusedLine: null,
    focusLineNext: mockFocusLineNext,
    focusLinePrev: mockFocusLinePrev,
    clearLineFocus: mockClearLineFocus,
  });
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderPage(commitSha = 'head456') {
  return render(
    <MemoryRouter initialEntries={[`/session/${commitSha}`]}>
      <Routes>
        <Route path="/session/:commitSha" element={<SessionDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionDetailPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setupDefaultMocks();
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe('loading state', () => {
    it('renders the loading indicator while the session is being fetched', () => {
      mockUseReviewSession.mockReturnValue({
        session: null,
        loading: true,
        error: null,
        updateStatus: mockUpdateStatus,
        addComment: mockAddComment,
        resolveComment: mockResolveComment,
      });

      renderPage();

      expect(screen.getByText('Loading session...')).toBeInTheDocument();
    });

    it('does not render session content while loading', () => {
      mockUseReviewSession.mockReturnValue({
        session: null,
        loading: true,
        error: null,
        updateStatus: mockUpdateStatus,
        addComment: mockAddComment,
        resolveComment: mockResolveComment,
      });

      renderPage();

      expect(screen.queryByText('Refactor auth module')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  describe('error state', () => {
    it('renders the error message when the session fetch fails', () => {
      mockUseReviewSession.mockReturnValue({
        session: null,
        loading: false,
        error: 'Network error',
        updateStatus: mockUpdateStatus,
        addComment: mockAddComment,
        resolveComment: mockResolveComment,
      });

      renderPage();

      expect(screen.getByText('Error loading session: Network error')).toBeInTheDocument();
    });

    it('renders a back link on the error state', () => {
      mockUseReviewSession.mockReturnValue({
        session: null,
        loading: false,
        error: 'Not found',
        updateStatus: mockUpdateStatus,
        addComment: mockAddComment,
        resolveComment: mockResolveComment,
      });

      renderPage();

      expect(screen.getByRole('link', { name: '← Back to sessions' })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Not-found / null session state
  // -------------------------------------------------------------------------

  describe('session not found', () => {
    it('renders a "Session not found" message when session is null and not loading', () => {
      mockUseReviewSession.mockReturnValue({
        session: null,
        loading: false,
        error: null,
        updateStatus: mockUpdateStatus,
        addComment: mockAddComment,
        resolveComment: mockResolveComment,
      });

      renderPage();

      expect(screen.getByText('Session not found.')).toBeInTheDocument();
    });

    it('renders a back link on the not-found state', () => {
      mockUseReviewSession.mockReturnValue({
        session: null,
        loading: false,
        error: null,
        updateStatus: mockUpdateStatus,
        addComment: mockAddComment,
        resolveComment: mockResolveComment,
      });

      renderPage();

      expect(screen.getByRole('link', { name: '← Back to sessions' })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Session loaded successfully
  // -------------------------------------------------------------------------

  describe('session loaded', () => {
    it('renders the session title', () => {
      renderPage();

      expect(screen.getByText('Refactor auth module')).toBeInTheDocument();
    });

    it('renders the base and head refs', () => {
      renderPage();

      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('feature/auth')).toBeInTheDocument();
    });

    it('renders the status badge for the current session status', () => {
      renderPage();

      const badges = screen.getAllByText('Pending');
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });

    it('renders the back link to the sessions list', () => {
      renderPage();

      expect(screen.getByRole('link', { name: '← Back to sessions' })).toBeInTheDocument();
    });

    it('renders the diff view toggle', () => {
      renderPage();

      expect(screen.getByRole('group', { name: 'Diff view mode' })).toBeInTheDocument();
    });

    it('renders the review action buttons for pending status', () => {
      renderPage();

      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Request Changes' })).toBeInTheDocument();
    });

    it('renders the "No changes to review" message when diff is null', () => {
      mockUseDiff.mockReturnValue({ diff: null, loading: false, error: null });

      renderPage();

      expect(screen.getByText('No changes to review.')).toBeInTheDocument();
    });

    it('renders the diff loading indicator while diff is being fetched', () => {
      mockUseDiff.mockReturnValue({ diff: null, loading: true, error: null });

      renderPage();

      expect(screen.getByText('Loading diff...')).toBeInTheDocument();
    });

    it('renders a diff error message when the diff fetch fails', () => {
      mockUseDiff.mockReturnValue({ diff: null, loading: false, error: 'Diff too large' });

      renderPage();

      expect(screen.getByText('Error loading diff: Diff too large')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // File tree
  // -------------------------------------------------------------------------

  describe('file tree', () => {
    it('renders the file tree sidebar when files are present', () => {
      renderPage();

      expect(screen.getByRole('navigation', { name: 'Changed files' })).toBeInTheDocument();
    });

    it('does not render the sidebar when no files are available', () => {
      mockUseFiles.mockReturnValue({ files: [], loading: false, error: null });

      renderPage();

      expect(screen.queryByRole('navigation', { name: 'Changed files' })).toBeNull();
    });

    it('renders a button for each file in the tree', () => {
      renderPage();

      expect(screen.getByTitle('src/auth.ts')).toBeInTheDocument();
      expect(screen.getByTitle('src/utils.ts')).toBeInTheDocument();
    });

    it('clicking a file button marks it as active', () => {
      renderPage();

      const authFileButton = screen.getByTitle('src/auth.ts');
      fireEvent.click(authFileButton);

      expect(authFileButton).toHaveAttribute('aria-current', 'true');
    });
  });

  // -------------------------------------------------------------------------
  // Review status actions
  // -------------------------------------------------------------------------

  describe('review status actions', () => {
    it('calls updateStatus with "approved" when Approve is clicked', async () => {
      mockUpdateStatus.mockResolvedValue(undefined);

      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith('approved');
      });
    });

    it('calls updateStatus with "changes_requested" when Request Changes is clicked', async () => {
      mockUpdateStatus.mockResolvedValue(undefined);

      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Request Changes' }));

      await waitFor(() => {
        expect(mockUpdateStatus).toHaveBeenCalledWith('changes_requested');
      });
    });

    it('disables the action buttons while a status update is in-flight', async () => {
      // Never-resolving promise simulates an in-flight request.
      mockUpdateStatus.mockReturnValue(new Promise(() => undefined));

      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Approve' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Request Changes' })).toBeDisabled();
      });
    });

    it('re-enables the action buttons after the status update completes', async () => {
      mockUpdateStatus.mockResolvedValue(undefined);

      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Approve' })).not.toBeDisabled();
      });
    });

    it('renders Approve and Revert to Pending buttons when status is changes_requested', () => {
      mockUseReviewSession.mockReturnValue({
        session: {
          ...SAMPLE_SESSION,
          session: { ...SAMPLE_SESSION.session, status: 'changes_requested' },
        },
        loading: false,
        error: null,
        updateStatus: mockUpdateStatus,
        addComment: mockAddComment,
        resolveComment: mockResolveComment,
      });

      renderPage();

      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Revert to Pending' })).toBeInTheDocument();
    });

    it('renders Request Changes and Revert to Pending buttons when status is approved', () => {
      mockUseReviewSession.mockReturnValue({
        session: {
          ...SAMPLE_SESSION,
          session: { ...SAMPLE_SESSION.session, status: 'approved' },
        },
        loading: false,
        error: null,
        updateStatus: mockUpdateStatus,
        addComment: mockAddComment,
        resolveComment: mockResolveComment,
      });

      renderPage();

      expect(screen.getByRole('button', { name: 'Request Changes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Revert to Pending' })).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Diff view mode toggle
  // -------------------------------------------------------------------------

  describe('diff view mode toggle', () => {
    it('renders the "Line by line" button as active by default', () => {
      renderPage();

      const lineByLineBtn = screen.getByRole('button', { name: 'Line by line' });
      expect(lineByLineBtn).toHaveAttribute('aria-pressed', 'true');
    });

    it('switches to side-by-side mode when the "Side by side" button is clicked', () => {
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Side by side' }));

      expect(screen.getByRole('button', { name: 'Side by side' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Line by line' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('switches back to line-by-line mode when "Line by line" is clicked again', () => {
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Side by side' }));
      fireEvent.click(screen.getByRole('button', { name: 'Line by line' }));

      expect(screen.getByRole('button', { name: 'Line by line' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Keyboard shortcuts
  // -------------------------------------------------------------------------

  describe('keyboard shortcuts', () => {
    it('passes the registered shortcut descriptors to useKeyboardShortcuts', () => {
      renderPage();

      const [shortcuts] = getShortcutCall();
      const keys = shortcuts.map((s) => s.key);

      expect(keys).toContain('n');
      expect(keys).toContain('p');
      expect(keys).toContain('j');
      expect(keys).toContain('k');
      expect(keys).toContain('c');
      expect(keys).toContain('Escape');
      expect(keys).toContain('?');
    });

    it('enables shortcuts when the help modal is closed', () => {
      renderPage();

      const [, enabled] = getShortcutCall();
      expect(enabled).toBe(true);
    });

    it('disables shortcuts while the help modal is open', () => {
      renderPage();

      // Invoke the '?' handler directly (the hook is mocked so no real keydown listener exists).
      const [shortcuts] = getShortcutCall();
      const helpShortcut = shortcuts.find((s) => s.key === '?');
      act(() => {
        helpShortcut?.handler();
      });

      // After opening the modal, the component re-renders and calls useKeyboardShortcuts
      // with enabled=false so that keys pressed while reading the modal are suppressed.
      const [, lastEnabled] = getLastShortcutCall();
      expect(lastEnabled).toBe(false);
    });

    it('the "?" shortcut handler opens the shortcuts help modal', () => {
      renderPage();

      const [shortcuts] = getShortcutCall();
      const helpShortcut = shortcuts.find((s) => s.key === '?');
      expect(helpShortcut).toBeDefined();

      act(() => {
        helpShortcut?.handler();
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Comments: summary bar
  // -------------------------------------------------------------------------

  describe('comment summary bar', () => {
    it('renders the comment summary bar with zero comments', () => {
      renderPage();

      expect(screen.getByText('0')).toBeInTheDocument();
    });

    it('renders unresolved comment count when there are unresolved comments', () => {
      mockUseReviewSession.mockReturnValue({
        session: {
          ...SAMPLE_SESSION,
          comments: [
            {
              id: 'c1',
              file: 'src/auth.ts',
              line: 2,
              side: 'right',
              body: 'Needs a test.',
              author: 'reviewer',
              createdAt: '2026-03-25T10:00:00Z',
              resolved: false,
            },
            {
              id: 'c2',
              file: 'src/auth.ts',
              line: 3,
              side: 'right',
              body: 'Already handled.',
              author: 'reviewer',
              createdAt: '2026-03-25T10:00:00Z',
              resolved: true,
            },
          ],
        },
        loading: false,
        error: null,
        updateStatus: mockUpdateStatus,
        addComment: mockAddComment,
        resolveComment: mockResolveComment,
      });

      renderPage();

      expect(screen.getByText('unresolved')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Comment resolve / unresolve
  // -------------------------------------------------------------------------

  describe('resolve and unresolve comments', () => {
    it('calls resolveComment with resolved=true when the Resolve button is clicked', async () => {
      mockResolveComment.mockResolvedValue(undefined);

      mockUseReviewSession.mockReturnValue({
        session: {
          ...SAMPLE_SESSION,
          comments: [
            {
              id: 'comment-1',
              file: 'src/auth.ts',
              line: 2,
              side: 'right' as const,
              body: 'Fix this.',
              author: 'reviewer',
              createdAt: '2026-03-25T10:00:00Z',
              resolved: false,
            },
          ],
        },
        loading: false,
        error: null,
        updateStatus: mockUpdateStatus,
        addComment: mockAddComment,
        resolveComment: mockResolveComment,
      });

      renderPage();

      // The DiffView stub renders renderAfterLine for line 2 of src/auth.ts —
      // that matches our comment, so CommentThread should be in the DOM.
      const resolveBtn = await screen.findByRole('button', { name: 'Resolve' });
      fireEvent.click(resolveBtn);

      await waitFor(() => {
        expect(mockResolveComment).toHaveBeenCalledWith('comment-1', true);
      });
    });

    it('calls resolveComment with resolved=false when the Unresolve button is clicked', async () => {
      mockResolveComment.mockResolvedValue(undefined);

      mockUseReviewSession.mockReturnValue({
        session: {
          ...SAMPLE_SESSION,
          comments: [
            {
              id: 'comment-2',
              file: 'src/auth.ts',
              line: 2,
              side: 'right' as const,
              body: 'Already handled.',
              author: 'reviewer',
              createdAt: '2026-03-25T10:00:00Z',
              resolved: true,
            },
          ],
        },
        loading: false,
        error: null,
        updateStatus: mockUpdateStatus,
        addComment: mockAddComment,
        resolveComment: mockResolveComment,
      });

      renderPage();

      const unresolveBtn = await screen.findByRole('button', { name: 'Unresolve' });
      fireEvent.click(unresolveBtn);

      await waitFor(() => {
        expect(mockResolveComment).toHaveBeenCalledWith('comment-2', false);
      });
    });
  });

  // -------------------------------------------------------------------------
  // Inline comment form
  // -------------------------------------------------------------------------

  describe('inline comment form', () => {
    it('shows the comment form when a diff line is clicked', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('diff-line'));

      expect(screen.getByPlaceholderText(/Leave a comment/)).toBeInTheDocument();
    });

    it('hides the comment form when the same line is clicked again (toggle)', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('diff-line'));
      fireEvent.click(screen.getByTestId('diff-line'));

      expect(screen.queryByPlaceholderText(/Leave a comment/)).toBeNull();
    });

    it('hides the comment form when Cancel is clicked', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('diff-line'));
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.queryByPlaceholderText(/Leave a comment/)).toBeNull();
    });

    it('calls addComment and closes the form on submit', async () => {
      mockAddComment.mockResolvedValue({
        id: 'new-comment',
        file: 'src/auth.ts',
        line: 2,
        side: 'right',
        body: 'Great change.',
        author: 'reviewer',
        createdAt: '2026-03-25T10:00:00Z',
        resolved: false,
      });

      renderPage();

      fireEvent.click(screen.getByTestId('diff-line'));

      const textarea = screen.getByPlaceholderText(/Leave a comment/);
      fireEvent.change(textarea, { target: { value: 'Great change.' } });
      fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

      await waitFor(() => {
        expect(mockAddComment).toHaveBeenCalledWith(
          expect.objectContaining({
            file: 'src/auth.ts',
            line: 2,
            side: 'right',
            body: 'Great change.',
            author: 'reviewer',
          }),
        );
      });

      expect(screen.queryByPlaceholderText(/Leave a comment/)).toBeNull();
    });

    it('does not submit when the comment body is empty', () => {
      renderPage();

      fireEvent.click(screen.getByTestId('diff-line'));

      const submitBtn = screen.getByRole('button', { name: 'Submit' });
      expect(submitBtn).toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // useReviewSession integration
  // -------------------------------------------------------------------------

  describe('useReviewSession integration', () => {
    it('calls useReviewSession with the commitSha from the URL params', () => {
      renderPage('abc123');

      expect(mockUseReviewSession).toHaveBeenCalledWith('abc123');
    });

    it('passes null to useFiles when reviewData is null', () => {
      mockUseReviewSession.mockReturnValue({
        session: null,
        loading: false,
        error: null,
        updateStatus: mockUpdateStatus,
        addComment: mockAddComment,
        resolveComment: mockResolveComment,
      });

      renderPage();

      expect(mockUseFiles).toHaveBeenCalledWith(null);
    });

    it('passes baseRef and headRef to useFiles when session data is available', () => {
      renderPage();

      expect(mockUseFiles).toHaveBeenCalledWith({ base: 'main', head: 'feature/auth' });
    });
  });

  // -------------------------------------------------------------------------
  // ShortcutsHelpModal
  // -------------------------------------------------------------------------

  describe('shortcuts help modal', () => {
    it('does not render the help modal dialog on initial render', () => {
      renderPage();

      expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('renders the help modal when handleToggleHelp is invoked via the "?" shortcut', () => {
      renderPage();

      const shortcuts = getShortcutCall()[0];
      const helpShortcut = shortcuts.find((s) => s.key === '?');
      act(() => {
        helpShortcut?.handler();
      });

      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('renders shortcut descriptions inside the help modal', () => {
      renderPage();

      const shortcuts = getShortcutCall()[0];
      const helpShortcut = shortcuts.find((s) => s.key === '?');
      act(() => {
        helpShortcut?.handler();
      });

      expect(screen.getByText('Focus next file')).toBeInTheDocument();
    });
  });
});
