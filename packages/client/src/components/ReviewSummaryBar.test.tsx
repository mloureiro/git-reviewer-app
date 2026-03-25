import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ReviewSummaryBar } from './ReviewSummaryBar';

describe('ReviewSummaryBar', () => {
  it('renders the status badge for the current status', () => {
    render(<ReviewSummaryBar status="pending" stats={{ total: 0, unresolved: 0 }} />);

    // StatusBadge renders the human-readable label
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('renders singular "comment" label when total is 1', () => {
    render(<ReviewSummaryBar status="pending" stats={{ total: 1, unresolved: 0 }} />);

    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('comment')).toBeInTheDocument();
  });

  it('renders plural "comments" label when total is not 1', () => {
    render(<ReviewSummaryBar status="approved" stats={{ total: 3, unresolved: 0 }} />);

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('comments')).toBeInTheDocument();
  });

  it('renders unresolved count when unresolved > 0', () => {
    render(<ReviewSummaryBar status="changes_requested" stats={{ total: 5, unresolved: 2 }} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('unresolved')).toBeInTheDocument();
  });

  it('does not render unresolved count when unresolved is 0', () => {
    render(<ReviewSummaryBar status="approved" stats={{ total: 5, unresolved: 0 }} />);

    expect(screen.queryByText('unresolved')).toBeNull();
  });

  it('renders approved status badge', () => {
    render(<ReviewSummaryBar status="approved" stats={{ total: 0, unresolved: 0 }} />);

    expect(screen.getByText('Approved')).toBeInTheDocument();
  });

  it('renders changes_requested status badge', () => {
    render(<ReviewSummaryBar status="changes_requested" stats={{ total: 0, unresolved: 0 }} />);

    expect(screen.getByText('Changes Requested')).toBeInTheDocument();
  });
});
