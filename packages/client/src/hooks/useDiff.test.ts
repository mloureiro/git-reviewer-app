import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDiff } from './useDiff';
import * as reviewsApi from '../api/reviews';

vi.mock('../api/reviews');

const mockFetchDiff = vi.mocked(reviewsApi.fetchDiff);

describe('useDiff', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns loading=true initially', () => {
    mockFetchDiff.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useDiff({ base: 'main', head: 'HEAD' }));

    expect(result.current.loading).toBe(true);
    expect(result.current.diff).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('returns diff text on success', async () => {
    mockFetchDiff.mockResolvedValue({ diff: 'diff --git a/file.ts b/file.ts\n...' });

    const { result } = renderHook(() => useDiff({ base: 'main', head: 'HEAD' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.diff).toBe('diff --git a/file.ts b/file.ts\n...');
    expect(result.current.error).toBeNull();
  });

  it('returns error message on failure', async () => {
    mockFetchDiff.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useDiff({ base: 'main', head: 'HEAD' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.diff).toBeNull();
    expect(result.current.error).toBe('Network error');
  });

  it('re-fetches when params change', async () => {
    mockFetchDiff.mockResolvedValueOnce({ diff: 'first diff' });
    mockFetchDiff.mockResolvedValueOnce({ diff: 'second diff' });

    const { result, rerender } = renderHook((params) => useDiff(params), {
      initialProps: { base: 'main', head: 'HEAD' },
    });

    await waitFor(() => expect(result.current.diff).toBe('first diff'));

    rerender({ base: 'main', head: 'feature' });

    await waitFor(() => expect(result.current.diff).toBe('second diff'));

    expect(mockFetchDiff).toHaveBeenCalledTimes(2);
  });

  it('handles non-Error rejections gracefully', async () => {
    mockFetchDiff.mockRejectedValue('plain string error');

    const { result } = renderHook(() => useDiff({ uncommitted: 'true' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to fetch diff');
  });
});
