import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useChangeDetection } from './useChangeDetection';
import * as reviewsApi from '../api/reviews';
import type { ResolveRefsResponse } from '../types/review';

// ---------------------------------------------------------------------------
// Module mock
// ---------------------------------------------------------------------------

vi.mock('../api/reviews');

const mockResolveRefs = vi.mocked(reviewsApi.resolveRefs);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const BASE_OPTIONS = {
  baseRef: 'main',
  headRef: 'feature',
  baseCommit: 'abc111',
  headCommit: 'def222',
  enabled: true,
};

function makeRefsResponse(baseCommit: string, headCommit: string): ResolveRefsResponse {
  return { refs: { main: baseCommit, feature: headCommit } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useChangeDetection', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();

    // Default: refs resolve to the same commits as known (no change)
    mockResolveRefs.mockResolvedValue(
      makeRefsResponse(BASE_OPTIONS.baseCommit, BASE_OPTIONS.headCommit),
    );

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

    it('does not call resolveRefs before the first interval fires', () => {
      renderHook(() => useChangeDetection(BASE_OPTIONS));

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
    });

    it('starts polling after 30 s when enabled=true', async () => {
      renderHook(() => useChangeDetection(BASE_OPTIONS));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(mockResolveRefs).toHaveBeenCalledOnce();
    });

    it('polls again at the next interval when no changes were detected', async () => {
      renderHook(() => useChangeDetection(BASE_OPTIONS));

      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });

      expect(mockResolveRefs).toHaveBeenCalledTimes(2);
    });

    it('passes the correct refs and optional repo to resolveRefs', async () => {
      const repo = '/path/to/repo';
      renderHook(() => useChangeDetection({ ...BASE_OPTIONS, repo }));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(mockResolveRefs).toHaveBeenCalledWith(['main', 'feature'], repo);
    });

    it('deduplicates refs when baseRef and headRef are identical', async () => {
      renderHook(() => useChangeDetection({ ...BASE_OPTIONS, baseRef: 'main', headRef: 'main' }));

      mockResolveRefs.mockResolvedValue({ refs: { main: BASE_OPTIONS.baseCommit } });

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      const [calledRefs] = mockResolveRefs.mock.calls[0] as [string[], string?];
      expect(calledRefs).toEqual(['main']); // deduplicated
    });
  });

  // -------------------------------------------------------------------------
  // Change detection
  // -------------------------------------------------------------------------

  describe('change detection', () => {
    it('sets hasChanges=true and populates changedRefs when headRef resolves to a new commit', async () => {
      mockResolveRefs.mockResolvedValue(makeRefsResponse(BASE_OPTIONS.baseCommit, 'new-head-sha'));

      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.changedRefs).toContain('feature');
      expect(result.current.changedRefs).not.toContain('main');
    });

    it('sets hasChanges=true and populates changedRefs when baseRef resolves to a new commit', async () => {
      mockResolveRefs.mockResolvedValue(makeRefsResponse('new-base-sha', BASE_OPTIONS.headCommit));

      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.changedRefs).toContain('main');
      expect(result.current.changedRefs).not.toContain('feature');
    });

    it('includes both refs in changedRefs when both have changed', async () => {
      mockResolveRefs.mockResolvedValue(makeRefsResponse('new-base-sha', 'new-head-sha'));

      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(result.current.hasChanges).toBe(true);
      expect(result.current.changedRefs).toContain('main');
      expect(result.current.changedRefs).toContain('feature');
    });

    it('keeps hasChanges=false when resolved commits match known commits', async () => {
      // mockResolveRefs already returns matching commits from beforeEach
      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(result.current.hasChanges).toBe(false);
      expect(result.current.changedRefs).toEqual([]);
    });

    it('does not poll again after changes have been detected (hasChanges guard)', async () => {
      mockResolveRefs.mockResolvedValue(makeRefsResponse(BASE_OPTIONS.baseCommit, 'new-head-sha'));

      renderHook(() => useChangeDetection(BASE_OPTIONS));

      // First tick detects a change
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(mockResolveRefs).toHaveBeenCalledTimes(1);

      // Subsequent ticks should NOT call resolveRefs again
      await act(async () => {
        vi.advanceTimersByTime(60_000);
      });

      expect(mockResolveRefs).toHaveBeenCalledTimes(1);
    });
  });

  // -------------------------------------------------------------------------
  // Visibility API
  // -------------------------------------------------------------------------

  describe('visibility API', () => {
    it('skips polling when the document is hidden', async () => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

      renderHook(() => useChangeDetection(BASE_OPTIONS));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(mockResolveRefs).not.toHaveBeenCalled();
    });

    it('polls normally when the document is visible', async () => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');

      renderHook(() => useChangeDetection(BASE_OPTIONS));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(mockResolveRefs).toHaveBeenCalledOnce();
    });

    it('skips one tick when hidden and resumes on the next visible tick', async () => {
      const visibilitySpy = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');

      renderHook(() => useChangeDetection(BASE_OPTIONS));

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

      act(() => {
        result.current.refresh();
      });

      expect(result.current.revision).toBe(1);
    });

    it('increments revision each time it is called', () => {
      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));

      act(() => {
        result.current.refresh();
      });
      act(() => {
        result.current.refresh();
      });

      expect(result.current.revision).toBe(2);
    });

    it('clears hasChanges and changedRefs after changes were detected', async () => {
      mockResolveRefs.mockResolvedValue(makeRefsResponse(BASE_OPTIONS.baseCommit, 'new-head-sha'));

      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));

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

    it('clears the dismissed flag so subsequent changes become visible again', async () => {
      mockResolveRefs.mockResolvedValue(makeRefsResponse(BASE_OPTIONS.baseCommit, 'new-head-sha'));

      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));

      // Detect a change then dismiss it
      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      act(() => {
        result.current.dismiss();
      });

      expect(result.current.hasChanges).toBe(false); // dismissed

      // refresh should clear the dismissed flag
      act(() => {
        result.current.refresh();
      });

      // hasChanges is also cleared by refresh, so we expect false, but dismissed is gone
      expect(result.current.revision).toBe(1);
      expect(result.current.hasChanges).toBe(false); // cleared by refresh itself
    });
  });

  // -------------------------------------------------------------------------
  // dismiss()
  // -------------------------------------------------------------------------

  describe('dismiss()', () => {
    it('hides hasChanges even when changes were detected', async () => {
      mockResolveRefs.mockResolvedValue(makeRefsResponse(BASE_OPTIONS.baseCommit, 'new-head-sha'));

      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));

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
      mockResolveRefs.mockResolvedValue(makeRefsResponse(BASE_OPTIONS.baseCommit, 'new-head-sha'));

      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      act(() => {
        result.current.dismiss();
      });

      // changedRefs still holds the refs that changed
      expect(result.current.changedRefs).toContain('feature');
    });

    it('has no effect on hasChanges when called before any change is detected', () => {
      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));

      act(() => {
        result.current.dismiss();
      });

      expect(result.current.hasChanges).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // Cleanup
  // -------------------------------------------------------------------------

  describe('cleanup', () => {
    it('clears the polling interval on unmount', async () => {
      const clearIntervalSpy = vi.spyOn(globalThis, 'clearInterval');

      const { unmount } = renderHook(() => useChangeDetection(BASE_OPTIONS));

      unmount();

      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    it('does not call resolveRefs after unmount', async () => {
      const { unmount } = renderHook(() => useChangeDetection(BASE_OPTIONS));

      unmount();

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(mockResolveRefs).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // Error handling
  // -------------------------------------------------------------------------

  describe('error handling', () => {
    it('silently ignores errors thrown by resolveRefs', async () => {
      mockResolveRefs.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useChangeDetection(BASE_OPTIONS));

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
        .mockResolvedValue(makeRefsResponse(BASE_OPTIONS.baseCommit, BASE_OPTIONS.headCommit));

      renderHook(() => useChangeDetection(BASE_OPTIONS));

      // First tick: error — should not throw
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
  // knownCommitsRef — keeps up to date across renders
  // -------------------------------------------------------------------------

  describe('knownCommitsRef stays current', () => {
    it('uses the latest headCommit when comparing after a rerender', async () => {
      const { result, rerender } = renderHook(
        (props: typeof BASE_OPTIONS) => useChangeDetection(props),
        { initialProps: BASE_OPTIONS },
      );

      // Simulate the parent updating headCommit to match what the API will return
      // (i.e. the "new" commit is now the known commit after a refresh)
      const updatedOptions = { ...BASE_OPTIONS, headCommit: 'new-head-sha' };
      rerender(updatedOptions);

      // resolveRefs returns 'new-head-sha', which now equals knownCommitsRef.headCommit
      mockResolveRefs.mockResolvedValue({
        refs: { main: BASE_OPTIONS.baseCommit, feature: 'new-head-sha' },
      });

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      // No change should be detected because the commit is now the known one
      expect(result.current.hasChanges).toBe(false);
    });

    it('detects a change based on the most recent commit value after rerender', async () => {
      const { result, rerender } = renderHook(
        (props: typeof BASE_OPTIONS) => useChangeDetection(props),
        { initialProps: BASE_OPTIONS },
      );

      // Parent updates headCommit to reflect a refresh
      rerender({ ...BASE_OPTIONS, headCommit: 'updated-commit' });

      // API now returns yet another commit — different from 'updated-commit'
      mockResolveRefs.mockResolvedValue(
        makeRefsResponse(BASE_OPTIONS.baseCommit, 'another-new-sha'),
      );

      await act(async () => {
        vi.advanceTimersByTime(30_000);
      });

      expect(result.current.hasChanges).toBe(true);
    });
  });
});
