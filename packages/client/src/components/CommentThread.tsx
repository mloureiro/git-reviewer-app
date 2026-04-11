import { useEffect, useRef, useState } from 'react';

import type { ReviewComment } from '../types/review';
import { Button, Textarea } from './ui';

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
  onEdit?: (commentId: string, body: string) => void;
  onReply?: () => void;
  colSpan?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CommentThread({
  comments,
  onResolve,
  onEdit,
  onReply,
  colSpan = 3,
}: CommentThreadProps): React.ReactNode {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');
  const editTextareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editingId !== null) {
      editTextareaRef.current?.focus();
    }
  }, [editingId]);

  function startEditing(comment: ReviewComment): void {
    setEditingId(comment.id);
    setEditBody(comment.body);
  }

  function cancelEditing(): void {
    setEditingId(null);
    setEditBody('');
  }

  function handleSaveEdit(): void {
    if (editingId === null || onEdit == null) return;
    const trimmed = editBody.trim();
    if (trimmed.length === 0) return;
    onEdit(editingId, trimmed);
    setEditingId(null);
    setEditBody('');
  }

  function handleEditKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditing();
      return;
    }
    const isMac = navigator.userAgent.includes('Mac');
    const modKey = isMac ? event.metaKey : event.ctrlKey;
    if (modKey && event.key === 'Enter') {
      event.preventDefault();
      handleSaveEdit();
    }
  }

  return (
    <tr className="comment-thread-row">
      <td className="comment-thread-cell" colSpan={colSpan}>
        <div className="comment-thread">
          {comments.map((comment) => {
            const isEditing = editingId === comment.id;
            return (
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
                  {onEdit != null && !isEditing && (
                    <button
                      type="button"
                      className="comment-thread__edit-btn"
                      onClick={() => startEditing(comment)}
                      title="Edit comment"
                    >
                      Edit
                    </button>
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
                {isEditing ? (
                  <div className="comment-thread__edit-form">
                    <Textarea
                      ref={editTextareaRef}
                      value={editBody}
                      onChange={(e) => setEditBody(e.target.value)}
                      onKeyDown={handleEditKeyDown}
                      rows={4}
                    />
                    <div className="comment-thread__edit-actions">
                      <Button size="sm" onClick={cancelEditing}>
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={handleSaveEdit}
                        disabled={editBody.trim().length === 0}
                      >
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="comment-thread__body">{comment.body}</div>
                )}
              </div>
            );
          })}
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
