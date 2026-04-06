import type { ReviewComment } from '../types/review';
import { Button } from './ui';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a createdAt ISO string into a human-readable relative timestamp.
 * Falls back to a simple absolute date if the duration is large.
 */
function formatTimestamp(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return 'just now';
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CommentThreadProps {
  comments: ReviewComment[];
  onResolve: (commentId: string, resolved: boolean) => void;
  onReply?: () => void;
  colSpan?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentThread({ comments, onResolve, onReply, colSpan = 3 }: CommentThreadProps) {
  return (
    <tr className="comment-thread-row">
      <td className="comment-thread-cell" colSpan={colSpan}>
        <div className="comment-thread">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`comment-thread__item${comment.resolved ? ' comment-thread__item--resolved' : ''}`}
            >
              <div className="comment-thread__header">
                <span className="comment-thread__author">{comment.author}</span>
                <span className="comment-thread__timestamp">
                  {formatTimestamp(comment.createdAt)}
                </span>
                {comment.resolved && (
                  <span className="comment-thread__resolved-badge">Resolved</span>
                )}
                <button
                  type="button"
                  className="comment-thread__resolve-btn"
                  onClick={() => onResolve(comment.id, !comment.resolved)}
                  title={comment.resolved ? 'Unresolve comment' : 'Resolve comment'}
                >
                  {comment.resolved ? 'Unresolve' : 'Resolve'}
                </button>
              </div>
              <div className="comment-thread__body">{comment.body}</div>
            </div>
          ))}
          {onReply !== undefined && (
            <div className="comment-thread__footer">
              <Button size="sm" onClick={onReply}>
                Reply
              </Button>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}
