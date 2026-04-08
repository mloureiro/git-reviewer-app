import { useEffect, useRef, useState } from 'react';

import type { CommentFormData, DiffLineData } from '../types/review';
import { Button, Textarea } from './ui';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface InlineCommentFormProps {
  lineData: DiffLineData;
  onSubmit: (data: CommentFormData) => void;
  onCancel: () => void;
  colSpan?: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function InlineCommentForm({
  lineData,
  onSubmit,
  onCancel,
  colSpan = 3,
}: InlineCommentFormProps): React.ReactNode {
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

    const isMac = navigator.userAgent.includes('Mac');
    const modKey = isMac ? event.metaKey : event.ctrlKey;

    if (modKey && event.key === 'Enter') {
      event.preventDefault();
      handleSubmit();
    }
  }

  const isSubmitDisabled = body.trim().length === 0;

  return (
    <tr className="inline-comment-form-row">
      <td className="inline-comment-form-cell" colSpan={colSpan}>
        <div className="inline-comment-form">
          <Textarea
            ref={textareaRef}
            placeholder="Leave a comment… (Cmd+Enter to comment, Esc to cancel)"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={4}
          />
          <div className="inline-comment-form__actions">
            <Button onClick={onCancel}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit} disabled={isSubmitDisabled}>
              Comment
            </Button>
          </div>
        </div>
      </td>
    </tr>
  );
}
