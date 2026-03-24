import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { StatusBadge } from './StatusBadge';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('StatusBadge', () => {
  describe('pending status', () => {
    it('renders the "Pending" label', () => {
      render(<StatusBadge status="pending" />);

      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    it('applies the status-specific CSS class', () => {
      const { container } = render(<StatusBadge status="pending" />);

      const badge = container.querySelector('.status-badge');
      expect(badge).toHaveClass('status-badge--pending');
    });
  });

  describe('approved status', () => {
    it('renders the "Approved" label', () => {
      render(<StatusBadge status="approved" />);

      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    it('applies the status-specific CSS class', () => {
      const { container } = render(<StatusBadge status="approved" />);

      const badge = container.querySelector('.status-badge');
      expect(badge).toHaveClass('status-badge--approved');
    });
  });

  describe('changes_requested status', () => {
    it('renders the "Changes Requested" label', () => {
      render(<StatusBadge status="changes_requested" />);

      expect(screen.getByText('Changes Requested')).toBeInTheDocument();
    });

    it('applies the status-specific CSS class', () => {
      const { container } = render(<StatusBadge status="changes_requested" />);

      const badge = container.querySelector('.status-badge');
      expect(badge).toHaveClass('status-badge--changes_requested');
    });
  });

  it('renders a <span> element', () => {
    const { container } = render(<StatusBadge status="pending" />);

    expect(container.firstChild?.nodeName).toBe('SPAN');
  });

  it('always applies the base status-badge class regardless of status', () => {
    const statuses = ['pending', 'approved', 'changes_requested'] as const;

    for (const status of statuses) {
      const { container, unmount } = render(<StatusBadge status={status} />);
      expect(container.querySelector('.status-badge')).toBeInTheDocument();
      unmount();
    }
  });
});
