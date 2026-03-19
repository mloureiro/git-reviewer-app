import { useEffect, useRef } from 'react';
import { filePathToId } from '../components/DiffView';

/**
 * Watches all `.diff-file-section` elements via IntersectionObserver and calls
 * `onActiveFileChange` whenever the topmost visible section changes.
 *
 * Accepts a `suppressRef` — a ref whose current value, when `true`, causes the
 * observer callback to skip updates. SessionDetailPage sets this to `true`
 * briefly after a click-to-scroll so the observer does not override the
 * immediately-set activeFile.
 *
 * @param filePaths  - ordered list of file paths rendered in the diff view
 * @param onActiveFileChange - called with the path of the topmost visible section
 * @param suppressRef - when `.current === true` observer updates are skipped
 */
export function useActiveFileOnScroll(
  filePaths: string[],
  onActiveFileChange: (filePath: string) => void,
  suppressRef: React.RefObject<boolean>,
): void {
  // Keep a stable callback ref so the effect does not re-run when the
  // consumer re-renders and passes an inline function.
  const callbackRef = useRef(onActiveFileChange);
  callbackRef.current = onActiveFileChange;

  // Build a lookup from section id → file path whenever filePaths changes.
  const idToPathRef = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    const map = new Map<string, string>();
    for (const path of filePaths) {
      map.set(filePathToId(path), path);
    }
    idToPathRef.current = map;
  }, [filePaths]);

  useEffect(() => {
    if (filePaths.length === 0) return;

    // Track which sections are currently intersecting.
    const intersecting = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            intersecting.add(entry.target.id);
          } else {
            intersecting.delete(entry.target.id);
          }
        }

        if (suppressRef.current) return;

        // Find the topmost intersecting section by DOM order.
        const sections = document.querySelectorAll<HTMLElement>('.diff-file-section');
        for (const section of sections) {
          if (intersecting.has(section.id)) {
            const filePath = idToPathRef.current.get(section.id);
            if (filePath != null) {
              callbackRef.current(filePath);
            }
            break;
          }
        }
      },
      {
        // Trigger when the section enters the top 30% of the viewport.
        // The top 10% is dead zone so minor scrolls near the very top don't flicker.
        rootMargin: '-10% 0px -60% 0px',
        threshold: 0,
      },
    );

    const sections = document.querySelectorAll<HTMLElement>('.diff-file-section');
    for (const section of sections) {
      observer.observe(section);
    }

    return () => {
      observer.disconnect();
    };
    // filePaths.length is the only dep needed: idToPathRef is kept current via its own effect,
    // and suppressRef is a stable ref object whose identity never changes.
  }, [filePaths.length, suppressRef]);
}
