import type { ReviewStatus } from '../types/review';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewActionsProps {
  currentStatus: ReviewStatus;
  onStatusChange: (status: ReviewStatus) => void;
  disabled?: boolean;
}

interface ActionButton {
  label: string;
  targetStatus: ReviewStatus;
  variant: 'approve' | 'request-changes' | 'revert';
}

// ---------------------------------------------------------------------------
// Button config per status
// ---------------------------------------------------------------------------

const ACTIONS_BY_STATUS: Record<ReviewStatus, ActionButton[]> = {
  pending: [
    { label: 'Approve', targetStatus: 'approved', variant: 'approve' },
    { label: 'Request Changes', targetStatus: 'changes_requested', variant: 'request-changes' },
  ],
  approved: [
    { label: 'Request Changes', targetStatus: 'changes_requested', variant: 'request-changes' },
    { label: 'Revert to Pending', targetStatus: 'pending', variant: 'revert' },
  ],
  changes_requested: [
    { label: 'Approve', targetStatus: 'approved', variant: 'approve' },
    { label: 'Revert to Pending', targetStatus: 'pending', variant: 'revert' },
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewActions({
  currentStatus,
  onStatusChange,
  disabled = false,
}: ReviewActionsProps) {
  const actions = ACTIONS_BY_STATUS[currentStatus];

  return (
    <div className="review-actions">
      {actions.map((action) => (
        <button
          key={action.targetStatus}
          type="button"
          className={`btn review-actions__btn review-actions__btn--${action.variant}`}
          onClick={() => onStatusChange(action.targetStatus)}
          disabled={disabled}
        >
          {action.label}
        </button>
      ))}
    </div>
  );
}
