import { useRef, useEffect } from 'react';

interface SearchBarProps {
  isOpen: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function SearchBar({
  isOpen,
  query,
  onQueryChange,
  matchCount,
  currentMatchIndex,
  onNext,
  onPrev,
  onClose,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Autofocus input when opened
  useEffect(() => {
    if (isOpen) {
      // Short delay so the element is rendered before focusing
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      onPrev();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      onNext();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      onNext();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      onPrev();
    }
  }

  const countLabel =
    query.length === 0
      ? ''
      : matchCount === 0
        ? 'No results'
        : `${currentMatchIndex + 1} of ${matchCount}`;

  return (
    <div className="search-bar" role="search">
      <input
        ref={inputRef}
        className="search-bar__input"
        type="text"
        placeholder="Find in diff\u2026"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Search diff content"
        spellCheck={false}
        autoComplete="off"
      />
      {countLabel && <span className="search-bar__count">{countLabel}</span>}
      <button
        className="search-bar__nav-btn"
        type="button"
        onClick={onPrev}
        disabled={matchCount === 0}
        title="Previous match (Shift+Enter)"
        aria-label="Previous match"
      >
        &uarr;
      </button>
      <button
        className="search-bar__nav-btn"
        type="button"
        onClick={onNext}
        disabled={matchCount === 0}
        title="Next match (Enter)"
        aria-label="Next match"
      >
        &darr;
      </button>
      <button
        className="search-bar__close-btn"
        type="button"
        onClick={onClose}
        title="Close (Escape)"
        aria-label="Close search"
      >
        ✕
      </button>
    </div>
  );
}
