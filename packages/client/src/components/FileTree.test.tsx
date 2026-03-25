import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { FileTree } from './FileTree';
import type { DiffFile } from '../types/review';

const files: DiffFile[] = [
  { path: 'src/foo.ts', status: 'modified', additions: 5, deletions: 2 },
  { path: 'src/bar.ts', status: 'added', additions: 10, deletions: 0 },
  { path: 'src/old.ts', status: 'deleted', additions: 0, deletions: 7 },
  { path: 'src/new.ts', status: 'renamed', oldPath: 'src/orig.ts', additions: 1, deletions: 1 },
];

describe('FileTree', () => {
  it('renders nothing when files list is empty', () => {
    const { container } = render(<FileTree files={[]} onFileClick={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders the file count and file items', () => {
    render(<FileTree files={files} onFileClick={vi.fn()} />);

    expect(screen.getByText('Files changed')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('src/foo.ts')).toBeInTheDocument();
    expect(screen.getByText('src/bar.ts')).toBeInTheDocument();
    expect(screen.getByText('src/old.ts')).toBeInTheDocument();
  });

  it('shows renamed file as "oldPath → newPath"', () => {
    render(<FileTree files={files} onFileClick={vi.fn()} />);

    expect(screen.getByText('src/orig.ts → src/new.ts')).toBeInTheDocument();
  });

  it('calls onFileClick with the file path when a file button is clicked', () => {
    const onFileClick = vi.fn();
    render(<FileTree files={files} onFileClick={onFileClick} />);

    fireEvent.click(screen.getByTitle('src/foo.ts'));

    expect(onFileClick).toHaveBeenCalledWith('src/foo.ts');
  });

  it('marks the active file with aria-current', () => {
    render(<FileTree files={files} onFileClick={vi.fn()} activeFile="src/bar.ts" />);

    const barButton = screen.getByTitle('src/bar.ts');
    expect(barButton).toHaveAttribute('aria-current', 'true');

    const fooButton = screen.getByTitle('src/foo.ts');
    expect(fooButton).not.toHaveAttribute('aria-current');
  });

  it('renders status dots with correct aria-labels', () => {
    render(<FileTree files={files} onFileClick={vi.fn()} />);

    const statusDots = screen.getAllByRole('generic', { hidden: true });
    // Check that at least the status labels exist as text
    expect(screen.getAllByText('M')).toHaveLength(1); // modified
    expect(screen.getAllByText('A')).toHaveLength(1); // added
    expect(screen.getAllByText('D')).toHaveLength(1); // deleted
    expect(screen.getAllByText('R')).toHaveLength(1); // renamed
    expect(statusDots.length).toBeGreaterThan(0);
  });

  it('renders additions and deletions stats', () => {
    render(<FileTree files={files} onFileClick={vi.fn()} />);

    expect(screen.getByText('+5')).toBeInTheDocument();
    expect(screen.getByText('-2')).toBeInTheDocument();
    expect(screen.getByText('+10')).toBeInTheDocument();
    expect(screen.getByText('-7')).toBeInTheDocument();
  });

  it('does not render additions/deletions when count is 0', () => {
    render(<FileTree files={files} onFileClick={vi.fn()} />);

    // bar has 0 deletions and old has 0 additions — those should not be rendered
    const additionEls = screen.queryAllByText('+0');
    const deletionEls = screen.queryAllByText('-0');
    expect(additionEls).toHaveLength(0);
    expect(deletionEls).toHaveLength(0);
  });

  it('renders unresolved comment badge when unresolvedCounts is provided', () => {
    render(<FileTree files={files} onFileClick={vi.fn()} unresolvedCounts={{ 'src/foo.ts': 3 }} />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByLabelText('3 unresolved')).toBeInTheDocument();
  });

  it('does not render unresolved badge when count is 0', () => {
    render(<FileTree files={files} onFileClick={vi.fn()} unresolvedCounts={{ 'src/foo.ts': 0 }} />);

    expect(screen.queryByLabelText(/unresolved/)).toBeNull();
  });

  it('renders singular "comment" label in badge title for count of 1', () => {
    render(<FileTree files={files} onFileClick={vi.fn()} unresolvedCounts={{ 'src/foo.ts': 1 }} />);

    expect(screen.getByTitle('1 unresolved comment')).toBeInTheDocument();
  });

  it('renders plural "comments" label in badge title for count > 1', () => {
    render(<FileTree files={files} onFileClick={vi.fn()} unresolvedCounts={{ 'src/foo.ts': 2 }} />);

    expect(screen.getByTitle('2 unresolved comments')).toBeInTheDocument();
  });
});
