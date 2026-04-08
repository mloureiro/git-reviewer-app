import type { Linter, Rule } from 'eslint';

declare const plugin: Linter.Plugin & {
  rules: {
    'no-raw-button': Rule.RuleModule;
    'no-raw-input': Rule.RuleModule;
    'no-raw-select': Rule.RuleModule;
    'no-raw-textarea': Rule.RuleModule;
  };
};

export default plugin;
