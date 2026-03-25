import { renderHook } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useResponsiveDiffMode } from './useResponsiveDiffMode';

type MediaQueryCallback = (event: MediaQueryListEvent | MediaQueryList) => void;

function makeMediaQuery(matches: boolean): {
  mock: MediaQueryList;
  triggerChange: (newMatches: boolean) => void;
} {
  const listeners: MediaQueryCallback[] = [];

  const mock = {
    matches,
    addEventListener: vi.fn((_event: string, cb: MediaQueryCallback) => {
      listeners.push(cb);
    }),
    removeEventListener: vi.fn((_event: string, cb: MediaQueryCallback) => {
      const index = listeners.indexOf(cb);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }),
  } as unknown as MediaQueryList;

  function triggerChange(newMatches: boolean): void {
    const event = { matches: newMatches } as unknown as MediaQueryListEvent;
    for (const listener of listeners) {
      listener(event);
    }
  }

  return { mock, triggerChange };
}

describe('useResponsiveDiffMode', () => {
  let matchMediaSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    matchMediaSpy = vi.spyOn(window, 'matchMedia');
  });

  afterEach(() => {
    matchMediaSpy.mockRestore();
  });

  it('calls onChange with line-by-line immediately when viewport is narrow and mode is side-by-side', () => {
    const { mock } = makeMediaQuery(true); // narrow viewport
    matchMediaSpy.mockReturnValue(mock);

    const onChange = vi.fn();
    renderHook(() => useResponsiveDiffMode('side-by-side', 'side-by-side', onChange));

    expect(onChange).toHaveBeenCalledWith('line-by-line');
  });

  it('does not call onChange when viewport is narrow but mode is already line-by-line', () => {
    const { mock } = makeMediaQuery(true); // narrow viewport
    matchMediaSpy.mockReturnValue(mock);

    const onChange = vi.fn();
    renderHook(() => useResponsiveDiffMode('line-by-line', 'line-by-line', onChange));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('does not call onChange when viewport is wide and mode matches preferred', () => {
    const { mock } = makeMediaQuery(false); // wide viewport
    matchMediaSpy.mockReturnValue(mock);

    const onChange = vi.fn();
    renderHook(() => useResponsiveDiffMode('side-by-side', 'side-by-side', onChange));

    expect(onChange).not.toHaveBeenCalled();
  });

  it('restores preferred mode when viewport widens and active mode differs', () => {
    const { mock } = makeMediaQuery(false); // wide viewport
    matchMediaSpy.mockReturnValue(mock);

    const onChange = vi.fn();
    // preferredMode is side-by-side but activeMode is line-by-line (forced narrow earlier)
    renderHook(() => useResponsiveDiffMode('side-by-side', 'line-by-line', onChange));

    expect(onChange).toHaveBeenCalledWith('side-by-side');
  });

  it('switches to line-by-line when viewport narrows via media query change event', () => {
    const { mock, triggerChange } = makeMediaQuery(false); // initially wide
    matchMediaSpy.mockReturnValue(mock);

    const onChange = vi.fn();
    renderHook(() => useResponsiveDiffMode('side-by-side', 'side-by-side', onChange));

    expect(onChange).not.toHaveBeenCalled();

    triggerChange(true); // viewport narrows

    expect(onChange).toHaveBeenCalledWith('line-by-line');
  });

  it('restores preferred mode when viewport widens via media query change event', () => {
    const { mock, triggerChange } = makeMediaQuery(true); // initially narrow
    matchMediaSpy.mockReturnValue(mock);

    const onChange = vi.fn();
    renderHook(() => useResponsiveDiffMode('side-by-side', 'line-by-line', onChange));

    onChange.mockClear();

    triggerChange(false); // viewport widens

    expect(onChange).toHaveBeenCalledWith('side-by-side');
  });

  it('removes the event listener on cleanup', () => {
    const { mock } = makeMediaQuery(false);
    matchMediaSpy.mockReturnValue(mock);

    const onChange = vi.fn();
    const { unmount } = renderHook(() =>
      useResponsiveDiffMode('side-by-side', 'side-by-side', onChange),
    );

    unmount();

    expect(mock.removeEventListener).toHaveBeenCalledWith('change', expect.any(Function));
  });
});
