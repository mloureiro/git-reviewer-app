import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChangeDetection } from './useChangeDetection';
import * as reviewsApi from '../api/reviews';
import type { ResolveRefsResponse, MergeBaseResponse } from '../types/review';

// ---------------------------------------------------------------------------
// Module mock
// ---------------------------------------------------------------------------

vi.mock('../api/reviews');

const mockResolveRefs = vi.mocked(reviewsApi.resolveRefs);
const mockFetchMergeBase = vi.mocked(reviewsApi.fetchMergeBase);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_OPTIONS = {
  baseRef: 'main',
  headRef: 'feature',
  headCommit: 'def222',
  enabled: true,
};

const INITIAL_MERGE_BASE = 'fork111';

function headRefsResponse(headCommit: string): ResolveRefsResponse {
  return { refs: { feature: headCommit } };
}

function mergeBaseResponse(sha: string): MergeBaseResponse {
  return { mergeBase: sha };
}

/**
 * Most tests want a deterministic baseline merge-base captured before any
 * polling happens. This advances timers just enough for the on-mount
 * `fetchMergeBase` to resolve without firing the poll interval.
 */
async function waitForInitialMergeBase() {
  await act(async () => {
    await Promise.resolve();
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useChangeDetection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();

    // Default: head ref resolves to the same commit it was when the session opened
    mockResolveRefs.mockResolvedValue(headRefsResponse(BASE_OPTIONS.headCommit));
    // Default: merge-base hasn't shifted
    mockFetchMergeBase.mockResolvedValue(mergeBaseResponse(INITIAL_MERGE_BASE));

    // Default: tab is visible
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // -------------------------------------------------------------------------
  // Initial state
  // -------------------------------------------------------------------------

  describe('initial state', () => {
    it('starts with hasChanges=false, empty changedRefs, revision=0', () => {
      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));

      expect(result.current.hasChanges).toBe(false);
      expect(result.current.changedRefs).toEqual([]);
      expect(result.current.revision).toBe(0);
    });

    it('fetches the initial merge-base on mount but does not poll yet', async () => {
      renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      expect(mockFetchMergeBase).toHaveBeenCalledOnce();
      expect(mockFetchMergeBase).toHaveBeenCalledWith('main', 'feature', undefined);
      expect(mockResolveRefs).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Timer / polling
  // -------------------------------------------------------------------------

  describe('polling', () => {
    it('does not start polling when enabled=false', async () => {
      renderHook(() => useChangeDetection({ ...BASE_OPTIONS, enabled: false }));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(mockResolveRefs).not.toHaveBeenCalled();
      expect(mockFetchMergeBase).not.toHaveBeenCalled();
    });

    it('polls head ref and merge-base after 30 s when enabled=true', async () => {
      renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(mockResolveRefs).toHaveBeenCalledWith(['feature'], undefined);
      // 1 on mount + 1 in poll
      expect(mockFetchMergeBase).toHaveBeenCalledTimes(2);
    });

    it('passes the optional repo to all backend calls', async () => {
      const repo = '/path/to/repo';
      renderHook(() => useChangeDetection({ ...BASE_OPTIONS, repo }));
      await waitForInitialMergeBase();

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(mockFetchMergeBase).toHaveBeenCalledWith('main', 'feature', repo);
      expect(mockResolveRefs).toHaveBeenCalledWith(['feature'], repo);
    });
  });

  // -------------------------------------------------------------------------
  // Change detection
  // -------------------------------------------------------------------------

  describe('change detection', () => {
    it('flags headRef when its SHA advances', async () => {
      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      mockResolveRefs.mockResolvedValue(headRefsResponse('new-head-sha'));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.changedRefs).toContain('feature');
      expect(result.current.changedRefs).not.toContain('main');
    });

    it('flags baseRef when the merge-base shifts (rebase detected)', async () => {
      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      // Initial merge-base was captured; now the poll returns a different one
      mockFetchMergeBase.mockResolvedValue(mergeBaseResponse('new-fork-point'));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.changedRefs).toContain('main');
      expect(result.current.changedRefs).not.toContain('feature');
    });

    it('does NOT flag a banner when baseRef advances past the existing merge-base', async () => {
      // This is the scenario the merge-base check exists to suppress:
      // origin/master fetched new unrelated commits, but the fork point hasn't moved.
      // The diff is unchanged, so no banner.
      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      // baseRef SHA would have changed in the old implementation, but we don't
      // resolve it anymore — only head + merge-base matter. Merge-base stays put.
      mockResolveRefs.mockResolvedValue(headRefsResponse(BASE_OPTIONS.headCommit));
      mockFetchMergeBase.mockResolvedValue(mergeBaseResponse(INITIAL_MERGE_BASE));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(result.current.hasChanges).toBe(false);
      expect(result.current.changedRefs).toEqual([]);
    });

    it('flags both refs when head moved AND merge-base shifted', async () => {
      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      mockResolveRefs.mockResolvedValue(headRefsResponse('new-head-sha'));
      mockFetchMergeBase.mockResolvedValue(mergeBaseResponse('new-fork-point'));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.changedRefs).toContain('feature');
      expect(result.current.changedRefs).toContain('main');
    });

    it('does not poll again after changes have been detected (hasChanges guard)', async () => {
      mockResolveRefs.mockResolvedValue(headRefsResponse('new-head-sha'));

      renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      const initialMergeBaseCalls = mockFetchMergeBase.mock.calls.length;

      // First tick detects a change
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      const afterFirstPoll = mockResolveRefs.mock.calls.length;

      // Subsequent ticks should NOT call resolveRefs or fetchMergeBase again
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });

      expect(mockResolveRefs).toHaveBeenCalledTimes(afterFirstPoll);
      expect(mockFetchMergeBase).toHaveBeenCalledTimes(initialMergeBaseCalls + 1);
    });

    it('falls back to head-only detection when the initial merge-base fetch fails', async () => {
      mockFetchMergeBase.mockRejectedValueOnce(new Error('merge-base failed'));
      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      // Reset the mock so the poll can call it again without throwing —
      // but the guard in the hook should skip the merge-base check since
      // the baseline was never captured.
      mockFetchMergeBase.mockResolvedValue(mergeBaseResponse(INITIAL_MERGE_BASE));
      mockResolveRefs.mockResolvedValue(headRefsResponse('new-head-sha'));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      // Head movement is still detected
      expect(result.current.hasChanges).toBe(true);
      expect(result.current.changedRefs).toEqual(['feature']);
      // Merge-base was never re-queried in the poll because baseline is null
      expect(mockFetchMergeBase).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Visibility API
  // -------------------------------------------------------------------------

  describe('visibility API', () => {
    it('skips polling when the document is hidden', async () => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

      renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();
      const baselineCalls = mockFetchMergeBase.mock.calls.length;

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(mockResolveRefs).not.toHaveBeenCalled();
      expect(mockFetchMergeBase).toHaveBeenCalledTimes(baselineCalls);
    });

    it('skips one tick when hidden and resumes on the next visible tick', async () => {
      const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

      renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      // First tick: hidden → skipped
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
      expect(mockResolveRefs).not.toHaveBeenCalled();

      // Tab becomes visible
      visibilitySpy.mockReturnValue('visible');

      // Second tick: visible → polls
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });
      expect(mockResolveRefs).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // refresh()
  // -------------------------------------------------------------------------

  describe('refresh()', () => {
    it('increments revision', async () => {
      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      act(() => {
        result.current.refresh();
      });

      expect(result.current.revision).toBe(1);
    });

    it('clears hasChanges and changedRefs after changes were detected', async () => {
      mockResolveRefs.mockResolvedValue(headRefsResponse('new-head-sha'));

      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.changedRefs).not.toEqual([]);

      act(() => {
        result.current.refresh();
      });

      expect(result.current.hasChanges).toBe(false);
      expect(result.current.changedRefs).toEqual([]);
    });

    it('recaptures the merge-base baseline after refresh', async () => {
      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();
      const onMountCalls = mockFetchMergeBase.mock.calls.length;

      act(() => {
        result.current.refresh();
      });

      // refresh triggers a re-fetch via the revision dep
      await waitForInitialMergeBase();
      expect(mockFetchMergeBase.mock.calls.length).toBeGreaterThan(onMountCalls);
    });
  });

  // -------------------------------------------------------------------------
  // dismiss()
  // -------------------------------------------------------------------------

  describe('dismiss()', () => {
    it('hides hasChanges even when changes were detected', async () => {
      mockResolveRefs.mockResolvedValue(headRefsResponse('new-head-sha'));

      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(result.current.hasChanges).toBe(true);

      act(() => {
        result.current.dismiss();
      });

      expect(result.current.hasChanges).toBe(false);
    });

    it('preserves changedRefs even after dismiss', async () => {
      mockResolveRefs.mockResolvedValue(headRefsResponse('new-head-sha'));

      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      act(() => {
        result.current.dismiss();
      });

      expect(result.current.changedRefs).toContain('feature');
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  describe('cleanup', () => {
    it('clears the polling interval on unmount', async () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

      const { unmount } = renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('does not call the backend after unmount', async () => {
      const { unmount } = renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();
      const baselineCalls = mockFetchMergeBase.mock.calls.length;

      unmount();

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(mockResolveRefs).not.toHaveBeenCalled();
      expect(mockFetchMergeBase).toHaveBeenCalledTimes(baselineCalls);
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('silently ignores errors thrown by the polling calls', async () => {
      mockResolveRefs.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      await expect(
        act(async () => {
          vi.advanceTimersByTime(30_000);
        }),
      ).resolves.not.toThrow();

      expect(result.current.hasChanges).toBe(false);
    });

    it('continues polling after a failed request', async () => {
      mockResolveRefs
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue(headRefsResponse(BASE_OPTIONS.headCommit));

      renderHook(() => useChangeDetection(BASE_OPTIONS));
      await waitForInitialMergeBase();

      // First tick: error
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      // Second tick: succeeds
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(mockResolveRefs).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // knownHeadCommitRef stays current across rerenders
  // -------------------------------------------------------------------------

  describe('knownHeadCommitRef stays current', () => {
    it('uses the latest headCommit when comparing after a rerender', async () => {
      const { result, rerender } = renderHook(
        (props: typeof BASE_OPTIONS) => useChangeDetection(props),
        { initialProps: BASE_OPTIONS },
      );
      await waitForInitialMergeBase();

      // Parent updated headCommit to match what the API will return
      rerender({ ...BASE_OPTIONS, headCommit: 'new-head-sha' });

      mockResolveRefs.mockResolvedValue(headRefsResponse('new-head-sha'));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      // No change should be detected because the commit is now the known one
      expect(result.current.hasChanges).toBe(false);
    });
  });
});
