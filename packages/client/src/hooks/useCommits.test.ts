import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCommits } from './useCommits';
import * as reviewsApi from '../api/reviews';
import type { CommitInfo } from '../types/review';

vi.mock('../api/reviews');

const mockFetchCommits = vi.mocked(reviewsApi.fetchCommits);

const sampleCommits: CommitInfo[] = [
  {
    hash: 'abc1234567890',
    shortHash: 'abc1234',
    message: 'feat: add login flow',
    author: 'Alice',
    date: '2026-04-01T10:00:00Z',
  },
  {
    hash: 'def1234567890',
    shortHash: 'def1234',
    message: 'fix: handle token expiry',
    author: 'Bob',
    date: '2026-04-02T12:00:00Z',
  },
];

describe('useCommits', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns idle state when commitSha is null', () => {
    const { result } = renderHook(() => useCommits(null));

    expect(result.current.commits).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockFetchCommits).not.toHaveBeenCalled();
  });

  it('returns idle state when commitSha is an empty string', () => {
    const { result } = renderHook(() => useCommits(''));

    expect(result.current.commits).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockFetchCommits).not.toHaveBeenCalled();
  });

  it('returns loading=true immediately when commitSha is provided', () => {
    mockFetchCommits.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useCommits('abc1234'));

    expect(result.current.loading).toBe(true);
    expect(result.current.commits).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns commits on successful fetch', async () => {
    mockFetchCommits.mockResolvedValue({ commits: sampleCommits });

    const { result } = renderHook(() => useCommits('abc1234'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.commits).toEqual(sampleCommits);
    expect(result.current.error).toBeNull();
    expect(mockFetchCommits).toHaveBeenCalledWith('abc1234', undefined);
  });

  it('returns empty commits array when the session has no commits', async () => {
    mockFetchCommits.mockResolvedValue({ commits: [] });

    const { result } = renderHook(() => useCommits('abc1234'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.commits).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns error message when fetch fails with an Error', async () => {
    mockFetchCommits.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCommits('abc1234'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.commits).toEqual([]);
    expect(result.current.error).toBe('Network error');
  });

  it('returns fallback error message when fetch fails with a non-Error', async () => {
    mockFetchCommits.mockRejectedValue('unexpected string error');

    const { result } = renderHook(() => useCommits('abc1234'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to fetch commits');
  });

  it('passes the repo parameter through to fetchCommits', async () => {
    mockFetchCommits.mockResolvedValue({ commits: sampleCommits });

    const { result } = renderHook(() => useCommits('abc1234', '/path/to/repo'));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockFetchCommits).toHaveBeenCalledWith('abc1234', '/path/to/repo');
    expect(result.current.commits).toEqual(sampleCommits);
  });

  it('re-fetches when commitSha changes', async () => {
    const secondCommits: CommitInfo[] = [
      {
        hash: 'ghi1234567890',
        shortHash: 'ghi1234',
        message: 'refactor: clean up auth module',
        author: 'Carol',
        date: '2026-04-03T09:00:00Z',
      },
    ];

    mockFetchCommits.mockResolvedValueOnce({ commits: sampleCommits });
    mockFetchCommits.mockResolvedValueOnce({ commits: secondCommits });

    const { result, rerender } = renderHook((sha: string) => useCommits(sha), {
      initialProps: 'abc1234',
    });

    await waitFor(() => expect(result.current.commits).toEqual(sampleCommits));

    rerender('ghi1234');

    await waitFor(() => expect(result.current.commits).toEqual(secondCommits));

    expect(mockFetchCommits).toHaveBeenCalledTimes(2);
  });

  it('resets to idle state when commitSha changes to null', async () => {
    mockFetchCommits.mockResolvedValue({ commits: sampleCommits });

    const { result, rerender } = renderHook((sha: string | null) => useCommits(sha), {
      initialProps: 'abc1234' as string | null,
    });

    await waitFor(() => expect(result.current.commits).toEqual(sampleCommits));

    rerender(null);

    await waitFor(() => {
      expect(result.current.commits).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });

  it('re-fetches when repo changes', async () => {
    const commitA: CommitInfo = {
      hash: 'abc1234567890',
      shortHash: 'abc1234',
      message: 'feat: add login flow',
      author: 'Alice',
      date: '2026-04-01T10:00:00Z',
    };
    const commitB: CommitInfo = {
      hash: 'def1234567890',
      shortHash: 'def1234',
      message: 'fix: handle token expiry',
      author: 'Bob',
      date: '2026-04-02T12:00:00Z',
    };
    const repoACommits: CommitInfo[] = [commitA];
    const repoBCommits: CommitInfo[] = [commitB];

    mockFetchCommits.mockResolvedValueOnce({ commits: repoACommits });
    mockFetchCommits.mockResolvedValueOnce({ commits: repoBCommits });

    const { result, rerender } = renderHook(
      (repo: string | undefined) => useCommits('abc1234', repo),
      { initialProps: '/repo-a' as string | undefined },
    );

    await waitFor(() => expect(result.current.commits).toEqual(repoACommits));

    rerender('/repo-b');

    await waitFor(() => expect(result.current.commits).toEqual(repoBCommits));

    expect(mockFetchCommits).toHaveBeenCalledTimes(2);
    expect(mockFetchCommits).toHaveBeenNthCalledWith(1, 'abc1234', '/repo-a');
    expect(mockFetchCommits).toHaveBeenNthCalledWith(2, 'abc1234', '/repo-b');
  });
});
