import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { InlineCommentForm } from './InlineCommentForm';
import type { CommentFormData, DiffLineData } from '../types/review';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Wraps the component in <table><tbody> because InlineCommentForm renders
 * a <tr> element, which requires valid table DOM ancestors.
 */
function renderInTable(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({ children }) => (
      <table>
        <tbody>{children}</tbody>
      </table>
    ),
  });
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const LINE_DATA: DiffLineData = {
  file: 'src/auth/middleware.ts',
  line: 42,
  side: 'right',
  content: '+  const token = req.headers.authorization;',
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('InlineCommentForm', () => {
  let onSubmit: (data: CommentFormData) => void;
  let onCancel: () => void;

  beforeEach(() => {
    onSubmit = vi.fn<(data: CommentFormData) => void>();
    onCancel = vi.fn<() => void>();
  });

  it('renders the textarea and action buttons', () => {
    renderInTable(
      <InlineCommentForm lineData={LINE_DATA} onSubmit={onSubmit} onCancel={onCancel} />,
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Submit' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('submit button is disabled when textarea is empty', () => {
    renderInTable(
      <InlineCommentForm lineData={LINE_DATA} onSubmit={onSubmit} onCancel={onCancel} />,
    );

    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('submit button is disabled when textarea contains only whitespace', () => {
    renderInTable(
      <InlineCommentForm lineData={LINE_DATA} onSubmit={onSubmit} onCancel={onCancel} />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '   ' } });

    expect(screen.getByRole('button', { name: 'Submit' })).toBeDisabled();
  });

  it('does not call onSubmit when submit button is clicked with empty text', () => {
    renderInTable(
      <InlineCommentForm lineData={LINE_DATA} onSubmit={onSubmit} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onSubmit with correct CommentFormData when submit button is clicked', () => {
    renderInTable(
      <InlineCommentForm lineData={LINE_DATA} onSubmit={onSubmit} onCancel={onCancel} />,
    );

    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'This needs error handling' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith({
      file: LINE_DATA.file,
      line: LINE_DATA.line,
      side: LINE_DATA.side,
      body: 'This needs error handling',
    });
  });

  it('trims surrounding whitespace before calling onSubmit', () => {
    renderInTable(
      <InlineCommentForm lineData={LINE_DATA} onSubmit={onSubmit} onCancel={onCancel} />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: '  good comment  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ body: 'good comment' }));
  });

  it('calls onCancel when the Cancel button is clicked', () => {
    renderInTable(
      <InlineCommentForm lineData={LINE_DATA} onSubmit={onSubmit} onCancel={onCancel} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('calls onCancel when Escape is pressed in the textarea', () => {
    renderInTable(
      <InlineCommentForm lineData={LINE_DATA} onSubmit={onSubmit} onCancel={onCancel} />,
    );

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Escape' });

    expect(onCancel).toHaveBeenCalledOnce();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits via Cmd+Enter keyboard shortcut (Mac)', () => {
    // Simulate Mac platform so the component uses metaKey
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });

    renderInTable(
      <InlineCommentForm lineData={LINE_DATA} onSubmit={onSubmit} onCancel={onCancel} />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'keyboard comment' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', metaKey: true });

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ body: 'keyboard comment' }));
  });

  it('submits via Ctrl+Enter keyboard shortcut (non-Mac)', () => {
    // Simulate non-Mac platform so the component uses ctrlKey
    Object.defineProperty(navigator, 'platform', {
      value: 'Win32',
      configurable: true,
    });

    renderInTable(
      <InlineCommentForm lineData={LINE_DATA} onSubmit={onSubmit} onCancel={onCancel} />,
    );

    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'ctrl comment' } });
    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', ctrlKey: true });

    expect(onSubmit).toHaveBeenCalledOnce();
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ body: 'ctrl comment' }));
  });

  it('does not submit via Cmd+Enter when text is empty', () => {
    Object.defineProperty(navigator, 'platform', {
      value: 'MacIntel',
      configurable: true,
    });

    renderInTable(
      <InlineCommentForm lineData={LINE_DATA} onSubmit={onSubmit} onCancel={onCancel} />,
    );

    fireEvent.keyDown(screen.getByRole('textbox'), { key: 'Enter', metaKey: true });

    expect(onSubmit).not.toHaveBeenCalled();
  });
});
