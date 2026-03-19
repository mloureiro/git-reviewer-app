import type { ReviewStatus, ReviewStatusMetaMap } from '../types/review';

const STATUS_META: ReviewStatusMetaMap = {
  pending: { label: 'Pending', variant: 'neutral' },
  approved: { label: 'Approved', variant: 'success' },
  changes_requested: { label: 'Changes Requested', variant: 'warning' },
};

interface StatusBadgeProps {
  status: ReviewStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const { label } = STATUS_META[status];
  return <span className={`status-badge status-badge--${status}`}>{label}</span>;
}
