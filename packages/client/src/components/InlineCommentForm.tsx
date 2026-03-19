import { useEffect, useRef, useState } from 'react';

import type { CommentFormData, DiffLineData } from '../types/review';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InlineCommentFormProps {
  lineData: DiffLineData;
  onSubmit: (data: CommentFormData) => void;
  onCancel: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineCommentForm({ lineData, onSubmit, onCancel }: InlineCommentFormProps) {
  const [body, setBody] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  function handleSubmit(): void {
    const trimmed = body.trim();
    if (trimmed.length === 0) return;

    onSubmit({
      file: lineData.file,
      line: lineData.line,
      side: lineData.side,
      body: trimmed,
    });
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
      return;
    }

    const isMac = navigator.platform.toUpperCase().startsWith('MAC');
    const modKey = isMac ? event.metaKey : event.ctrlKey;

    if (modKey && event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  }

  const isSubmitDisabled = body.trim().length === 0;

  return (
    <tr className="inline-comment-form-row">
      <td className="inline-comment-form-cell" colSpan={3}>
        <div className="inline-comment-form">
          <textarea
            ref={textareaRef}
            className="inline-comment-form__textarea"
            placeholder="Leave a comment… (Cmd+Enter to submit, Esc to cancel)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
          />
          <div className="inline-comment-form__actions">
            <button type="button" className="btn btn--secondary" onClick={onCancel}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn--primary"
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
            >
              Submit
            </button>
          </div>
        </div>
      </td>
    </tr>
  );
}
