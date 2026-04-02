import { useState, useCallback, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Plain-data entry built from a single diff line's DOM row. No DOM refs. */
interface IndexEntry {
  text: string;
  filePath: string;
  lineNumber: number;
  side: string;
}

/** A search hit referencing an entry in the index — no DOM refs. */
interface SearchHit {
  entryIndex: number;
  charOffset: number;
  length: number;
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
// Phase 1 — Build index (pure data extraction from DOM, runs rarely)
// ---------------------------------------------------------------------------

function buildIndex(container: HTMLElement): IndexEntry[] {
  const entries: IndexEntry[] = [];
  const rows = container.querySelectorAll<HTMLElement>('tr[data-file-path]');
  for (const row of rows) {
    const ctn = row.querySelector('.d2h-code-line-ctn');
    if (!ctn) continue;
    entries.push({
      text: ctn.textContent ?? '',
      filePath: row.getAttribute('data-file-path') ?? '',
      lineNumber: Number(row.getAttribute('data-line-number') ?? 0),
      side: row.getAttribute('data-line-side') ?? 'right',
    });
  }
  return entries;
}

// ---------------------------------------------------------------------------
// Phase 2 — Search (pure string matching, no DOM)
// ---------------------------------------------------------------------------

function searchIndex(index: IndexEntry[], query: string): SearchHit[] {
  if (query.length === 0) return [];
  const lower = query.toLowerCase();
  const hits: SearchHit[] = [];
  for (let i = 0; i < index.length; i += 1) {
    const entry = index[i];
    if (!entry) continue;
    const text = entry.text.toLowerCase();
    let pos = 0;
    while ((pos = text.indexOf(lower, pos)) !== -1) {
      hits.push({ entryIndex: i, charOffset: pos, length: query.length });
      pos += query.length; // non-overlapping
    }
  }
  return hits;
}

// ---------------------------------------------------------------------------
// Phase 3 — Highlight (lazy, windowed around current match)
// ---------------------------------------------------------------------------

const HIGHLIGHT_ALL = 'search-match';
const HIGHLIGHT_CURRENT = 'search-match-current';
const HIGHLIGHT_WINDOW = 100; // max highlights rendered at a time

function supportsHighlightAPI(): boolean {
  return typeof CSS !== 'undefined' && 'highlights' in CSS;
}

function clearHighlights(): void {
  if (!supportsHighlightAPI()) return;
  CSS.highlights.delete(HIGHLIGHT_ALL);
  CSS.highlights.delete(HIGHLIGHT_CURRENT);
}

/**
 * Resolve a DOM row matching the given index entry.
 * Uses data attributes for a targeted querySelector instead of scanning all rows.
 */
function resolveRow(container: HTMLElement, entry: IndexEntry): HTMLElement | null {
  return container.querySelector<HTMLElement>(
    `tr[data-file-path="${CSS.escape(entry.filePath)}"][data-line-number="${entry.lineNumber}"][data-line-side="${entry.side}"]`,
  );
}

/**
 * Given a text node tree within a `.d2h-code-line-ctn` span, find the text
 * node and local offset for a character offset in the concatenated textContent.
 */
function resolveTextPosition(
  ctnSpan: Element,
  charOffset: number,
): { node: Text; offset: number } | null {
  const walker = document.createTreeWalker(ctnSpan, NodeFilter.SHOW_TEXT);
  let accumulated = 0;
  let textNode: Text | null;
  while ((textNode = walker.nextNode() as Text | null)) {
    const len = textNode.textContent?.length ?? 0;
    if (accumulated + len > charOffset) {
      return { node: textNode, offset: charOffset - accumulated };
    }
    accumulated += len;
  }
  return null;
}

function applyWindowedHighlights(
  container: HTMLElement,
  index: IndexEntry[],
  hits: SearchHit[],
  currentIndex: number,
): void {
  if (!supportsHighlightAPI() || hits.length === 0) {
    clearHighlights();
    return;
  }

  const halfWindow = Math.floor(HIGHLIGHT_WINDOW / 2);
  const start = Math.max(0, currentIndex - halfWindow);
  const end = Math.min(hits.length, currentIndex + halfWindow);

  const allRanges: Range[] = [];
  let currentRange: Range | null = null;

  for (let i = start; i < end; i += 1) {
    const hit = hits[i];
    if (!hit) continue;
    const entry = index[hit.entryIndex];
    if (!entry) continue;

    const row = resolveRow(container, entry);
    if (!row) continue;

    const ctn = row.querySelector('.d2h-code-line-ctn');
    if (!ctn) continue;

    const startPos = resolveTextPosition(ctn, hit.charOffset);
    const endPos = resolveTextPosition(ctn, hit.charOffset + hit.length);
    if (!startPos || !endPos) continue;

    try {
      const range = document.createRange();
      range.setStart(startPos.node, startPos.offset);
      range.setEnd(endPos.node, endPos.offset);
      allRanges.push(range);
      if (i === currentIndex) {
        currentRange = range;
      }
    } catch {
      // Node may have been removed by React
    }
  }

  if (allRanges.length === 0) {
    clearHighlights();
    return;
  }

  CSS.highlights.set(HIGHLIGHT_ALL, new Highlight(...allRanges));

  if (currentRange) {
    CSS.highlights.set(HIGHLIGHT_CURRENT, new Highlight(currentRange));
  } else {
    CSS.highlights.delete(HIGHLIGHT_CURRENT);
  }
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
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const indexRef = useRef<IndexEntry[]>([]);
  const pendingScrollRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Rebuild the text index from the DOM (runs on mount, diff change, collapse toggle)
  const rebuildIndex = useCallback(() => {
    const container = containerRef.current;
    if (!container) {
      indexRef.current = [];
      return;
    }
    indexRef.current = buildIndex(container);
  }, [containerRef]);

  // Run search against the index (pure string ops, very fast)
  const runSearch = useCallback((q: string) => {
    if (q.length === 0) {
      setHits([]);
      setCurrentIndex(0);
      clearHighlights();
      return;
    }
    const found = searchIndex(indexRef.current, q);
    setHits(found);
    setCurrentIndex((prev) => (found.length === 0 ? 0 : Math.min(prev, found.length - 1)));
  }, []);

  // Rebuild index when collapsed files change (DOM structure changed)
  useEffect(() => {
    if (!isSearchOpen) return;
    const id = requestAnimationFrame(() => {
      rebuildIndex();

      // Re-run search with current query
      if (query.length > 0) {
        const found = searchIndex(indexRef.current, query);
        setHits(found);

        // Handle pending scroll after file expansion
        const pendingFile = pendingScrollRef.current;
        if (pendingFile) {
          pendingScrollRef.current = null;
          const entry = indexRef.current;
          const targetIdx = found.findIndex((h) => entry[h.entryIndex]?.filePath === pendingFile);
          if (targetIdx >= 0) {
            setCurrentIndex(targetIdx);
            return;
          }
        }

        setCurrentIndex((prev) => (found.length === 0 ? 0 : Math.min(prev, found.length - 1)));
      }
    });
    return () => cancelAnimationFrame(id);
  }, [collapsedFiles, isSearchOpen, query, rebuildIndex]);

  // Debounced search on query change
  useEffect(() => {
    if (!isSearchOpen) return;

    // Rebuild index on first search or if it's empty
    if (indexRef.current.length === 0) {
      rebuildIndex();
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      runSearch(query);
    }, 100);
    return () => clearTimeout(debounceRef.current);
  }, [query, isSearchOpen, rebuildIndex, runSearch]);

  // Apply windowed highlights when hits or currentIndex change
  useEffect(() => {
    const container = containerRef.current;
    if (!container || hits.length === 0) {
      clearHighlights();
      return;
    }
    applyWindowedHighlights(container, indexRef.current, hits, currentIndex);
  }, [containerRef, hits, currentIndex]);

  // Scroll current match into view
  useEffect(() => {
    const container = containerRef.current;
    if (!container || hits.length === 0) return;
    const hit = hits[currentIndex];
    if (!hit) return;
    const entry = indexRef.current[hit.entryIndex];
    if (!entry) return;

    const row = resolveRow(container, entry);
    if (!row) return;

    const rect = row.getBoundingClientRect();
    if (rect.top < 0 || rect.bottom > window.innerHeight) {
      row.scrollIntoView({ block: 'center', behavior: 'instant' as ScrollBehavior });
    }
  }, [containerRef, hits, currentIndex]);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setQuery('');
    setHits([]);
    setCurrentIndex(0);
    clearHighlights();
  }, []);

  const navigateTo = useCallback(
    (index: number) => {
      const hit = hits[index];
      if (!hit) return;
      const entry = indexRef.current[hit.entryIndex];
      if (!entry) return;

      if (collapsedFiles.has(entry.filePath)) {
        pendingScrollRef.current = entry.filePath;
        onExpandFile(entry.filePath);
        setCurrentIndex(index);
        return;
      }

      setCurrentIndex(index);
    },
    [hits, collapsedFiles, onExpandFile],
  );

  const goToNext = useCallback(() => {
    if (hits.length === 0) return;
    navigateTo((currentIndex + 1) % hits.length);
  }, [hits.length, currentIndex, navigateTo]);

  const goToPrev = useCallback(() => {
    if (hits.length === 0) return;
    navigateTo((currentIndex - 1 + hits.length) % hits.length);
  }, [hits.length, currentIndex, navigateTo]);

  return {
    isSearchOpen,
    openSearch,
    closeSearch,
    query,
    setQuery,
    matchCount: hits.length,
    currentMatchIndex: currentIndex,
    goToNext,
    goToPrev,
  };
}
