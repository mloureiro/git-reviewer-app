import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactHooks from 'eslint-plugin-react-hooks';
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
      'react-hooks': reactHooks,
      ds: dsPlugin,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
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
