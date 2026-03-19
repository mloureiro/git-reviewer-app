import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { CommentThread } from './CommentThread';
import type { ReviewComment } from '../types/review';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps the component in <table><tbody> because CommentThread renders
 * a <tr> element, which requires valid table DOM ancestors.
 */
function renderInTable(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <table>
        <tbody>{children}</tbody>
      </table>
    ),
  });
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

/**
 * Returns a createdAt ISO string for a comment created N seconds ago.
 * Using a small value keeps us in the "just now" branch of formatTimestamp.
 */
function secondsAgo(n: number): string {
  return new Date(Date.now() - n * 1000).toISOString();
}

const UNRESOLVED_COMMENT: ReviewComment = {
  id: 'comment-1',
  file: 'src/auth/middleware.ts',
  line: 42,
  side: 'right',
  body: 'This needs error handling for expired tokens.',
  author: 'marcos',
  createdAt: secondsAgo(10),
  resolved: false,
};

const RESOLVED_COMMENT: ReviewComment = {
  id: 'comment-2',
  file: 'src/auth/middleware.ts',
  line: 55,
  side: 'left',
  body: 'Fixed in the next commit.',
  author: 'alice',
  createdAt: secondsAgo(5),
  resolved: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommentThread', () => {
  let onResolve: (commentId: string, resolved: boolean) => void;
  let onReply: () => void;

  beforeEach(() => {
    onResolve = vi.fn<(commentId: string, resolved: boolean) => void>();
    onReply = vi.fn<() => void>();
  });

  it('renders all comments with author, body, and timestamp', () => {
    renderInTable(
      <CommentThread comments={[UNRESOLVED_COMMENT, RESOLVED_COMMENT]} onResolve={onResolve} />,
    );

    // Authors
    expect(screen.getByText('marcos')).toBeInTheDocument();
    expect(screen.getByText('alice')).toBeInTheDocument();

    // Bodies
    expect(screen.getByText(UNRESOLVED_COMMENT.body)).toBeInTheDocument();
    expect(screen.getByText(RESOLVED_COMMENT.body)).toBeInTheDocument();

    // Timestamps — both are within 60 s so formatTimestamp returns "just now"
    expect(screen.getAllByText('just now')).toHaveLength(2);
  });

  it('renders a "Resolve" button for unresolved comments', () => {
    renderInTable(<CommentThread comments={[UNRESOLVED_COMMENT]} onResolve={onResolve} />);

    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument();
  });

  it('renders an "Unresolve" button for resolved comments', () => {
    renderInTable(<CommentThread comments={[RESOLVED_COMMENT]} onResolve={onResolve} />);

    expect(screen.getByRole('button', { name: 'Unresolve' })).toBeInTheDocument();
  });

  it('shows the "Resolved" badge only on resolved comments', () => {
    renderInTable(
      <CommentThread comments={[UNRESOLVED_COMMENT, RESOLVED_COMMENT]} onResolve={onResolve} />,
    );

    // Only the resolved comment shows the badge
    expect(screen.getAllByText('Resolved')).toHaveLength(1);
  });

  it('calls onResolve with the comment id and resolved=true when clicking Resolve', () => {
    renderInTable(<CommentThread comments={[UNRESOLVED_COMMENT]} onResolve={onResolve} />);

    fireEvent.click(screen.getByRole('button', { name: 'Resolve' }));

    expect(onResolve).toHaveBeenCalledOnce();
    expect(onResolve).toHaveBeenCalledWith(UNRESOLVED_COMMENT.id, true);
  });

  it('calls onResolve with the comment id and resolved=false when clicking Unresolve', () => {
    renderInTable(<CommentThread comments={[RESOLVED_COMMENT]} onResolve={onResolve} />);

    fireEvent.click(screen.getByRole('button', { name: 'Unresolve' }));

    expect(onResolve).toHaveBeenCalledOnce();
    expect(onResolve).toHaveBeenCalledWith(RESOLVED_COMMENT.id, false);
  });

  it('renders a Reply button when onReply prop is provided', () => {
    renderInTable(
      <CommentThread comments={[UNRESOLVED_COMMENT]} onResolve={onResolve} onReply={onReply} />,
    );

    expect(screen.getByRole('button', { name: 'Reply' })).toBeInTheDocument();
  });

  it('does not render a Reply button when onReply prop is undefined', () => {
    renderInTable(<CommentThread comments={[UNRESOLVED_COMMENT]} onResolve={onResolve} />);

    expect(screen.queryByRole('button', { name: 'Reply' })).toBeNull();
  });

  it('calls onReply when the Reply button is clicked', () => {
    renderInTable(
      <CommentThread comments={[UNRESOLVED_COMMENT]} onResolve={onResolve} onReply={onReply} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Reply' }));

    expect(onReply).toHaveBeenCalledOnce();
    expect(onResolve).not.toHaveBeenCalled();
  });

  it('renders an empty thread without errors when given no comments', () => {
    const { container } = renderInTable(
      <CommentThread comments={[]} onResolve={onResolve} onReply={onReply} />,
    );

    // The row itself should still render
    expect(container.querySelector('.comment-thread')).toBeInTheDocument();
    // No comment items
    expect(container.querySelectorAll('.comment-thread__item')).toHaveLength(0);
  });

  it('passes the correct resolve call for each comment in a multi-comment thread', () => {
    renderInTable(
      <CommentThread comments={[UNRESOLVED_COMMENT, RESOLVED_COMMENT]} onResolve={onResolve} />,
    );

    const resolveBtn = screen.getByRole('button', { name: 'Resolve' });
    const unresolveBtn = screen.getByRole('button', { name: 'Unresolve' });

    fireEvent.click(resolveBtn);
    expect(onResolve).toHaveBeenLastCalledWith(UNRESOLVED_COMMENT.id, true);

    fireEvent.click(unresolveBtn);
    expect(onResolve).toHaveBeenLastCalledWith(RESOLVED_COMMENT.id, false);

    expect(onResolve).toHaveBeenCalledTimes(2);
  });
});
