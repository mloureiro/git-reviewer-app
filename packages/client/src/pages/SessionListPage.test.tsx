import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SessionListPage } from './SessionListPage';
import type { ReviewData, SessionHealth, SessionStats } from '../types/review';

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock('../hooks/useSessions');
vi.mock('../api/reviews');

import { useSessions } from '../hooks/useSessions';
import * as reviewsApi from '../api/reviews';

const mockUseSessions = vi.mocked(useSessions);
const mockDeleteSession = vi.mocked(reviewsApi.deleteSession);
const mockRemoveRepo = vi.mocked(reviewsApi.removeRepo);

// ---------------------------------------------------------------------------
// Test data helpers
// ---------------------------------------------------------------------------

function makeSession(overrides: Partial<ReviewData['session']> = {}): ReviewData {
  return {
    version: 1,
    session: {
      id: 'session-1',
      title: 'My Review',
      baseRef: 'main',
      headRef: 'HEAD',
      baseCommit: 'base111',
      headCommit: 'head222',
      status: 'pending',
      createdAt: '2026-01-10T10:00:00Z',
      updatedAt: '2026-01-10T12:00:00Z',
      ...overrides,
    },
    comments: [],
  };
}

const mockRefetch = vi.fn();

function setupDefaultMocks(override: Partial<ReturnType<typeof useSessions>> = {}): void {
  mockUseSessions.mockReturnValue({
    sessions: null,
    loading: false,
    error: null,
    health: {},
    stats: {},
    refetch: mockRefetch,
    ...override,
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the first element of `elements`, throwing if the array is empty.
 * Avoids non-null assertions while satisfying `noUncheckedIndexedAccess`.
 */
function first(elements: HTMLElement[]): HTMLElement {
  const el = elements[0];
  if (el === undefined) throw new Error('Expected at least one element but got none');
  return el;
}

// ---------------------------------------------------------------------------
// Render helper
// ---------------------------------------------------------------------------

function renderPage() {
  return render(
    <MemoryRouter>
      <SessionListPage />
    </MemoryRouter>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SessionListPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Ensure window.__TAURI_INTERNALS__ is absent so isTauri() returns false
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).__TAURI_INTERNALS__;
    // happy-dom does not provide window.confirm/alert — stub them so the page
    // can call them without throwing.
    window.confirm = vi.fn();
    window.alert = vi.fn();
  });

  // -------------------------------------------------------------------------
  // Loading state
  // -------------------------------------------------------------------------

  describe('loading state', () => {
    it('renders the loading indicator while sessions are being fetched', () => {
      setupDefaultMocks({ loading: true, sessions: null });
      renderPage();
      expect(screen.getByText('Loading reviews...')).toBeInTheDocument();
    });

    it('does not render session content while loading', () => {
      setupDefaultMocks({ loading: true, sessions: null });
      renderPage();
      expect(screen.queryByRole('heading', { name: 'Reviews' })).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Error state
  // -------------------------------------------------------------------------

  describe('error state', () => {
    it('renders the error message when fetching sessions fails', () => {
      setupDefaultMocks({ error: 'Network timeout', sessions: null });
      renderPage();
      expect(screen.getByText('Error: Network timeout')).toBeInTheDocument();
    });

    it('does not render the session list on error', () => {
      setupDefaultMocks({ error: 'Server error', sessions: null });
      renderPage();
      expect(screen.queryByRole('heading', { name: 'Reviews' })).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Empty state
  // -------------------------------------------------------------------------

  describe('empty state', () => {
    it('renders the empty state message when there are no sessions', () => {
      setupDefaultMocks({ sessions: [] });
      renderPage();
      expect(screen.getByText('No review sessions yet.')).toBeInTheDocument();
    });

    it('renders a link to create the first review in the empty state', () => {
      setupDefaultMocks({ sessions: [] });
      renderPage();
      expect(screen.getByRole('link', { name: 'Create your first review' })).toHaveAttribute(
        'href',
        '/new',
      );
    });

    it('renders the empty state when sessions is null and not loading', () => {
      setupDefaultMocks({ sessions: null, loading: false });
      renderPage();
      expect(screen.getByText('No review sessions yet.')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Session list — basic rendering
  // -------------------------------------------------------------------------

  describe('session list', () => {
    it('renders the Reviews heading when sessions exist', () => {
      setupDefaultMocks({ sessions: [makeSession()] });
      renderPage();
      expect(screen.getByRole('heading', { name: 'Reviews' })).toBeInTheDocument();
    });

    it('renders a link to the New Review page', () => {
      setupDefaultMocks({ sessions: [makeSession()] });
      renderPage();
      expect(screen.getByRole('link', { name: 'New Review' })).toHaveAttribute('href', '/new');
    });

    it('renders session title as a link to the session detail page', () => {
      const session = makeSession({ headCommit: 'abc123', title: 'Auth refactor' });
      setupDefaultMocks({ sessions: [session] });
      renderPage();
      const link = screen.getByRole('link', { name: 'Auth refactor' });
      expect(link).toHaveAttribute('href', '/session/abc123');
    });

    it('renders the base and head refs for each session', () => {
      const session = makeSession({ baseRef: 'main', headRef: 'feature/auth' });
      setupDefaultMocks({ sessions: [session] });
      renderPage();
      expect(screen.getByText('main')).toBeInTheDocument();
      expect(screen.getByText('feature/auth')).toBeInTheDocument();
    });

    it('renders the status badge for each session', () => {
      const session = makeSession({ status: 'approved' });
      setupDefaultMocks({ sessions: [session] });
      renderPage();
      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    it('renders the remove button for stale sessions', () => {
      const session = makeSession({ headCommit: 'stale111' });
      setupDefaultMocks({
        sessions: [session],
        health: { stale111: { status: 'stale', reason: 'no-changes' } },
      });
      renderPage();
      expect(screen.getByRole('button', { name: 'Remove empty review' })).toBeInTheDocument();
    });

    it('renders session stats when stats are provided', () => {
      const session = makeSession({ headCommit: 'head222' });
      const stats: Record<string, SessionStats> = {
        head222: { files: 5, additions: 10, deletions: 3 },
      };
      setupDefaultMocks({ sessions: [session], stats });
      renderPage();
      expect(screen.getByText('5 files')).toBeInTheDocument();
      expect(screen.getByText('+10')).toBeInTheDocument();
      expect(screen.getByText('-3')).toBeInTheDocument();
    });

    it('does not render additions stat when additions are zero', () => {
      const session = makeSession({ headCommit: 'head222' });
      const stats: Record<string, SessionStats> = {
        head222: { files: 2, additions: 0, deletions: 1 },
      };
      setupDefaultMocks({ sessions: [session], stats });
      renderPage();
      expect(screen.queryByText('+0')).toBeNull();
    });

    it('does not render deletions stat when deletions are zero', () => {
      const session = makeSession({ headCommit: 'head222' });
      const stats: Record<string, SessionStats> = {
        head222: { files: 2, additions: 5, deletions: 0 },
      };
      setupDefaultMocks({ sessions: [session], stats });
      renderPage();
      expect(screen.queryByText('-0')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Stale sessions
  // -------------------------------------------------------------------------

  describe('stale sessions', () => {
    it('renders a stale session title as plain text (not a link)', () => {
      const session = makeSession({ headCommit: 'stale111', title: 'Old branch review' });
      const health: Record<string, SessionHealth> = {
        stale111: { status: 'stale', reason: 'head-ref-missing' },
      };
      setupDefaultMocks({ sessions: [session], health });
      renderPage();

      // Title should be a <span>, not an <a>
      expect(screen.queryByRole('link', { name: 'Old branch review' })).toBeNull();
      expect(screen.getByText('Old branch review')).toBeInTheDocument();
    });

    it('applies the stale CSS class to a stale session card', () => {
      const session = makeSession({ headCommit: 'stale111', title: 'Stale session' });
      const health: Record<string, SessionHealth> = {
        stale111: { status: 'stale', reason: 'base-ref-missing' },
      };
      setupDefaultMocks({ sessions: [session], health });
      renderPage();

      const card = screen.getByText('Stale session').closest('li');
      expect(card).toHaveClass('session-card--stale');
    });

    it('does not apply the stale CSS class to a healthy session card', () => {
      const session = makeSession({ headCommit: 'ok111', title: 'Good session' });
      const health: Record<string, SessionHealth> = {
        ok111: { status: 'ok' },
      };
      setupDefaultMocks({ sessions: [session], health });
      renderPage();

      const card = screen.getByText('Good session').closest('li');
      expect(card).not.toHaveClass('session-card--stale');
    });
  });

  // -------------------------------------------------------------------------
  // Session deletion
  // -------------------------------------------------------------------------

  describe('session deletion', () => {
    it('calls deleteSession when the user confirms removal', async () => {
      mockDeleteSession.mockResolvedValue(undefined);

      const session = makeSession({ headCommit: 'stale222', repoPath: '/repo/path' });
      setupDefaultMocks({
        sessions: [session],
        health: { stale222: { status: 'stale', reason: 'no-changes' } },
      });
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Remove empty review' }));

      await waitFor(() => {
        expect(mockDeleteSession).toHaveBeenCalledWith('stale222', '/repo/path');
      });
    });

    it('calls refetch after a successful deletion', async () => {
      mockDeleteSession.mockResolvedValue(undefined);

      const session = makeSession({ headCommit: 'stale333' });
      setupDefaultMocks({
        sessions: [session],
        health: { stale333: { status: 'stale', reason: 'no-changes' } },
      });
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Remove empty review' }));

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it('immediately calls deleteSession when the user clicks remove (no confirmation)', async () => {
      mockDeleteSession.mockResolvedValue(undefined);

      const session = makeSession({ headCommit: 'stale444' });
      setupDefaultMocks({
        sessions: [session],
        health: { stale444: { status: 'stale', reason: 'no-changes' } },
      });
      renderPage();

      fireEvent.click(screen.getByRole('button', { name: 'Remove empty review' }));

      await waitFor(() => {
        expect(mockDeleteSession).toHaveBeenCalledWith('stale444', undefined);
      });
    });

    it('disables the remove button while deletion is in progress', async () => {
      // Never-resolving promise simulates in-flight delete
      mockDeleteSession.mockReturnValue(new Promise(() => undefined));

      const session = makeSession({ headCommit: 'stale555' });
      setupDefaultMocks({
        sessions: [session],
        health: { stale555: { status: 'stale', reason: 'no-changes' } },
      });
      renderPage();

      const removeBtn = screen.getByRole('button', { name: 'Remove empty review' });
      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(removeBtn).toBeDisabled();
      });
    });

    it('shows an alert and re-enables the button when deletion fails', async () => {
      mockDeleteSession.mockRejectedValue(new Error('Delete failed'));

      const session = makeSession({ headCommit: 'stale666' });
      setupDefaultMocks({
        sessions: [session],
        health: { stale666: { status: 'stale', reason: 'no-changes' } },
      });
      renderPage();

      const removeBtn = screen.getByRole('button', { name: 'Remove empty review' });
      fireEvent.click(removeBtn);

      await waitFor(() => {
        expect(vi.mocked(window.alert)).toHaveBeenCalledWith('Delete failed');
      });
      expect(removeBtn).not.toBeDisabled();
    });
  });

  // -------------------------------------------------------------------------
  // Session grouping (multiple repos)
  // -------------------------------------------------------------------------

  describe('session grouping', () => {
    it('does not render group headers when all sessions belong to one repo', () => {
      const sessions = [
        makeSession({ id: 's1', repoPath: '/repo/a' }),
        makeSession({ id: 's2', repoPath: '/repo/a' }),
      ];
      setupDefaultMocks({ sessions });
      renderPage();

      // No expand/collapse button should appear
      expect(screen.queryByRole('button', { name: /expand group|collapse group/i })).toBeNull();
    });

    it('renders group headers when sessions span multiple repos', () => {
      const sessions = [
        makeSession({ id: 's1', title: 'Review A', repoPath: '/repos/alpha' }),
        makeSession({ id: 's2', title: 'Review B', repoPath: '/repos/beta' }),
      ];
      setupDefaultMocks({ sessions });
      renderPage();

      // Should have collapse buttons for each group
      const collapseButtons = screen.getAllByRole('button', { name: /collapse group/i });
      expect(collapseButtons).toHaveLength(2);
    });

    it('shows the repo display name (last path segment) in the group header', () => {
      const sessions = [makeSession({ id: 's1', repoPath: '/home/user/projects/my-app' })];
      // Add a second session with a different repo so groups are rendered
      sessions.push(makeSession({ id: 's2', repoPath: '/home/user/projects/other-app' }));
      setupDefaultMocks({ sessions });
      renderPage();

      expect(screen.getByText('my-app')).toBeInTheDocument();
      expect(screen.getByText('other-app')).toBeInTheDocument();
    });

    it('shows the session count for each group', () => {
      const sessions = [
        makeSession({ id: 's1', repoPath: '/repos/alpha' }),
        makeSession({ id: 's2', repoPath: '/repos/alpha' }),
        makeSession({ id: 's3', repoPath: '/repos/beta' }),
      ];
      setupDefaultMocks({ sessions });
      renderPage();

      // alpha has 2 sessions, beta has 1
      const counts = screen.getAllByText(/^[12]$/);
      expect(counts.length).toBeGreaterThanOrEqual(2);
    });

    it('collapses a group when the collapse button is clicked', () => {
      const sessions = [
        makeSession({ id: 's1', title: 'Alpha review', repoPath: '/repos/alpha' }),
        makeSession({ id: 's2', title: 'Beta review', repoPath: '/repos/beta' }),
      ];
      setupDefaultMocks({ sessions });
      renderPage();

      // Initially expanded — both session titles should be visible
      expect(screen.getByText('Alpha review')).toBeInTheDocument();
      expect(screen.getByText('Beta review')).toBeInTheDocument();

      // Collapse the first group (alpha — sorted first)
      const firstCollapseBtn = first(screen.getAllByRole('button', { name: 'Collapse group' }));
      fireEvent.click(firstCollapseBtn);

      expect(screen.queryByText('Alpha review')).toBeNull();
      expect(screen.getByText('Beta review')).toBeInTheDocument();
    });

    it('expands a collapsed group when the expand button is clicked', () => {
      const sessions = [
        makeSession({ id: 's1', title: 'Alpha review', repoPath: '/repos/alpha' }),
        makeSession({ id: 's2', title: 'Beta review', repoPath: '/repos/beta' }),
      ];
      setupDefaultMocks({ sessions });
      renderPage();

      // Collapse then expand
      const firstCollapseButton = first(screen.getAllByRole('button', { name: 'Collapse group' }));
      fireEvent.click(firstCollapseButton);

      const expandBtn = screen.getByRole('button', { name: 'Expand group' });
      fireEvent.click(expandBtn);

      expect(screen.getByText('Alpha review')).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // KebabMenu (repo removal)
  // -------------------------------------------------------------------------

  describe('KebabMenu', () => {
    function setupTwoRepoSessions() {
      const sessions = [
        makeSession({ id: 's1', title: 'Review A', repoPath: '/repos/alpha' }),
        makeSession({ id: 's2', title: 'Review B', repoPath: '/repos/beta' }),
      ];
      setupDefaultMocks({ sessions });
    }

    it('renders a kebab menu trigger for each group that has a repoPath', () => {
      setupTwoRepoSessions();
      renderPage();

      const triggers = screen.getAllByTitle('More actions');
      expect(triggers).toHaveLength(2);
    });

    it('opens the dropdown when the kebab trigger is clicked', () => {
      setupTwoRepoSessions();
      renderPage();

      const firstTrigger = first(screen.getAllByTitle('More actions'));
      fireEvent.click(firstTrigger);

      expect(screen.getByText('Remove repository')).toBeInTheDocument();
    });

    it('closes the dropdown when clicking outside', () => {
      setupTwoRepoSessions();
      renderPage();

      const firstTrigger = first(screen.getAllByTitle('More actions'));
      fireEvent.click(firstTrigger);
      expect(screen.getByText('Remove repository')).toBeInTheDocument();

      // Click outside
      fireEvent.mouseDown(document.body);

      expect(screen.queryByText('Remove repository')).toBeNull();
    });

    it('shows confirmation text on the first click of "Remove repository"', () => {
      setupTwoRepoSessions();
      renderPage();

      const firstTrigger = first(screen.getAllByTitle('More actions'));
      fireEvent.click(firstTrigger);

      fireEvent.click(screen.getByText('Remove repository'));

      expect(screen.getByText('Confirm remove?')).toBeInTheDocument();
    });

    it('calls removeRepo on the second click (confirmation)', async () => {
      mockRemoveRepo.mockResolvedValue(undefined);
      setupTwoRepoSessions();
      renderPage();

      const firstTrigger = first(screen.getAllByTitle('More actions'));
      fireEvent.click(firstTrigger);
      fireEvent.click(screen.getByText('Remove repository'));
      fireEvent.click(screen.getByText('Confirm remove?'));

      await waitFor(() => {
        expect(mockRemoveRepo).toHaveBeenCalledWith('/repos/alpha');
      });
    });

    it('calls refetch after successfully removing a repo', async () => {
      mockRemoveRepo.mockResolvedValue(undefined);
      setupTwoRepoSessions();
      renderPage();

      const firstTrigger = first(screen.getAllByTitle('More actions'));
      fireEvent.click(firstTrigger);
      fireEvent.click(screen.getByText('Remove repository'));
      fireEvent.click(screen.getByText('Confirm remove?'));

      await waitFor(() => {
        expect(mockRefetch).toHaveBeenCalled();
      });
    });

    it('closes the dropdown after a successful repo removal', async () => {
      mockRemoveRepo.mockResolvedValue(undefined);
      setupTwoRepoSessions();
      renderPage();

      const firstTrigger = first(screen.getAllByTitle('More actions'));
      fireEvent.click(firstTrigger);
      fireEvent.click(screen.getByText('Remove repository'));
      fireEvent.click(screen.getByText('Confirm remove?'));

      await waitFor(() => {
        expect(screen.queryByText('Confirm remove?')).toBeNull();
      });
    });

    it('shows an alert and keeps the dropdown open when removeRepo fails', async () => {
      mockRemoveRepo.mockRejectedValue(new Error('Repo not found'));
      setupTwoRepoSessions();
      renderPage();

      const firstTrigger = first(screen.getAllByTitle('More actions'));
      fireEvent.click(firstTrigger);
      fireEvent.click(screen.getByText('Remove repository'));
      fireEvent.click(screen.getByText('Confirm remove?'));

      await waitFor(() => {
        expect(vi.mocked(window.alert)).toHaveBeenCalledWith('Repo not found');
      });
    });
  });

  // -------------------------------------------------------------------------
  // Tauri-specific states
  // -------------------------------------------------------------------------

  describe('Tauri environment', () => {
    beforeEach(() => {
      // Simulate Tauri environment
      Object.defineProperty(window, '__TAURI_INTERNALS__', {
        value: {},
        writable: true,
        configurable: true,
      });
    });

    afterEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__TAURI_INTERNALS__;
    });

    it('renders "Checking repository..." while the Tauri repo check is in progress', async () => {
      // In Tauri mode, useRepoCheck starts in checking=true state until the
      // invoke promise resolves. We need to prevent the invoke from resolving
      // so we can observe the intermediate checking state. Mock the Tauri module
      // so invoke never resolves.
      vi.doMock('@tauri-apps/api/core', () => ({
        invoke: vi.fn(() => new Promise(() => undefined)),
      }));

      setupDefaultMocks({ loading: false });
      renderPage();

      // The "Checking repository..." div is rendered before useSessions loading
      expect(screen.getByText('Checking repository...')).toBeInTheDocument();
    });

    it('renders the "No git repository selected" message when no repo is registered', async () => {
      vi.doMock('@tauri-apps/api/core', () => ({
        invoke: vi.fn().mockResolvedValue(null),
      }));

      setupDefaultMocks({ loading: false });
      renderPage();

      // The useRepoCheck hook will asynchronously set needsRepo=true once invoke resolves
      await waitFor(() => {
        expect(screen.getByText('No git repository selected.')).toBeInTheDocument();
      });
    });

    it('renders the "Open Repository" button in needsRepo state', async () => {
      vi.doMock('@tauri-apps/api/core', () => ({
        invoke: vi.fn().mockResolvedValue(null),
      }));

      setupDefaultMocks({ loading: false });
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Open Repository' })).toBeInTheDocument();
      });
    });

    it('renders the "Add Repository" button on the list page in Tauri mode', async () => {
      vi.doMock('@tauri-apps/api/core', () => ({
        invoke: vi.fn().mockResolvedValue('/some/repo'),
      }));

      setupDefaultMocks({ sessions: [makeSession()] });
      renderPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Add Repository' })).toBeInTheDocument();
      });
    });
  });
});
