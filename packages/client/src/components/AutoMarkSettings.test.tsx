import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { AutoMarkSettings } from './AutoMarkSettings';
import type { AutoMarkRule } from '../types/review';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('AutoMarkSettings', () => {
  let onRulesChange: (rules: AutoMarkRule[]) => void;
  let onApplyNow: () => void;

  beforeEach(() => {
    onRulesChange = vi.fn<(rules: AutoMarkRule[]) => void>();
    onApplyNow = vi.fn<() => void>();
  });

  // -------------------------------------------------------------------------
  // Closed state (default)
  // -------------------------------------------------------------------------

  describe('when panel is closed (default)', () => {
    it('renders the trigger button', () => {
      render(
        <AutoMarkSettings activeRules={[]} onRulesChange={onRulesChange} onApplyNow={onApplyNow} />,
      );

      expect(screen.getByRole('button', { name: /auto-mark/i })).toBeInTheDocument();
    });

    it('trigger button shows "Auto-mark" with no count when no rules are active', () => {
      render(
        <AutoMarkSettings activeRules={[]} onRulesChange={onRulesChange} onApplyNow={onApplyNow} />,
      );

      expect(screen.getByRole('button', { name: 'Auto-mark' })).toBeInTheDocument();
    });

    it('trigger button shows count when rules are active', () => {
      render(
        <AutoMarkSettings
          activeRules={['lockfile', 'generated']}
          onRulesChange={onRulesChange}
          onApplyNow={onApplyNow}
        />,
      );

      expect(screen.getByRole('button', { name: 'Auto-mark (2)' })).toBeInTheDocument();
    });

    it('trigger button has aria-expanded="false" when closed', () => {
      render(
        <AutoMarkSettings activeRules={[]} onRulesChange={onRulesChange} onApplyNow={onApplyNow} />,
      );

      expect(screen.getByRole('button', { name: /auto-mark/i })).toHaveAttribute(
        'aria-expanded',
        'false',
      );
    });

    it('does not render the panel when closed', () => {
      render(
        <AutoMarkSettings activeRules={[]} onRulesChange={onRulesChange} onApplyNow={onApplyNow} />,
      );

      expect(screen.queryByText('Auto-mark rules')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Opening the panel
  // -------------------------------------------------------------------------

  describe('when trigger button is clicked', () => {
    it('opens the panel', () => {
      render(
        <AutoMarkSettings activeRules={[]} onRulesChange={onRulesChange} onApplyNow={onApplyNow} />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Auto-mark' }));

      expect(screen.getByText('Auto-mark rules')).toBeInTheDocument();
    });

    it('trigger button has aria-expanded="true" when open', () => {
      render(
        <AutoMarkSettings activeRules={[]} onRulesChange={onRulesChange} onApplyNow={onApplyNow} />,
      );

      fireEvent.click(screen.getByRole('button', { name: 'Auto-mark' }));

      expect(screen.getByRole('button', { name: 'Auto-mark' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });
  });

  // -------------------------------------------------------------------------
  // Open panel contents
  // -------------------------------------------------------------------------

  describe('when panel is open', () => {
    function renderOpen(activeRules: AutoMarkRule[] = []) {
      render(
        <AutoMarkSettings
          activeRules={activeRules}
          onRulesChange={onRulesChange}
          onApplyNow={onApplyNow}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /auto-mark/i }));
    }

    it('renders all five rule checkboxes', () => {
      renderOpen();

      expect(screen.getByRole('checkbox', { name: /rename only/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /import only/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /whitespace only/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /lock files/i })).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: /generated files/i })).toBeInTheDocument();
    });

    it('renders the "Re-apply rules" button', () => {
      renderOpen();

      expect(screen.getByRole('button', { name: 'Re-apply rules' })).toBeInTheDocument();
    });

    it('renders the close button', () => {
      renderOpen();

      expect(screen.getByRole('button', { name: 'Close auto-mark settings' })).toBeInTheDocument();
    });

    it('active rules are checked', () => {
      renderOpen(['lockfile', 'generated']);

      expect(screen.getByRole('checkbox', { name: /lock files/i })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: /generated files/i })).toBeChecked();
    });

    it('inactive rules are unchecked', () => {
      renderOpen(['lockfile']);

      expect(screen.getByRole('checkbox', { name: /rename only/i })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: /import only/i })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: /whitespace only/i })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: /generated files/i })).not.toBeChecked();
    });

    it('all checkboxes are unchecked when no rules are active', () => {
      renderOpen([]);

      for (const checkbox of screen.getAllByRole('checkbox')) {
        expect(checkbox).not.toBeChecked();
      }
    });

    it('renders rule descriptions in the panel', () => {
      renderOpen();

      expect(
        screen.getByText('Files that were only renamed with no content changes'),
      ).toBeInTheDocument();
      expect(
        screen.getByText('Package lock files (package-lock.json, yarn.lock, etc.)'),
      ).toBeInTheDocument();
    });
  });

  // -------------------------------------------------------------------------
  // Rule toggling
  // -------------------------------------------------------------------------

  describe('toggling rules', () => {
    function renderOpen(activeRules: AutoMarkRule[] = []) {
      render(
        <AutoMarkSettings
          activeRules={activeRules}
          onRulesChange={onRulesChange}
          onApplyNow={onApplyNow}
        />,
      );
      fireEvent.click(screen.getByRole('button', { name: /auto-mark/i }));
    }

    it('calls onRulesChange with the new rule added when an unchecked rule is clicked', () => {
      renderOpen([]);

      fireEvent.click(screen.getByRole('checkbox', { name: /lock files/i }));

      expect(onRulesChange).toHaveBeenCalledOnce();
      expect(onRulesChange).toHaveBeenCalledWith(['lockfile']);
    });

    it('calls onRulesChange without the rule when a checked rule is clicked', () => {
      renderOpen(['lockfile', 'generated']);

      fireEvent.click(screen.getByRole('checkbox', { name: /lock files/i }));

      expect(onRulesChange).toHaveBeenCalledOnce();
      expect(onRulesChange).toHaveBeenCalledWith(['generated']);
    });

    it('preserves existing active rules when adding a new rule', () => {
      renderOpen(['import-only', 'whitespace-only']);

      fireEvent.click(screen.getByRole('checkbox', { name: /lock files/i }));

      expect(onRulesChange).toHaveBeenCalledWith(['import-only', 'whitespace-only', 'lockfile']);
    });

    it('calls onRulesChange with empty array when last rule is unchecked', () => {
      renderOpen(['lockfile']);

      fireEvent.click(screen.getByRole('checkbox', { name: /lock files/i }));

      expect(onRulesChange).toHaveBeenCalledWith([]);
    });
  });

  // -------------------------------------------------------------------------
  // Apply Now button
  // -------------------------------------------------------------------------

  describe('"Re-apply rules" button', () => {
    it('calls onApplyNow when clicked', () => {
      render(
        <AutoMarkSettings activeRules={[]} onRulesChange={onRulesChange} onApplyNow={onApplyNow} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Auto-mark' }));

      fireEvent.click(screen.getByRole('button', { name: 'Re-apply rules' }));

      expect(onApplyNow).toHaveBeenCalledOnce();
    });
  });

  // -------------------------------------------------------------------------
  // Closing the panel
  // -------------------------------------------------------------------------

  describe('closing the panel', () => {
    it('closes when the close button is clicked', () => {
      render(
        <AutoMarkSettings activeRules={[]} onRulesChange={onRulesChange} onApplyNow={onApplyNow} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Auto-mark' }));
      expect(screen.getByText('Auto-mark rules')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Close auto-mark settings' }));

      expect(screen.queryByText('Auto-mark rules')).toBeNull();
    });

    it('closes when the trigger button is clicked again (toggle)', () => {
      render(
        <AutoMarkSettings activeRules={[]} onRulesChange={onRulesChange} onApplyNow={onApplyNow} />,
      );
      fireEvent.click(screen.getByRole('button', { name: 'Auto-mark' }));
      expect(screen.getByText('Auto-mark rules')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Auto-mark' }));

      expect(screen.queryByText('Auto-mark rules')).toBeNull();
    });
  });
});
