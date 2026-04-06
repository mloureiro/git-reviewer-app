import { useCallback, useRef, useState } from 'react';
import type { AutoMarkRule } from '../types/review';
import { Button, IconButton, Checkbox } from './ui';

interface AutoMarkSettingsProps {
  activeRules: AutoMarkRule[];
  onRulesChange: (rules: AutoMarkRule[]) => void;
  onApplyNow: () => void;
}

const RULE_DESCRIPTIONS: { rule: AutoMarkRule; label: string; description: string }[] = [
  {
    rule: 'rename-only',
    label: 'Rename only',
    description: 'Files that were only renamed with no content changes',
  },
  {
    rule: 'import-only',
    label: 'Import only',
    description: 'Files where only import/require statements changed',
  },
  {
    rule: 'whitespace-only',
    label: 'Whitespace only',
    description: 'Files where only whitespace/formatting changed',
  },
  {
    rule: 'lockfile',
    label: 'Lock files',
    description: 'Package lock files (package-lock.json, yarn.lock, etc.)',
  },
  {
    rule: 'generated',
    label: 'Generated files',
    description: 'Build output and generated files (dist/, .min., .generated., etc.)',
  },
];

export function AutoMarkSettings({
  activeRules,
  onRulesChange,
  onApplyNow,
}: AutoMarkSettingsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const handleToggle = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const handleRuleToggle = useCallback(
    (rule: AutoMarkRule) => {
      const next = activeRules.includes(rule)
        ? activeRules.filter((r) => r !== rule)
        : [...activeRules, rule];
      onRulesChange(next);
    },
    [activeRules, onRulesChange],
  );

  const handleApplyNow = useCallback(() => {
    onApplyNow();
  }, [onApplyNow]);

  const activeCount = activeRules.length;

  return (
    <div className="auto-mark-settings" ref={panelRef}>
      <button
        type="button"
        className={`btn btn--secondary auto-mark-settings__trigger${activeCount > 0 ? ' auto-mark-settings__trigger--active' : ''}`}
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        Auto-mark{activeCount > 0 ? ` (${activeCount})` : ''}
      </button>

      {isOpen && (
        <div className="auto-mark-settings__panel">
          <div className="auto-mark-settings__header">
            <span className="auto-mark-settings__title">Auto-mark rules</span>
            <IconButton size="sm" aria-label="Close auto-mark settings" onClick={handleToggle}>
              ✕
            </IconButton>
          </div>
          <div className="auto-mark-settings__body">
            {RULE_DESCRIPTIONS.map(({ rule, label, description }) => (
              <label key={rule} className="auto-mark-settings__rule">
                <Checkbox
                  checked={activeRules.includes(rule)}
                  onChange={() => handleRuleToggle(rule)}
                />
                <div className="auto-mark-settings__rule-text">
                  <span className="auto-mark-settings__rule-label">{label}</span>
                  <span className="auto-mark-settings__rule-desc">{description}</span>
                </div>
              </label>
            ))}
          </div>
          <div className="auto-mark-settings__footer">
            <Button size="sm" onClick={handleApplyNow}>
              Re-apply rules
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
