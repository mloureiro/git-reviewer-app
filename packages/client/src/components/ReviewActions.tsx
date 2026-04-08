import type { ReviewStatus } from '../types/review';
import { Button, type ButtonVariant } from './ui';

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
  variant: ButtonVariant;
}

// ---------------------------------------------------------------------------
// Button config per status
// ---------------------------------------------------------------------------

const ACTIONS_BY_STATUS: Record<ReviewStatus, ActionButton[]> = {
  pending: [
    { label: 'Approve', targetStatus: 'approved', variant: 'primary' },
    { label: 'Request Changes', targetStatus: 'changes_requested', variant: 'danger' },
  ],
  approved: [
    { label: 'Request Changes', targetStatus: 'changes_requested', variant: 'danger' },
    { label: 'Revert to Pending', targetStatus: 'pending', variant: 'secondary' },
  ],
  changes_requested: [
    { label: 'Approve', targetStatus: 'approved', variant: 'primary' },
    { label: 'Revert to Pending', targetStatus: 'pending', variant: 'secondary' },
  ],
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewActions({
  currentStatus,
  onStatusChange,
  disabled = false,
}: ReviewActionsProps): React.ReactNode {
  const actions = ACTIONS_BY_STATUS[currentStatus];

  return (
    <div className="review-actions">
      {actions.map((action) => (
        <Button
          key={action.targetStatus}
          variant={action.variant}
          size="sm"
          onClick={() => onStatusChange(action.targetStatus)}
          disabled={disabled}
        >
          {action.label}
        </Button>
      ))}
    </div>
  );
}
