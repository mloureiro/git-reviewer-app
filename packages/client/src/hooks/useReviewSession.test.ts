import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReviewSession } from './useReviewSession';
import * as reviewsApi from '../api/reviews';
import type { ReviewData, ReviewComment } from '../types/review';

vi.mock('../api/reviews');

const mockFetchSession = vi.mocked(reviewsApi.fetchSession);
const mockUpdateSessionStatus = vi.mocked(reviewsApi.updateSessionStatus);
const mockPostComment = vi.mocked(reviewsApi.postComment);
const mockPatchComment = vi.mocked(reviewsApi.patchComment);

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

const baseComment: ReviewComment = {
  id: 'comment-1',
  file: 'src/index.ts',
  line: 10,
  side: 'right',
  body: 'Looks good',
  author: 'marcos',
  createdAt: '2026-03-19T01:00:00Z',
  resolved: false,
};

describe('useReviewSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns loading=true initially', () => {
    mockFetchSession.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useReviewSession('def456'));

    expect(result.current.loading).toBe(true);
    expect(result.current.session).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns session data on success', async () => {
    mockFetchSession.mockResolvedValue(baseSession);

    const { result } = renderHook(() => useReviewSession('def456'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.session).toEqual(baseSession);
    expect(result.current.error).toBeNull();
  });

  it('returns error message on failure', async () => {
    mockFetchSession.mockRejectedValue(new Error('Session not found'));

    const { result } = renderHook(() => useReviewSession('def456'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.session).toBeNull();
    expect(result.current.error).toBe('Session not found');
  });

  it('re-fetches when commitSha changes', async () => {
    const secondSession: ReviewData = {
      ...baseSession,
      session: { ...baseSession.session, headCommit: 'aaa111' },
    };

    mockFetchSession.mockResolvedValueOnce(baseSession);
    mockFetchSession.mockResolvedValueOnce(secondSession);

    const { result, rerender } = renderHook((sha) => useReviewSession(sha), {
      initialProps: 'def456',
    });

    await waitFor(() => expect(result.current.session).toEqual(baseSession));

    rerender('aaa111');

    await waitFor(() => expect(result.current.session).toEqual(secondSession));

    expect(mockFetchSession).toHaveBeenCalledTimes(2);
  });

  it('updateStatus updates session state after API response', async () => {
    const updatedSessionMeta = { ...baseSession.session, status: 'approved' as const };
    mockFetchSession.mockResolvedValue(baseSession);
    mockUpdateSessionStatus.mockResolvedValue(updatedSessionMeta);

    const { result } = renderHook(() => useReviewSession('def456'));
    await waitFor(() => expect(result.current.session).toEqual(baseSession));

    await act(async () => {
      await result.current.updateStatus('approved');
    });

    expect(result.current.session?.session.status).toBe('approved');
    expect(mockUpdateSessionStatus).toHaveBeenCalledWith(
      'def456',
      { status: 'approved' },
      undefined,
    );
  });

  it('addComment appends new comment to session state', async () => {
    mockFetchSession.mockResolvedValue(baseSession);
    mockPostComment.mockResolvedValue(baseComment);

    const { result } = renderHook(() => useReviewSession('def456'));
    await waitFor(() => expect(result.current.session).toEqual(baseSession));

    let returned: ReviewComment | undefined;
    await act(async () => {
      returned = await result.current.addComment({
        file: 'src/index.ts',
        line: 10,
        side: 'right',
        body: 'Looks good',
        author: 'marcos',
      });
    });

    expect(returned).toEqual(baseComment);
    expect(result.current.session?.comments).toHaveLength(1);
    expect(result.current.session?.comments[0]).toEqual(baseComment);
  });

  it('resolveComment updates the specific comment in state', async () => {
    const sessionWithComment: ReviewData = { ...baseSession, comments: [baseComment] };
    const resolvedComment: ReviewComment = { ...baseComment, resolved: true };

    mockFetchSession.mockResolvedValue(sessionWithComment);
    mockPatchComment.mockResolvedValue(resolvedComment);

    const { result } = renderHook(() => useReviewSession('def456'));
    await waitFor(() => expect(result.current.session).toEqual(sessionWithComment));

    await act(async () => {
      await result.current.resolveComment('comment-1', true);
    });

    expect(result.current.session?.comments[0]?.resolved).toBe(true);
    expect(mockPatchComment).toHaveBeenCalledWith(
      'def456',
      'comment-1',
      { resolved: true },
      undefined,
    );
  });

  it('handles non-Error rejections gracefully', async () => {
    mockFetchSession.mockRejectedValue('unexpected');

    const { result } = renderHook(() => useReviewSession('def456'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to fetch review session');
  });
});
