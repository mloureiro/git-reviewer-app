import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SessionCreatePage } from './SessionCreatePage';
import * as reviewsApi from '../api/reviews';
import { ApiError } from '../api/client';
import type { ReviewData } from '../types/review';

vi.mock('../api/reviews');
// useNavigate needs a router — we wrap in MemoryRouter.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const mockCreateSession = vi.mocked(reviewsApi.createSession);

const sampleSession: ReviewData = {
  version: 1,
  session: {
    id: 'session-1',
    title: 'Test Review',
    baseRef: 'main',
    headRef: 'HEAD',
    baseCommit: 'base123',
    headCommit: 'head456',
    status: 'pending',
    createdAt: '2026-03-25T10:00:00Z',
    updatedAt: '2026-03-25T10:00:00Z',
  },
  comments: [],
};

function renderPage() {
  return render(
    <MemoryRouter>
      <SessionCreatePage />
    </MemoryRouter>,
  );
}

describe('SessionCreatePage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('renders the form with title, base ref, and head ref fields', () => {
    renderPage();

    expect(screen.getByLabelText('Title')).toBeInTheDocument();
    expect(screen.getByLabelText('Base Ref')).toBeInTheDocument();
    expect(screen.getByLabelText('Head Ref')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Review' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('submits the form and navigates to the new session on success', async () => {
    mockCreateSession.mockResolvedValue(sampleSession);

    renderPage();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'My Review' } });
    fireEvent.change(screen.getByLabelText('Base Ref'), { target: { value: 'main' } });
    fireEvent.change(screen.getByLabelText('Head Ref'), { target: { value: 'HEAD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Review' }));

    await waitFor(() => {
      expect(mockCreateSession).toHaveBeenCalledWith({
        title: 'My Review',
        baseRef: 'main',
        headRef: 'HEAD',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/session/head456');
    });
  });

  it('shows an ApiError message when session creation fails with ApiError', async () => {
    mockCreateSession.mockRejectedValue(new ApiError(400, { error: 'Invalid base ref' }));

    renderPage();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Base Ref'), { target: { value: 'bad-ref' } });
    fireEvent.change(screen.getByLabelText('Head Ref'), { target: { value: 'HEAD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Review' }));

    await waitFor(() => {
      expect(screen.getByText('Invalid base ref')).toBeInTheDocument();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a generic error message for unexpected errors', async () => {
    mockCreateSession.mockRejectedValue(new Error('Network failure'));

    renderPage();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Base Ref'), { target: { value: 'main' } });
    fireEvent.change(screen.getByLabelText('Head Ref'), { target: { value: 'HEAD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Review' }));

    await waitFor(() => {
      expect(
        screen.getByText('An unexpected error occurred. Please try again.'),
      ).toBeInTheDocument();
    });
  });

  it('disables the submit button while submitting', async () => {
    // Unresolved promise simulates in-flight request
    mockCreateSession.mockReturnValue(new Promise(() => undefined));

    renderPage();

    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Test' } });
    fireEvent.change(screen.getByLabelText('Base Ref'), { target: { value: 'main' } });
    fireEvent.change(screen.getByLabelText('Head Ref'), { target: { value: 'HEAD' } });
    fireEvent.click(screen.getByRole('button', { name: 'Create Review' }));

    await waitFor(() => {
      expect(screen.getByText('Creating…')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Creating…' })).toBeDisabled();
    });
  });
});
