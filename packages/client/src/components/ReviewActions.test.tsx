import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { ReviewActions } from './ReviewActions';
import type { ReviewStatus } from '../types/review';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ReviewActions', () => {
  let onStatusChange: (status: ReviewStatus) => void;

  beforeEach(() => {
    onStatusChange = vi.fn<(status: ReviewStatus) => void>();
  });

  // -------------------------------------------------------------------------
  // Button visibility per status
  // -------------------------------------------------------------------------

  describe('when status is "pending"', () => {
    it('shows the "Approve" button', () => {
      render(<ReviewActions currentStatus="pending" onStatusChange={onStatusChange} />);

      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    });

    it('shows the "Request Changes" button', () => {
      render(<ReviewActions currentStatus="pending" onStatusChange={onStatusChange} />);

      expect(screen.getByRole('button', { name: 'Request Changes' })).toBeInTheDocument();
    });

    it('does not show the "Revert to Pending" button', () => {
      render(<ReviewActions currentStatus="pending" onStatusChange={onStatusChange} />);

      expect(screen.queryByRole('button', { name: 'Revert to Pending' })).toBeNull();
    });

    it('renders exactly two buttons', () => {
      render(<ReviewActions currentStatus="pending" onStatusChange={onStatusChange} />);

      expect(screen.getAllByRole('button')).toHaveLength(2);
    });
  });

  describe('when status is "approved"', () => {
    it('shows the "Request Changes" button', () => {
      render(<ReviewActions currentStatus="approved" onStatusChange={onStatusChange} />);

      expect(screen.getByRole('button', { name: 'Request Changes' })).toBeInTheDocument();
    });

    it('shows the "Revert to Pending" button', () => {
      render(<ReviewActions currentStatus="approved" onStatusChange={onStatusChange} />);

      expect(screen.getByRole('button', { name: 'Revert to Pending' })).toBeInTheDocument();
    });

    it('does not show the "Approve" button', () => {
      render(<ReviewActions currentStatus="approved" onStatusChange={onStatusChange} />);

      expect(screen.queryByRole('button', { name: 'Approve' })).toBeNull();
    });

    it('renders exactly two buttons', () => {
      render(<ReviewActions currentStatus="approved" onStatusChange={onStatusChange} />);

      expect(screen.getAllByRole('button')).toHaveLength(2);
    });
  });

  describe('when status is "changes_requested"', () => {
    it('shows the "Approve" button', () => {
      render(<ReviewActions currentStatus="changes_requested" onStatusChange={onStatusChange} />);

      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    });

    it('shows the "Revert to Pending" button', () => {
      render(<ReviewActions currentStatus="changes_requested" onStatusChange={onStatusChange} />);

      expect(screen.getByRole('button', { name: 'Revert to Pending' })).toBeInTheDocument();
    });

    it('does not show the "Request Changes" button', () => {
      render(<ReviewActions currentStatus="changes_requested" onStatusChange={onStatusChange} />);

      expect(screen.queryByRole('button', { name: 'Request Changes' })).toBeNull();
    });

    it('renders exactly two buttons', () => {
      render(<ReviewActions currentStatus="changes_requested" onStatusChange={onStatusChange} />);

      expect(screen.getAllByRole('button')).toHaveLength(2);
    });
  });

  // -------------------------------------------------------------------------
  // Click handlers call onStatusChange with the correct target status
  // -------------------------------------------------------------------------

  describe('button click handlers', () => {
    it('clicking "Approve" calls onStatusChange with "approved"', () => {
      render(<ReviewActions currentStatus="pending" onStatusChange={onStatusChange} />);

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

      expect(onStatusChange).toHaveBeenCalledOnce();
      expect(onStatusChange).toHaveBeenCalledWith('approved');
    });

    it('clicking "Request Changes" calls onStatusChange with "changes_requested"', () => {
      render(<ReviewActions currentStatus="pending" onStatusChange={onStatusChange} />);

      fireEvent.click(screen.getByRole('button', { name: 'Request Changes' }));

      expect(onStatusChange).toHaveBeenCalledOnce();
      expect(onStatusChange).toHaveBeenCalledWith('changes_requested');
    });

    it('clicking "Revert to Pending" calls onStatusChange with "pending"', () => {
      render(<ReviewActions currentStatus="approved" onStatusChange={onStatusChange} />);

      fireEvent.click(screen.getByRole('button', { name: 'Revert to Pending' }));

      expect(onStatusChange).toHaveBeenCalledOnce();
      expect(onStatusChange).toHaveBeenCalledWith('pending');
    });

    it('clicking "Approve" from changes_requested calls onStatusChange with "approved"', () => {
      render(<ReviewActions currentStatus="changes_requested" onStatusChange={onStatusChange} />);

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

      expect(onStatusChange).toHaveBeenCalledOnce();
      expect(onStatusChange).toHaveBeenCalledWith('approved');
    });

    it('clicking "Request Changes" from approved calls onStatusChange with "changes_requested"', () => {
      render(<ReviewActions currentStatus="approved" onStatusChange={onStatusChange} />);

      fireEvent.click(screen.getByRole('button', { name: 'Request Changes' }));

      expect(onStatusChange).toHaveBeenCalledOnce();
      expect(onStatusChange).toHaveBeenCalledWith('changes_requested');
    });
  });

  // -------------------------------------------------------------------------
  // Disabled state
  // -------------------------------------------------------------------------

  describe('disabled prop', () => {
    it('all buttons are enabled by default', () => {
      render(<ReviewActions currentStatus="pending" onStatusChange={onStatusChange} />);

      for (const btn of screen.getAllByRole('button')) {
        expect(btn).not.toBeDisabled();
      }
    });

    it('all buttons are disabled when disabled=true', () => {
      render(<ReviewActions currentStatus="pending" onStatusChange={onStatusChange} disabled />);

      for (const btn of screen.getAllByRole('button')) {
        expect(btn).toBeDisabled();
      }
    });

    it('does not call onStatusChange when a disabled button is clicked', () => {
      render(<ReviewActions currentStatus="pending" onStatusChange={onStatusChange} disabled />);

      fireEvent.click(screen.getByRole('button', { name: 'Approve' }));

      expect(onStatusChange).not.toHaveBeenCalled();
    });
  });
});
