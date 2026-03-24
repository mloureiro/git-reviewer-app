import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSession } from './useSession';
import * as reviewsApi from '../api/reviews';
import type { ReviewData } from '../types/review';

vi.mock('../api/reviews');

const mockFetchSession = vi.mocked(reviewsApi.fetchSession);
const mockUpdateSessionStatus = vi.mocked(reviewsApi.updateSessionStatus);

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const baseSession: ReviewData = {
  version: 1,
  session: {
    id: 'session-1',
    title: 'Test Review',
    baseRef: 'main',
    headRef: 'feature',
    baseCommit: 'abc123',
    headCommit: 'def456',
    status: 'pending',
    createdAt: '2026-03-19T00:00:00Z',
    updatedAt: '2026-03-19T00:00:00Z',
  },
  comments: [],
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // -------------------------------------------------------------------------
  // Initial loading state
  // -------------------------------------------------------------------------

  it('returns loading=true initially', () => {
    mockFetchSession.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useSession('def456'));

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  // -------------------------------------------------------------------------
  // Successful fetch
  // -------------------------------------------------------------------------

  it('returns session data on success', async () => {
    mockFetchSession.mockResolvedValue(baseSession);

    const { result } = renderHook(() => useSession('def456'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(baseSession);
    expect(result.current.error).toBeNull();
  });

  it('calls fetchSession with the provided commitSha', async () => {
    mockFetchSession.mockResolvedValue(baseSession);

    renderHook(() => useSession('def456'));

    await waitFor(() => expect(mockFetchSession).toHaveBeenCalledWith('def456'));
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  it('returns error message on failure', async () => {
    mockFetchSession.mockRejectedValue(new Error('Session not found'));

    const { result } = renderHook(() => useSession('def456'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe('Session not found');
  });

  it('handles non-Error rejections gracefully', async () => {
    mockFetchSession.mockRejectedValue('unexpected');

    const { result } = renderHook(() => useSession('def456'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to fetch session');
  });

  // -------------------------------------------------------------------------
  // Re-fetch on commitSha change
  // -------------------------------------------------------------------------

  it('re-fetches when commitSha changes', async () => {
    const secondSession: ReviewData = {
      ...baseSession,
      session: { ...baseSession.session, headCommit: 'aaa111' },
    };

    mockFetchSession.mockResolvedValueOnce(baseSession);
    mockFetchSession.mockResolvedValueOnce(secondSession);

    const { result, rerender } = renderHook((sha) => useSession(sha), {
      initialProps: 'def456',
    });

    await waitFor(() => expect(result.current.data).toEqual(baseSession));

    rerender('aaa111');

    await waitFor(() => expect(result.current.data).toEqual(secondSession));

    expect(mockFetchSession).toHaveBeenCalledTimes(2);
    expect(mockFetchSession).toHaveBeenNthCalledWith(1, 'def456');
    expect(mockFetchSession).toHaveBeenNthCalledWith(2, 'aaa111');
  });

  it('sets loading=true again while re-fetching', async () => {
    let resolveSecond!: (value: ReviewData) => void;
    const secondPromise = new Promise<ReviewData>((resolve) => {
      resolveSecond = resolve;
    });

    mockFetchSession.mockResolvedValueOnce(baseSession);
    mockFetchSession.mockReturnValueOnce(secondPromise);

    const { result, rerender } = renderHook((sha) => useSession(sha), {
      initialProps: 'def456',
    });

    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender('aaa111');

    expect(result.current.loading).toBe(true);

    // Resolve to clean up pending promise
    await act(async () => {
      resolveSecond(baseSession);
    });
  });

  // -------------------------------------------------------------------------
  // updateStatus mutation
  // -------------------------------------------------------------------------

  it('updateStatus updates session.session after API response', async () => {
    const updatedMeta = { ...baseSession.session, status: 'approved' as const };
    mockFetchSession.mockResolvedValue(baseSession);
    mockUpdateSessionStatus.mockResolvedValue(updatedMeta);

    const { result } = renderHook(() => useSession('def456'));
    await waitFor(() => expect(result.current.data).toEqual(baseSession));

    await act(async () => {
      await result.current.updateStatus('approved');
    });

    expect(result.current.data?.session.status).toBe('approved');
  });

  it('updateStatus calls updateSessionStatus with commitSha and status', async () => {
    const updatedMeta = { ...baseSession.session, status: 'changes_requested' as const };
    mockFetchSession.mockResolvedValue(baseSession);
    mockUpdateSessionStatus.mockResolvedValue(updatedMeta);

    const { result } = renderHook(() => useSession('def456'));
    await waitFor(() => expect(result.current.data).toEqual(baseSession));

    await act(async () => {
      await result.current.updateStatus('changes_requested');
    });

    expect(mockUpdateSessionStatus).toHaveBeenCalledOnce();
    expect(mockUpdateSessionStatus).toHaveBeenCalledWith('def456', { status: 'changes_requested' });
  });

  it('updateStatus preserves the existing comments array', async () => {
    const sessionWithComments: ReviewData = {
      ...baseSession,
      comments: [
        {
          id: 'comment-1',
          file: 'src/index.ts',
          line: 10,
          side: 'right',
          body: 'Looks good',
          author: 'marcos',
          createdAt: '2026-03-19T01:00:00Z',
          resolved: false,
        },
      ],
    };
    const updatedMeta = { ...baseSession.session, status: 'approved' as const };
    mockFetchSession.mockResolvedValue(sessionWithComments);
    mockUpdateSessionStatus.mockResolvedValue(updatedMeta);

    const { result } = renderHook(() => useSession('def456'));
    await waitFor(() => expect(result.current.data).toEqual(sessionWithComments));

    await act(async () => {
      await result.current.updateStatus('approved');
    });

    expect(result.current.data?.comments).toHaveLength(1);
    expect(result.current.data?.comments[0]?.id).toBe('comment-1');
  });

  it('updateStatus does not modify data when data is null', async () => {
    mockFetchSession.mockRejectedValue(new Error('Not found'));
    const updatedMeta = { ...baseSession.session, status: 'approved' as const };
    mockUpdateSessionStatus.mockResolvedValue(updatedMeta);

    const { result } = renderHook(() => useSession('def456'));
    await waitFor(() => expect(result.current.loading).toBe(false));

    // data is null due to fetch error
    await act(async () => {
      await result.current.updateStatus('approved');
    });

    expect(result.current.data).toBeNull();
  });
});
