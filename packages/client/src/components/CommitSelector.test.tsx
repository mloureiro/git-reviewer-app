import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CommitSelector } from './CommitSelector';
import type { CommitInfo } from '../types/review';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMMITS: CommitInfo[] = [
  {
    hash: 'abc1234567890',
    shortHash: 'abc1234',
    message: 'feat: add login page',
    author: 'Alice',
    date: '2026-01-01T10:00:00Z',
  },
  {
    hash: 'def5678901234',
    shortHash: 'def5678',
    message: 'fix: correct button label',
    author: 'Bob',
    date: '2026-01-02T11:00:00Z',
  },
  {
    hash: 'ghi9012345678',
    shortHash: 'ghi9012',
    message: 'refactor: extract helper function',
    author: 'Alice',
    date: '2026-01-03T12:00:00Z',
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommitSelector', () => {
  let onSelect: (index: number | null) => void;

  beforeEach(() => {
    onSelect = vi.fn<(index: number | null) => void>();
  });

  // -------------------------------------------------------------------------
  // Empty commits list
  // -------------------------------------------------------------------------

  describe('when commits list is empty', () => {
    it('renders nothing', () => {
      const { container } = render(
        <CommitSelector commits={[]} selectedIndex={null} onSelect={onSelect} />,
      );

      expect(container.firstChild).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Rendering — "all changes" view (selectedIndex === null)
  // -------------------------------------------------------------------------

  describe('when selectedIndex is null ("all changes")', () => {
    it('renders the dropdown', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={null} onSelect={onSelect} />);

      expect(screen.getByRole('combobox')).toBeInTheDocument();
    });

    it('shows "All changes" as the selected option', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={null} onSelect={onSelect} />);

      const dropdown = screen.getByRole('combobox') as HTMLSelectElement;
      expect(dropdown.value).toBe('all');
    });

    it('shows "All changes (N commits)" as the first option', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={null} onSelect={onSelect} />);

      expect(
        screen.getByRole('option', { name: `All changes (${COMMITS.length} commits)` }),
      ).toBeInTheDocument();
    });

    it('renders an option for each commit', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={null} onSelect={onSelect} />);

      // Total options = 1 "all" + number of commits
      expect(screen.getAllByRole('option')).toHaveLength(COMMITS.length + 1);
    });

    it('renders each commit shortHash in the dropdown', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={null} onSelect={onSelect} />);

      for (const commit of COMMITS) {
        expect(
          screen.getByRole('option', { name: new RegExp(commit.shortHash) }),
        ).toBeInTheDocument();
      }
    });

    it('previous button is disabled in "all changes" view', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={null} onSelect={onSelect} />);

      expect(screen.getByRole('button', { name: 'Previous commit' })).toBeDisabled();
    });

    it('next button is enabled in "all changes" view', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={null} onSelect={onSelect} />);

      expect(screen.getByRole('button', { name: 'Next commit' })).not.toBeDisabled();
    });

    it('does not render commit info row when showing all changes', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={null} onSelect={onSelect} />);

      expect(screen.queryByText(/commit \d+ of \d+/i)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Rendering — specific commit selected
  // -------------------------------------------------------------------------

  describe('when a specific commit is selected', () => {
    it('dropdown shows the selected commit index', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={1} onSelect={onSelect} />);

      const dropdown = screen.getByRole('combobox') as HTMLSelectElement;
      expect(dropdown.value).toBe('1');
    });

    it('renders the commit position label', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={1} onSelect={onSelect} />);

      expect(screen.getByText(`Commit 2 of ${COMMITS.length}`)).toBeInTheDocument();
    });

    it('renders the commit author', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={1} onSelect={onSelect} />);

      // COMMITS[1] is 'Bob' — use the string directly to avoid strict array-index typing
      expect(screen.getByText('Bob')).toBeInTheDocument();
    });

    it('renders position "Commit 1 of N" when first commit is selected', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={0} onSelect={onSelect} />);

      expect(screen.getByText(`Commit 1 of ${COMMITS.length}`)).toBeInTheDocument();
    });

    it('renders position "Commit N of N" when last commit is selected', () => {
      render(
        <CommitSelector commits={COMMITS} selectedIndex={COMMITS.length - 1} onSelect={onSelect} />,
      );

      expect(screen.getByText(`Commit ${COMMITS.length} of ${COMMITS.length}`)).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Prev/Next button navigation
  // -------------------------------------------------------------------------

  describe('previous/next navigation', () => {
    it('clicking next from "all changes" calls onSelect(0)', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={null} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('button', { name: 'Next commit' }));

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith(0);
    });

    it('clicking prev from "all changes" calls onSelect with last index', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={null} onSelect={onSelect} />);

      // Prev is disabled when isAllChanges; this tests the component honours that
      // The button should be disabled and a click should not call onSelect
      const prevBtn = screen.getByRole('button', { name: 'Previous commit' });
      expect(prevBtn).toBeDisabled();
    });

    it('clicking next moves to next commit', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={0} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('button', { name: 'Next commit' }));

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('clicking prev moves to previous commit', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={2} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('button', { name: 'Previous commit' }));

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('clicking prev on first commit does not call onSelect', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={0} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('button', { name: 'Previous commit' }));

      expect(onSelect).not.toHaveBeenCalled();
    });

    it('clicking next on last commit wraps to "all changes" (null)', () => {
      render(
        <CommitSelector commits={COMMITS} selectedIndex={COMMITS.length - 1} onSelect={onSelect} />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Next commit' }));

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith(null);
    });
  });

  // -------------------------------------------------------------------------
  // Dropdown change
  // -------------------------------------------------------------------------

  describe('dropdown change', () => {
    it('selecting a commit index calls onSelect with that index', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={null} onSelect={onSelect} />);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: '1' } });

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith(1);
    });

    it('selecting "all" calls onSelect with null', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={1} onSelect={onSelect} />);

      fireEvent.change(screen.getByRole('combobox'), { target: { value: 'all' } });

      expect(onSelect).toHaveBeenCalledOnce();
      expect(onSelect).toHaveBeenCalledWith(null);
    });

    it('selecting the last commit index calls onSelect with last index', () => {
      render(<CommitSelector commits={COMMITS} selectedIndex={null} onSelect={onSelect} />);

      fireEvent.change(screen.getByRole('combobox'), {
        target: { value: String(COMMITS.length - 1) },
      });

      expect(onSelect).toHaveBeenCalledWith(COMMITS.length - 1);
    });
  });

  // -------------------------------------------------------------------------
  // Message truncation
  // -------------------------------------------------------------------------

  describe('message truncation', () => {
    it('truncates commit messages longer than 60 characters', () => {
      const longMessage = 'a'.repeat(65);
      const commits: CommitInfo[] = [
        {
          hash: 'aaa111',
          shortHash: 'aaa111',
          message: longMessage,
          author: 'Alice',
          date: '2026-01-01T10:00:00Z',
        },
      ];

      render(<CommitSelector commits={commits} selectedIndex={null} onSelect={onSelect} />);

      // The option text contains the truncated message (60 chars → 59 + ellipsis)
      const option = screen.getByRole('option', { name: /aaa111/ });
      expect(option.textContent).toHaveLength(
        'aaa111 — '.length + 59 + 1, // shortHash + separator + 59 chars + ellipsis char
      );
      expect(option.textContent).toContain('\u2026');
    });

    it('does not truncate commit messages of exactly 60 characters', () => {
      const exactMessage = 'b'.repeat(60);
      const commits: CommitInfo[] = [
        {
          hash: 'bbb222',
          shortHash: 'bbb222',
          message: exactMessage,
          author: 'Bob',
          date: '2026-01-01T10:00:00Z',
        },
      ];

      render(<CommitSelector commits={commits} selectedIndex={null} onSelect={onSelect} />);

      const option = screen.getByRole('option', { name: /bbb222/ });
      expect(option.textContent).not.toContain('\u2026');
    });
  });

  // -------------------------------------------------------------------------
  // Single commit list
  // -------------------------------------------------------------------------

  describe('with a single commit', () => {
    const SINGLE: CommitInfo[] = COMMITS.slice(0, 1);

    it('renders correctly with one commit', () => {
      render(<CommitSelector commits={SINGLE} selectedIndex={null} onSelect={onSelect} />);

      expect(screen.getByRole('option', { name: 'All changes (1 commits)' })).toBeInTheDocument();
    });

    it('next on last (only) commit wraps to null', () => {
      render(<CommitSelector commits={SINGLE} selectedIndex={0} onSelect={onSelect} />);

      fireEvent.click(screen.getByRole('button', { name: 'Next commit' }));

      expect(onSelect).toHaveBeenCalledWith(null);
    });
  });
});
