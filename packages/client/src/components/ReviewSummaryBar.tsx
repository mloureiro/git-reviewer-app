import type { ReviewStatus, ReviewSummaryStats } from '../types/review';
import { StatusBadge } from './StatusBadge';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewSummaryBarProps {
  status: ReviewStatus;
  stats: ReviewSummaryStats;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ReviewSummaryBar({ status, stats }: ReviewSummaryBarProps): React.ReactNode {
  const { total, unresolved } = stats;

  return (
    <div className="review-summary-bar">
      <StatusBadge status={status} />

      <div className="review-summary-bar__counts">
        <span className="review-summary-bar__count">
          <span className="review-summary-bar__count-value">{total}</span>
          <span className="review-summary-bar__count-label">
            {total === 1 ? 'comment' : 'comments'}
          </span>
        </span>

        {unresolved > 0 && (
          <span className="review-summary-bar__count review-summary-bar__count--unresolved">
            <span className="review-summary-bar__count-value">{unresolved}</span>
            <span className="review-summary-bar__count-label">unresolved</span>
          </span>
        )}
      </div>
    </div>
  );
}
