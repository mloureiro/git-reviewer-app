import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import dsPlugin from './packages/client/eslint-plugin-ds/index.js';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-plusplus': 'error',
    },
  },
  {
    files: ['packages/client/src/**/*.{ts,tsx}'],
    plugins: {
      ds: dsPlugin,
    },
    rules: {
      'ds/no-raw-button': 'warn',
      'ds/no-raw-input': 'warn',
      'ds/no-raw-select': 'warn',
      'ds/no-raw-textarea': 'warn',
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**'],
  },
);
