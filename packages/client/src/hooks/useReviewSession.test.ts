import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReviewSession } from './useReviewSession';
import * as reviewsApi from '../api/reviews';
import type {
  ReviewData,
  ReviewComment,
  SessionResponse,
  UpdateSessionStatusResponse,
  ViewedFile,
} from '../types/review';

vi.mock('../api/reviews');

const mockFetchSession = vi.mocked(reviewsApi.fetchSession);
const mockUpdateSessionStatus = vi.mocked(reviewsApi.updateSessionStatus);
const mockPostComment = vi.mocked(reviewsApi.postComment);
const mockPatchComment = vi.mocked(reviewsApi.patchComment);
const mockMarkFileViewed = vi.mocked(reviewsApi.markFileViewed);
const mockUnmarkFileViewed = vi.mocked(reviewsApi.unmarkFileViewed);

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
  viewedFiles: [],
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
    mockFetchSession.mockResolvedValue({ session: baseSession } as unknown as SessionResponse);

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

    mockFetchSession.mockResolvedValueOnce({ session: baseSession } as unknown as SessionResponse);
    mockFetchSession.mockResolvedValueOnce({
      session: secondSession,
    } as unknown as SessionResponse);

    const { result, rerender } = renderHook((sha) => useReviewSession(sha), {
      initialProps: 'def456',
    });

    await waitFor(() => expect(result.current.session).toEqual(baseSession));

    rerender('aaa111');

    await waitFor(() => expect(result.current.session).toEqual(secondSession));

    expect(mockFetchSession).toHaveBeenCalledTimes(2);
  });

  it('updateStatus updates session state after API response', async () => {
    const updatedSession: ReviewData = {
      ...baseSession,
      session: { ...baseSession.session, status: 'approved' as const },
    };
    mockFetchSession.mockResolvedValue({ session: baseSession } as unknown as SessionResponse);
    mockUpdateSessionStatus.mockResolvedValue({
      session: updatedSession.session,
    } as unknown as UpdateSessionStatusResponse);

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
    mockFetchSession.mockResolvedValue({ session: baseSession } as unknown as SessionResponse);
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

    mockFetchSession.mockResolvedValue({
      session: sessionWithComment,
    } as unknown as SessionResponse);
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

  describe('markViewed (useOptimistic)', () => {
    const serverViewedFile: ViewedFile = {
      path: 'src/index.ts',
      viewedAt: '2026-03-19T02:00:00Z',
      diffHash: 'abc123hash',
    };

    it('adds an optimistic entry and then commits the server response', async () => {
      mockFetchSession.mockResolvedValue({ session: baseSession } as unknown as SessionResponse);
      mockMarkFileViewed.mockResolvedValue(serverViewedFile);

      const { result } = renderHook(() => useReviewSession('def456'));
      await waitFor(() => expect(result.current.session).toEqual(baseSession));

      await act(async () => {
        await result.current.markViewed('src/index.ts');
      });

      expect(mockMarkFileViewed).toHaveBeenCalledWith('def456', 'src/index.ts', undefined);
      expect(result.current.session?.viewedFiles).toHaveLength(1);
      expect(result.current.session?.viewedFiles?.[0]).toEqual(serverViewedFile);
    });

    it('reverts the optimistic update when the server call fails', async () => {
      mockFetchSession.mockResolvedValue({ session: baseSession } as unknown as SessionResponse);
      mockMarkFileViewed.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useReviewSession('def456'));
      await waitFor(() => expect(result.current.session).toEqual(baseSession));

      await act(async () => {
        await expect(result.current.markViewed('src/index.ts')).rejects.toThrow('Server error');
      });

      // After the failed transition, optimistic state reverts to the original viewedFiles
      expect(result.current.session?.viewedFiles).toEqual([]);
    });

    it('replaces an existing entry when re-marking an already-viewed file', async () => {
      const existingEntry: ViewedFile = {
        path: 'src/index.ts',
        viewedAt: '2026-03-19T01:00:00Z',
        diffHash: 'oldhash',
      };
      const sessionWithViewed: ReviewData = {
        ...baseSession,
        viewedFiles: [existingEntry],
      };
      mockFetchSession.mockResolvedValue({
        session: sessionWithViewed,
      } as unknown as SessionResponse);
      mockMarkFileViewed.mockResolvedValue(serverViewedFile);

      const { result } = renderHook(() => useReviewSession('def456'));
      await waitFor(() => expect(result.current.session).toEqual(sessionWithViewed));

      await act(async () => {
        await result.current.markViewed('src/index.ts');
      });

      expect(result.current.session?.viewedFiles).toHaveLength(1);
      expect(result.current.session?.viewedFiles?.[0]).toEqual(serverViewedFile);
    });
  });

  describe('unmarkViewed (useOptimistic)', () => {
    const existingEntry: ViewedFile = {
      path: 'src/index.ts',
      viewedAt: '2026-03-19T01:00:00Z',
      diffHash: 'abc123hash',
    };

    it('removes the entry optimistically and commits removal on success', async () => {
      const sessionWithViewed: ReviewData = {
        ...baseSession,
        viewedFiles: [existingEntry],
      };
      mockFetchSession.mockResolvedValue({
        session: sessionWithViewed,
      } as unknown as SessionResponse);
      mockUnmarkFileViewed.mockResolvedValue(undefined);

      const { result } = renderHook(() => useReviewSession('def456'));
      await waitFor(() => expect(result.current.session).toEqual(sessionWithViewed));

      await act(async () => {
        await result.current.unmarkViewed('src/index.ts');
      });

      expect(mockUnmarkFileViewed).toHaveBeenCalledWith('def456', 'src/index.ts', undefined);
      expect(result.current.session?.viewedFiles).toEqual([]);
    });

    it('reverts the optimistic removal when the server call fails', async () => {
      const sessionWithViewed: ReviewData = {
        ...baseSession,
        viewedFiles: [existingEntry],
      };
      mockFetchSession.mockResolvedValue({
        session: sessionWithViewed,
      } as unknown as SessionResponse);
      mockUnmarkFileViewed.mockRejectedValue(new Error('Server error'));

      const { result } = renderHook(() => useReviewSession('def456'));
      await waitFor(() => expect(result.current.session).toEqual(sessionWithViewed));

      await act(async () => {
        await expect(result.current.unmarkViewed('src/index.ts')).rejects.toThrow('Server error');
      });

      // After the failed transition, optimistic state reverts to the original viewedFiles
      expect(result.current.session?.viewedFiles).toEqual([existingEntry]);
    });
  });
});
