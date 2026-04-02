import { useState, useCallback, useRef, useEffect } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Plain-data entry built from a single diff line's DOM row. No DOM refs. */
interface IndexEntry {
  text: string;
  lowerText: string;
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
  /** Opaque key that changes when the diff DOM content changes (e.g. diff text hash). */
  diffKey: string | null;
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
// Constants
// ---------------------------------------------------------------------------

const MIN_QUERY_LENGTH = 2;
const MAX_HITS = 5_000;
const HIGHLIGHT_WINDOW = 100;
const DEBOUNCE_MS = 100;
const INDEX_CHUNK_SIZE = 500; // rows per chunk when building index

// ---------------------------------------------------------------------------
// Phase 1 — Build index (chunked to avoid blocking the main thread)
// ---------------------------------------------------------------------------

function buildIndexChunked(
  container: HTMLElement,
  onDone: (entries: IndexEntry[]) => void,
): () => void {
  const rows = container.querySelectorAll<HTMLElement>('tr[data-file-path]');
  const entries: IndexEntry[] = [];
  let offset = 0;
  let cancelled = false;

  function processChunk(): void {
    if (cancelled) return;
    const end = Math.min(offset + INDEX_CHUNK_SIZE, rows.length);
    for (let i = offset; i < end; i += 1) {
      const row = rows[i];
      if (!row) continue;
      const ctn = row.querySelector('.d2h-code-line-ctn');
      if (!ctn) continue;
      const text = ctn.textContent ?? '';
      entries.push({
        text,
        lowerText: text.toLowerCase(),
        filePath: row.getAttribute('data-file-path') ?? '',
        lineNumber: Number(row.getAttribute('data-line-number') ?? 0),
        side: row.getAttribute('data-line-side') ?? 'right',
      });
    }
    offset = end;
    if (offset < rows.length) {
      setTimeout(processChunk, 0); // yield to event loop
    } else {
      onDone(entries);
    }
  }

  // Start after a microtask so the caller can store the cancel fn
  setTimeout(processChunk, 0);

  return () => {
    cancelled = true;
  };
}

// ---------------------------------------------------------------------------
// Phase 2 — Search (pure string matching, no DOM, capped results)
// ---------------------------------------------------------------------------

interface SearchResult {
  hits: SearchHit[];
  totalCount: number;
}

function searchIndex(index: IndexEntry[], query: string): SearchResult {
  if (query.length < MIN_QUERY_LENGTH) return { hits: [], totalCount: 0 };
  const lower = query.toLowerCase();
  const hits: SearchHit[] = [];
  let totalCount = 0;

  for (let i = 0; i < index.length; i += 1) {
    const entry = index[i];
    if (!entry) continue;
    const text = entry.lowerText;
    let pos = 0;
    while ((pos = text.indexOf(lower, pos)) !== -1) {
      totalCount += 1;
      if (hits.length < MAX_HITS) {
        hits.push({ entryIndex: i, charOffset: pos, length: query.length });
      }
      pos += query.length; // non-overlapping
    }
  }
  return { hits, totalCount };
}

// ---------------------------------------------------------------------------
// Phase 3 — Highlight (lazy, windowed around current match)
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

function resolveRow(container: HTMLElement, entry: IndexEntry): HTMLElement | null {
  return container.querySelector<HTMLElement>(
    `tr[data-file-path="${CSS.escape(entry.filePath)}"][data-line-number="${entry.lineNumber}"][data-line-side="${entry.side}"]`,
  );
}

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
  diffKey,
}: UseDiffSearchOptions): UseDiffSearchReturn {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);

  const indexRef = useRef<IndexEntry[]>([]);
  const indexReadyRef = useRef(false);
  const cancelIndexRef = useRef<(() => void) | null>(null);
  const pendingScrollRef = useRef<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // ---------- Pre-build index eagerly when diff DOM changes ----------
  useEffect(() => {
    // Cancel any in-progress indexing
    cancelIndexRef.current?.();
    indexRef.current = [];
    indexReadyRef.current = false;

    const container = containerRef.current;
    if (!container || diffKey == null) return;

    // Delay slightly so React finishes rendering the diff DOM
    const raf = requestAnimationFrame(() => {
      cancelIndexRef.current = buildIndexChunked(container, (entries) => {
        indexRef.current = entries;
        indexReadyRef.current = true;
        cancelIndexRef.current = null;
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      cancelIndexRef.current?.();
    };
  }, [containerRef, diffKey]);

  // ---------- Rebuild index when collapsed files change ----------
  useEffect(() => {
    cancelIndexRef.current?.();
    indexReadyRef.current = false;

    const container = containerRef.current;
    if (!container) return;

    const raf = requestAnimationFrame(() => {
      cancelIndexRef.current = buildIndexChunked(container, (entries) => {
        indexRef.current = entries;
        indexReadyRef.current = true;
        cancelIndexRef.current = null;

        // Re-run search with current query
        if (isSearchOpen && query.length >= MIN_QUERY_LENGTH) {
          const result = searchIndex(entries, query);
          setHits(result.hits);
          setTotalCount(result.totalCount);

          // Handle pending scroll after file expansion
          const pendingFile = pendingScrollRef.current;
          if (pendingFile) {
            pendingScrollRef.current = null;
            const targetIdx = result.hits.findIndex(
              (h) => entries[h.entryIndex]?.filePath === pendingFile,
            );
            if (targetIdx >= 0) {
              setCurrentIndex(targetIdx);
              return;
            }
          }

          setCurrentIndex((prev) =>
            result.hits.length === 0 ? 0 : Math.min(prev, result.hits.length - 1),
          );
        }
      });
    });

    return () => {
      cancelAnimationFrame(raf);
      cancelIndexRef.current?.();
    };
    // Only react to collapsedFiles changes (not query/isSearchOpen to avoid loops)
  }, [collapsedFiles, containerRef]);

  // ---------- Debounced search on query change ----------
  useEffect(() => {
    if (!isSearchOpen) return;

    clearTimeout(debounceRef.current);

    if (query.length < MIN_QUERY_LENGTH) {
      setHits([]);
      setTotalCount(0);
      setCurrentIndex(0);
      clearHighlights();
      return;
    }

    debounceRef.current = setTimeout(() => {
      if (!indexReadyRef.current) return;
      const result = searchIndex(indexRef.current, query);
      setHits(result.hits);
      setTotalCount(result.totalCount);
      setCurrentIndex(0);
    }, DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query, isSearchOpen]);

  // ---------- Apply windowed highlights ----------
  useEffect(() => {
    const container = containerRef.current;
    if (!container || hits.length === 0) {
      clearHighlights();
      return;
    }
    applyWindowedHighlights(container, indexRef.current, hits, currentIndex);
  }, [containerRef, hits, currentIndex]);

  // ---------- Scroll current match into view ----------
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

  // ---------- Public API ----------

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setIsSearchOpen(false);
    setQuery('');
    setHits([]);
    setTotalCount(0);
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
    matchCount: totalCount,
    currentMatchIndex: currentIndex,
    goToNext,
    goToPrev,
  };
}
