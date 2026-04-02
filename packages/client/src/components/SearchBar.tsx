import { useState, useRef, useEffect, useCallback } from 'react';

const DEBOUNCE_MS = 80;

interface SearchBarProps {
  isOpen: boolean;
  onQueryChange: (q: string) => void;
  matchCount: number;
  currentMatchIndex: number;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function SearchBar({
  isOpen,
  onQueryChange,
  matchCount,
  currentMatchIndex,
  onNext,
  onPrev,
  onClose,
}: SearchBarProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [localValue, setLocalValue] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Autofocus input when opened
  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => inputRef.current?.focus());
    } else {
      setLocalValue('');
    }
  }, [isOpen]);

  // Debounce: push query to parent after typing settles
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = e.target.value;
      setLocalValue(val); // instant local update
      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        onQueryChange(val);
      }, DEBOUNCE_MS);
    },
    [onQueryChange],
  );

  // Cleanup debounce on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), []);

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
      // Flush any pending debounce before navigating
      clearTimeout(debounceRef.current);
      onQueryChange(localValue);
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
    localValue.length === 0
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
        placeholder={`Find in diff\u2026`}
        value={localValue}
        onChange={handleChange}
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
