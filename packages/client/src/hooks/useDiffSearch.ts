import { useState, useCallback, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SearchMatch {
  textNode: Text;
  startOffset: number;
  length: number;
  filePath: string;
  row: HTMLElement;
}

interface UseDiffSearchOptions {
  containerRef: React.RefObject<HTMLElement | null>;
  collapsedFiles: Set<string>;
  onExpandFile: (filePath: string) => void;
}

export interface UseDiffSearchReturn {
  isSearchOpen: boolean;
  openSearch: () => void;
  closeSearch: () => void;
  query: string;
  setQuery: (q: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  goToNext: () => void;
  goToPrev: () => void;
}

// ---------------------------------------------------------------------------
// Highlight helpers (CSS Custom Highlight API)
// ---------------------------------------------------------------------------

const HIGHLIGHT_ALL = 'search-match';
const HIGHLIGHT_CURRENT = 'search-match-current';

function supportsHighlightAPI(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS;
}

function clearHighlights(): void {
  if (!supportsHighlightAPI()) return;
  CSS.highlights.delete(HIGHLIGHT_ALL);
  CSS.highlights.delete(HIGHLIGHT_CURRENT);
}

function applyHighlights(matches: SearchMatch[], currentIndex: number): void {
  if (!supportsHighlightAPI() || matches.length === 0) {
    clearHighlights();
    return;
  }

  const allRanges: Range[] = [];
  for (const m of matches) {
    try {
      const range = document.createRange();
      range.setStart(m.textNode, m.startOffset);
      range.setEnd(m.textNode, m.startOffset + m.length);
      allRanges.push(range);
    } catch {
      // Text node may have been removed by React re-render
    }
  }

  if (allRanges.length === 0) {
    clearHighlights();
    return;
  }

  CSS.highlights.set(HIGHLIGHT_ALL, new Highlight(...allRanges));

  const currentRange = allRanges[currentIndex];
  if (currentRange) {
    CSS.highlights.set(HIGHLIGHT_CURRENT, new Highlight(currentRange));
  } else {
    CSS.highlights.delete(HIGHLIGHT_CURRENT);
  }
}

// ---------------------------------------------------------------------------
// Search engine
// ---------------------------------------------------------------------------

function findMatches(container: HTMLElement, query: string): SearchMatch[] {
  if (query.length === 0) return [];

  const lowerQuery = query.toLowerCase();
  const results: SearchMatch[] = [];

  // Query all code line content spans
  const codeSpans = container.querySelectorAll('.d2h-code-line-ctn');

  for (const span of codeSpans) {
    // Find the parent <tr> and extract file path
    const row = span.closest('tr');
    if (!row) continue;
    const filePath = row.getAttribute('data-file-path') ?? '';

    // Walk text nodes within this span
    const walker = document.createTreeWalker(span, NodeFilter.SHOW_TEXT);
    let textNode: Text | null;
    while ((textNode = walker.nextNode() as Text | null)) {
      const text = textNode.textContent ?? '';
      const lowerText = text.toLowerCase();
      let searchFrom = 0;

      while (searchFrom < lowerText.length) {
        const idx = lowerText.indexOf(lowerQuery, searchFrom);
        if (idx === -1) break;

        results.push({
          textNode,
          startOffset: idx,
          length: query.length,
          filePath,
          row: row as HTMLElement,
        });
        searchFrom = idx + 1;
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDiffSearch({
  containerRef,
  collapsedFiles,
  onExpandFile,
}: UseDiffSearchOptions): UseDiffSearchReturn {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Track pending expansion so we can scroll after re-render
  const pendingScrollRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Re-index matches when query, collapsed state, or container content changes
  const reindex = useCallback(() => {
    const container = containerRef.current;
    if (!container || query.length === 0) {
      setMatches([]);
      setCurrentIndex(0);
      clearHighlights();
      return;
    }

    const found = findMatches(container, query);
    setMatches(found);
    setCurrentIndex((prev) => (found.length === 0 ? 0 : Math.min(prev, found.length - 1)));
    applyHighlights(found, found.length === 0 ? -1 : Math.min(0, found.length - 1));
  }, [containerRef, query]);

  // Debounced re-index on query change
  useEffect(() => {
    if (!isSearchOpen) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      reindex();
    }, 150);
    return () => clearTimeout(debounceRef.current);
  }, [query, isSearchOpen, reindex]);

  // Re-index when collapsed files change (file was expanded/collapsed)
  useEffect(() => {
    if (!isSearchOpen || query.length === 0) return;
    // Short delay for React to render the expanded content
    const id = requestAnimationFrame(() => {
      const container = containerRef.current;
      if (!container) return;

      const found = findMatches(container, query);
      setMatches(found);

      // If we were waiting to scroll to a match in an expanded file
      const pendingFile = pendingScrollRef.current;
      if (pendingFile) {
        pendingScrollRef.current = null;
        const targetIdx = found.findIndex((m) => m.filePath === pendingFile);
        const target = found[targetIdx];
        if (targetIdx >= 0 && target) {
          setCurrentIndex(targetIdx);
          applyHighlights(found, targetIdx);
          target.row.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return;
        }
      }

      const idx = found.length === 0 ? 0 : Math.min(currentIndex, found.length - 1);
      setCurrentIndex(idx);
      applyHighlights(found, idx);
    });
    return () => cancelAnimationFrame(id);
  }, [collapsedFiles, isSearchOpen, query, containerRef, currentIndex]);

  // Update highlights whenever currentIndex changes
  useEffect(() => {
    applyHighlights(matches, currentIndex);
  }, [matches, currentIndex]);

  // Scroll current match into view
  useEffect(() => {
    const match = matches[currentIndex];
    if (!match) return;
    // Only scroll if the row is not already in view
    const rect = match.row.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      match.row.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }, [matches, currentIndex]);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setQuery('');
    setMatches([]);
    setCurrentIndex(0);
    clearHighlights();
  }, []);

  const navigateTo = useCallback(
    (index: number) => {
      const match = matches[index];
      if (!match) return;

      // If the file is collapsed, expand it and defer the scroll
      if (collapsedFiles.has(match.filePath)) {
        pendingScrollRef.current = match.filePath;
        onExpandFile(match.filePath);
        setCurrentIndex(index);
        return;
      }

      setCurrentIndex(index);
    },
    [matches, collapsedFiles, onExpandFile],
  );

  const goToNext = useCallback(() => {
    if (matches.length === 0) return;
    navigateTo((currentIndex + 1) % matches.length);
  }, [matches.length, currentIndex, navigateTo]);

  const goToPrev = useCallback(() => {
    if (matches.length === 0) return;
    navigateTo((currentIndex - 1 + matches.length) % matches.length);
  }, [matches.length, currentIndex, navigateTo]);

  return {
    isSearchOpen,
    openSearch,
    closeSearch,
    query,
    setQuery,
    matchCount: matches.length,
    currentMatchIndex: currentIndex,
    goToNext,
    goToPrev,
  };
}
