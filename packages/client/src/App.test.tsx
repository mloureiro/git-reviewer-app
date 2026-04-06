import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { App } from './App';
import type { ReviewData } from './types/review';

// Mock the useSessions hook so we can control each state in isolation.
vi.mock('./hooks/useSessions');

import { useSessions } from './hooks/useSessions';

const mockUseSessions = vi.mocked(useSessions);

const sampleSession: ReviewData = {
  version: 1,
  session: {
    id: 'session-1',
    title: 'Review AI-generated auth changes',
    baseRef: 'main',
    headRef: 'feature/auth',
    baseCommit: 'abc123',
    headCommit: 'def456',
    status: 'pending',
    createdAt: '2026-03-25T10:00:00Z',
    updatedAt: '2026-03-25T11:00:00Z',
  },
  comments: [],
};

function renderApp(initialPath = '/') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <App />
    </MemoryRouter>,
  );
}

describe('App', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows a loading indicator while sessions are being fetched', () => {
    mockUseSessions.mockReturnValue({
      sessions: null,
      loading: true,
      error: null,
      health: {},
      refetch: vi.fn(),
    });

    renderApp();

    expect(screen.getByText('Loading reviews...')).toBeInTheDocument();
  });

  it('shows an error message when the API call fails', () => {
    mockUseSessions.mockReturnValue({
      sessions: null,
      loading: false,
      error: 'Network error',
      health: {},
      refetch: vi.fn(),
    });

    renderApp();

    expect(screen.getByText('Error: Network error')).toBeInTheDocument();
  });

  it('shows an empty state message when there are no sessions', () => {
    mockUseSessions.mockReturnValue({
      sessions: [],
      loading: false,
      error: null,
      health: {},
      refetch: vi.fn(),
    });

    renderApp();

    expect(screen.getByText('No review sessions yet.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Create your first review' })).toBeInTheDocument();
  });

  it('renders the session list when sessions are available', () => {
    mockUseSessions.mockReturnValue({
      sessions: [sampleSession],
      loading: false,
      error: null,
      health: {},
      refetch: vi.fn(),
    });

    renderApp();

    expect(screen.getByText('Review Sessions')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Review AI-generated auth changes' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });
});
