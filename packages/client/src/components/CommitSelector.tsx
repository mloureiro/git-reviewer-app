import type { CommitInfo } from '../types/review';
import { IconButton } from './ui';

interface CommitSelectorProps {
  commits: CommitInfo[];
  /** Index of the selected commit, or `null` when showing all changes. */
  selectedIndex: number | null;
  /** Called when the user selects a commit by index, or `null` for "all changes". */
  onSelect: (index: number | null) => void;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen - 1) + '\u2026';
}

export function CommitSelector({ commits, selectedIndex, onSelect }: CommitSelectorProps) {
  if (commits.length === 0) {
    return null;
  }

  const isAllChanges = selectedIndex === null;

  function handlePrev(): void {
    if (selectedIndex === null) {
      // From "all changes", go to last commit
      onSelect(commits.length - 1);
    } else if (selectedIndex > 0) {
      onSelect(selectedIndex - 1);
    }
  }

  function handleNext(): void {
    if (selectedIndex === null) {
      // From "all changes", go to first commit
      onSelect(0);
    } else if (selectedIndex < commits.length - 1) {
      onSelect(selectedIndex + 1);
    } else {
      // Past last commit, go back to "all changes"
      onSelect(null);
    }
  }

  function handleSelectChange(e: React.ChangeEvent<HTMLSelectElement>): void {
    const value = e.target.value;
    if (value === 'all') {
      onSelect(null);
    } else {
      onSelect(Number(value));
    }
  }

  const selectedCommit = selectedIndex !== null ? commits[selectedIndex] : null;

  return (
    <div className="commit-selector">
      <div className="commit-selector__controls">
        <IconButton
          variant="secondary"
          size="md"
          onClick={handlePrev}
          disabled={isAllChanges}
          title="Previous commit"
          aria-label="Previous commit"
        >
          &#8249;
        </IconButton>

        <select
          className="commit-selector__dropdown"
          value={selectedIndex !== null ? String(selectedIndex) : 'all'}
          onChange={handleSelectChange}
        >
          <option value="all">All changes ({commits.length} commits)</option>
          {commits.map((commit, idx) => (
            <option key={commit.hash} value={String(idx)}>
              {commit.shortHash} — {truncate(commit.message, 60)}
            </option>
          ))}
        </select>

        <IconButton
          variant="secondary"
          size="md"
          onClick={handleNext}
          disabled={isAllChanges && commits.length === 0}
          title="Next commit"
          aria-label="Next commit"
        >
          &#8250;
        </IconButton>
      </div>

      {selectedCommit != null && (
        <div className="commit-selector__info">
          <span className="commit-selector__position">
            Commit {(selectedIndex ?? 0) + 1} of {commits.length}
          </span>
          <span className="commit-selector__author">{selectedCommit.author}</span>
        </div>
      )}
    </div>
  );
}
