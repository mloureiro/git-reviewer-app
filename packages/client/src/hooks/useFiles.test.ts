import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useFiles } from './useFiles';
import * as reviewsApi from '../api/reviews';
import type { DiffFile } from '../types/review';

vi.mock('../api/reviews');

const mockFetchFiles = vi.mocked(reviewsApi.fetchFiles);

const sampleFiles: DiffFile[] = [
  { path: 'src/foo.ts', status: 'modified', additions: 5, deletions: 2 },
  { path: 'src/bar.ts', status: 'added', additions: 10, deletions: 0 },
];

describe('useFiles', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns idle state when params is null', () => {
    const { result } = renderHook(() => useFiles(null));

    expect(result.current.files).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(mockFetchFiles).not.toHaveBeenCalled();
  });

  it('returns loading=true initially when params are provided', () => {
    mockFetchFiles.mockReturnValue(new Promise(() => undefined));

    const { result } = renderHook(() => useFiles({ base: 'main', head: 'HEAD' }));

    expect(result.current.loading).toBe(true);
    expect(result.current.files).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('returns files on successful fetch', async () => {
    mockFetchFiles.mockResolvedValue({ files: sampleFiles });

    const { result } = renderHook(() => useFiles({ base: 'main', head: 'HEAD' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.files).toEqual(sampleFiles);
    expect(result.current.error).toBeNull();
    expect(mockFetchFiles).toHaveBeenCalledWith({ base: 'main', head: 'HEAD' });
  });

  it('returns error message when fetch fails with an Error', async () => {
    mockFetchFiles.mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useFiles({ base: 'main', head: 'HEAD' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.files).toEqual([]);
    expect(result.current.error).toBe('Network error');
  });

  it('returns fallback error message when fetch fails with a non-Error', async () => {
    mockFetchFiles.mockRejectedValue('unexpected string error');

    const { result } = renderHook(() => useFiles({ base: 'main', head: 'HEAD' }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to fetch files');
  });

  it('re-fetches when params change', async () => {
    const secondFiles: DiffFile[] = [
      { path: 'src/baz.ts', status: 'deleted', additions: 0, deletions: 3 },
    ];

    mockFetchFiles.mockResolvedValueOnce({ files: sampleFiles });
    mockFetchFiles.mockResolvedValueOnce({ files: secondFiles });

    const { result, rerender } = renderHook(
      (params: Parameters<typeof useFiles>[0]) => useFiles(params),
      { initialProps: { base: 'main', head: 'HEAD' } },
    );

    await waitFor(() => expect(result.current.files).toEqual(sampleFiles));

    rerender({ base: 'main', head: 'feature' });

    await waitFor(() => expect(result.current.files).toEqual(secondFiles));

    expect(mockFetchFiles).toHaveBeenCalledTimes(2);
  });

  it('resets to idle state when params change to null', async () => {
    mockFetchFiles.mockResolvedValue({ files: sampleFiles });

    const { result, rerender } = renderHook(
      (params: Parameters<typeof useFiles>[0]) => useFiles(params),
      { initialProps: { base: 'main', head: 'HEAD' } as Parameters<typeof useFiles>[0] },
    );

    await waitFor(() => expect(result.current.files).toEqual(sampleFiles));

    rerender(null);

    await waitFor(() => {
      expect(result.current.files).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
