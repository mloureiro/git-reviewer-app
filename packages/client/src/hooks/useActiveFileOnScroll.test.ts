import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useRef } from 'react';
import { useActiveFileOnScroll } from './useActiveFileOnScroll';

// ---------------------------------------------------------------------------
// IntersectionObserver mock
// ---------------------------------------------------------------------------

type ObserverCallback = (entries: IntersectionObserverEntry[]) => void;

let latestCallback: ObserverCallback | null = null;
const observedElements: Set<Element> = new Set();
let disconnectCallCount = 0;

class MockIntersectionObserver {
  static instanceCount = 0;

  constructor(callback: ObserverCallback) {
    latestCallback = callback;
    MockIntersectionObserver.instanceCount = MockIntersectionObserver.instanceCount + 1;
  }

  observe(el: Element): void {
    observedElements.add(el);
  }

  unobserve(el: Element): void {
    observedElements.delete(el);
  }

  disconnect(): void {
    disconnectCallCount = disconnectCallCount + 1;
    latestCallback = null;
  }
}

// ---------------------------------------------------------------------------
// DOM helpers
// ---------------------------------------------------------------------------

function createSection(id: string): HTMLElement {
  const el = document.createElement('section');
  el.id = id;
  el.className = 'diff-file-section';
  document.body.appendChild(el);
  return el;
}

function fireIntersection(el: HTMLElement, isIntersecting: boolean): void {
  if (latestCallback == null) return;
  latestCallback([
    {
      target: el,
      isIntersecting,
      intersectionRatio: isIntersecting ? 1 : 0,
      boundingClientRect: el.getBoundingClientRect(),
      intersectionRect: el.getBoundingClientRect(),
      rootBounds: null,
      time: performance.now(),
    } as unknown as IntersectionObserverEntry,
  ]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useActiveFileOnScroll', () => {
  beforeEach(() => {
    vi.stubGlobal('IntersectionObserver', MockIntersectionObserver);
    MockIntersectionObserver.instanceCount = 0;
    observedElements.clear();
    disconnectCallCount = 0;
    latestCallback = null;
  });

  afterEach(() => {
    document.querySelectorAll('.diff-file-section').forEach((el) => el.remove());
    vi.unstubAllGlobals();
  });

  it('does not create an observer when filePaths is empty', () => {
    const callback = vi.fn();
    renderHook(() => {
      const suppressRef = useRef(false);
      useActiveFileOnScroll([], callback, suppressRef);
    });

    expect(MockIntersectionObserver.instanceCount).toBe(0);
    expect(callback).not.toHaveBeenCalled();
  });

  it('observes all .diff-file-section elements when filePaths are provided', () => {
    const sectionA = createSection('file-src-a-ts');
    const sectionB = createSection('file-src-b-ts');

    renderHook(() => {
      const suppressRef = useRef(false);
      useActiveFileOnScroll(['src/a.ts', 'src/b.ts'], useRef(vi.fn()).current, suppressRef);
    });

    expect(observedElements.has(sectionA)).toBe(true);
    expect(observedElements.has(sectionB)).toBe(true);
  });

  it('calls onActiveFileChange with the topmost intersecting file path', () => {
    const sectionA = createSection('file-src-a-ts');
    createSection('file-src-b-ts');

    const callback = vi.fn();
    renderHook(() => {
      const suppressRef = useRef(false);
      useActiveFileOnScroll(['src/a.ts', 'src/b.ts'], callback, suppressRef);
    });

    act(() => {
      fireIntersection(sectionA, true);
    });

    expect(callback).toHaveBeenCalledWith('src/a.ts');
  });

  it('does not call onActiveFileChange when suppressRef is true', () => {
    const sectionA = createSection('file-src-a-ts');

    const callback = vi.fn();
    renderHook(() => {
      const suppressRef = useRef(true);
      useActiveFileOnScroll(['src/a.ts'], callback, suppressRef);
    });

    act(() => {
      fireIntersection(sectionA, true);
    });

    expect(callback).not.toHaveBeenCalled();
  });

  it('disconnects the observer on unmount', () => {
    createSection('file-src-a-ts');

    const { unmount } = renderHook(() => {
      const callback = vi.fn();
      const suppressRef = useRef(false);
      useActiveFileOnScroll(['src/a.ts'], callback, suppressRef);
    });

    unmount();

    expect(disconnectCallCount).toBe(1);
  });
});
