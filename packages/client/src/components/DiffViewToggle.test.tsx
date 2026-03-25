import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DiffViewToggle } from './DiffViewToggle';

describe('DiffViewToggle', () => {
  it('renders both view mode buttons', () => {
    render(<DiffViewToggle mode="line-by-line" onChange={vi.fn()} />);

    expect(screen.getByText('Line by line')).toBeInTheDocument();
    expect(screen.getByText('Side by side')).toBeInTheDocument();
  });

  it('marks "Line by line" button as pressed when mode is line-by-line', () => {
    render(<DiffViewToggle mode="line-by-line" onChange={vi.fn()} />);

    expect(screen.getByText('Line by line')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Side by side')).toHaveAttribute('aria-pressed', 'false');
  });

  it('marks "Side by side" button as pressed when mode is side-by-side', () => {
    render(<DiffViewToggle mode="side-by-side" onChange={vi.fn()} />);

    expect(screen.getByText('Side by side')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Line by line')).toHaveAttribute('aria-pressed', 'false');
  });

  it('applies active class to the active mode button', () => {
    render(<DiffViewToggle mode="side-by-side" onChange={vi.fn()} />);

    const sideBtn = screen.getByText('Side by side');
    expect(sideBtn.className).toContain('diff-view-toggle__btn--active');

    const lineBtn = screen.getByText('Line by line');
    expect(lineBtn.className).not.toContain('diff-view-toggle__btn--active');
  });

  it('calls onChange with "line-by-line" when "Line by line" is clicked', () => {
    const onChange = vi.fn();
    render(<DiffViewToggle mode="side-by-side" onChange={onChange} />);

    fireEvent.click(screen.getByText('Line by line'));

    expect(onChange).toHaveBeenCalledWith('line-by-line');
  });

  it('calls onChange with "side-by-side" when "Side by side" is clicked', () => {
    const onChange = vi.fn();
    render(<DiffViewToggle mode="line-by-line" onChange={onChange} />);

    fireEvent.click(screen.getByText('Side by side'));

    expect(onChange).toHaveBeenCalledWith('side-by-side');
  });

  it('has accessible role group with label', () => {
    render(<DiffViewToggle mode="line-by-line" onChange={vi.fn()} />);

    const group = screen.getByRole('group', { name: 'Diff view mode' });
    expect(group).toBeInTheDocument();
  });
});
