import { describe, it, expect } from 'vitest';
import type { DiffFile } from '@git-reviewer/shared';
import { evaluateAutoMarkRules } from './auto-mark.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFile(overrides: Partial<DiffFile> & { path: string }): DiffFile {
  return {
    status: 'modified',
    additions: 1,
    deletions: 1,
    ...overrides,
  };
}

/**
 * Build a minimal unified diff string with a single hunk so tests
 * that exercise content-based rules (import-only, whitespace-only) have
 * something realistic to parse.
 */
function makeDiff(filePath: string, changedLines: string[]): string {
  const diffLines = [
    `diff --git a/${filePath} b/${filePath}`,
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    '@@ -1,3 +1,3 @@',
    ...changedLines,
  ];
  return diffLines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// evaluateAutoMarkRules
// ---------------------------------------------------------------------------

describe('evaluateAutoMarkRules', () => {
  describe('empty inputs', () => {
    it('returns an empty array when rules list is empty', () => {
      const files = [makeFile({ path: 'src/foo.ts' })];
      const result = evaluateAutoMarkRules(files, '', []);
      expect(result).toEqual([]);
    });

    it('returns an empty array when files list is empty', () => {
      const result = evaluateAutoMarkRules([], '', ['lockfile']);
      expect(result).toEqual([]);
    });

    it('returns an empty array when no files match any rule', () => {
      const files = [makeFile({ path: 'src/app.ts' })];
      const result = evaluateAutoMarkRules(files, '', ['lockfile', 'generated']);
      expect(result).toEqual([]);
    });
  });

  describe('first-rule-wins deduplication', () => {
    it('matches a file only once, using the first applicable rule', () => {
      // dist/bundle.min.js satisfies 'generated' but not 'lockfile'; verify only one match is emitted
      const distFile = makeFile({ path: 'dist/bundle.min.js' });
      const result = evaluateAutoMarkRules([distFile], '', ['lockfile', 'generated']);
      // lockfile doesn't match; generated does
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ path: 'dist/bundle.min.js', rule: 'generated' });
    });

    it('uses the first matching rule when a file satisfies multiple rules', () => {
      // pnpm-lock.yaml is both a lockfile AND lives in the root so generated
      // patterns could match it via directory patterns, but since 'lockfile' is
      // listed first it should be attributed to that rule.
      const file = makeFile({ path: 'pnpm-lock.yaml' });
      const result = evaluateAutoMarkRules([file], '', ['lockfile', 'generated']);
      expect(result).toHaveLength(1);
      expect(result[0]?.rule).toBe('lockfile');
    });

    it('does not emit duplicate entries for the same file path', () => {
      const file = makeFile({ path: 'yarn.lock' });
      const result = evaluateAutoMarkRules([file], '', ['lockfile', 'lockfile']);
      expect(result).toHaveLength(1);
    });
  });

  describe('multiple files', () => {
    it('returns one match per matching file', () => {
      const files = [
        makeFile({ path: 'src/app.ts' }),
        makeFile({ path: 'package-lock.json' }),
        makeFile({ path: 'dist/output.js' }),
      ];
      const result = evaluateAutoMarkRules(files, '', ['lockfile', 'generated']);
      expect(result).toHaveLength(2);
      expect(result.map((m) => m.path)).toEqual(
        expect.arrayContaining(['package-lock.json', 'dist/output.js']),
      );
    });
  });

  // -------------------------------------------------------------------------
  // Rule: rename-only
  // -------------------------------------------------------------------------

  describe('rule: rename-only', () => {
    it('matches a renamed file with zero additions and deletions', () => {
      const file = makeFile({
        path: 'src/new-name.ts',
        oldPath: 'src/old-name.ts',
        status: 'renamed',
        additions: 0,
        deletions: 0,
      });
      const result = evaluateAutoMarkRules([file], '', ['rename-only']);
      expect(result).toEqual([{ path: 'src/new-name.ts', rule: 'rename-only' }]);
    });

    it('does not match a renamed file that also has content changes', () => {
      const file = makeFile({
        path: 'src/new-name.ts',
        oldPath: 'src/old-name.ts',
        status: 'renamed',
        additions: 3,
        deletions: 1,
      });
      const result = evaluateAutoMarkRules([file], '', ['rename-only']);
      expect(result).toEqual([]);
    });

    it('does not match a modified file even with zero changes', () => {
      const file = makeFile({ path: 'src/foo.ts', status: 'modified', additions: 0, deletions: 0 });
      const result = evaluateAutoMarkRules([file], '', ['rename-only']);
      expect(result).toEqual([]);
    });

    it('does not match an added file', () => {
      const file = makeFile({ path: 'src/new.ts', status: 'added', additions: 10, deletions: 0 });
      const result = evaluateAutoMarkRules([file], '', ['rename-only']);
      expect(result).toEqual([]);
    });

    it('does not match a deleted file', () => {
      const file = makeFile({ path: 'src/old.ts', status: 'deleted', additions: 0, deletions: 5 });
      const result = evaluateAutoMarkRules([file], '', ['rename-only']);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Rule: lockfile
  // -------------------------------------------------------------------------

  describe('rule: lockfile', () => {
    const knownLockfiles = [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'Gemfile.lock',
      'Pipfile.lock',
      'poetry.lock',
      'composer.lock',
      'Cargo.lock',
      'go.sum',
      'flake.lock',
      'bun.lockb',
      'bun.lock',
    ];

    for (const name of knownLockfiles) {
      it(`matches known lockfile: ${name}`, () => {
        const file = makeFile({ path: name });
        const result = evaluateAutoMarkRules([file], '', ['lockfile']);
        expect(result).toEqual([{ path: name, rule: 'lockfile' }]);
      });
    }

    it('matches a lockfile nested in a subdirectory', () => {
      const file = makeFile({ path: 'apps/web/package-lock.json' });
      const result = evaluateAutoMarkRules([file], '', ['lockfile']);
      expect(result).toEqual([{ path: 'apps/web/package-lock.json', rule: 'lockfile' }]);
    });

    it('does not match a file whose name only contains a lockfile name as a substring', () => {
      const file = makeFile({ path: 'src/yarn.lock.backup' });
      const result = evaluateAutoMarkRules([file], '', ['lockfile']);
      expect(result).toEqual([]);
    });

    it('does not match an arbitrary non-lockfile', () => {
      const file = makeFile({ path: 'src/app.ts' });
      const result = evaluateAutoMarkRules([file], '', ['lockfile']);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Rule: generated
  // -------------------------------------------------------------------------

  describe('rule: generated', () => {
    it('matches a .generated. file', () => {
      const file = makeFile({ path: 'src/api.generated.ts' });
      const result = evaluateAutoMarkRules([file], '', ['generated']);
      expect(result).toEqual([{ path: 'src/api.generated.ts', rule: 'generated' }]);
    });

    it('matches a .min. file', () => {
      const file = makeFile({ path: 'public/bundle.min.js' });
      const result = evaluateAutoMarkRules([file], '', ['generated']);
      expect(result).toEqual([{ path: 'public/bundle.min.js', rule: 'generated' }]);
    });

    it('matches a file in the dist/ directory', () => {
      const file = makeFile({ path: 'dist/app.js' });
      const result = evaluateAutoMarkRules([file], '', ['generated']);
      expect(result).toEqual([{ path: 'dist/app.js', rule: 'generated' }]);
    });

    it('matches a file in a nested dist/ subdirectory', () => {
      const file = makeFile({ path: 'packages/cli/dist/index.js' });
      const result = evaluateAutoMarkRules([file], '', ['generated']);
      expect(result).toEqual([{ path: 'packages/cli/dist/index.js', rule: 'generated' }]);
    });

    it('matches a file in the build/ directory', () => {
      const file = makeFile({ path: 'build/server.js' });
      const result = evaluateAutoMarkRules([file], '', ['generated']);
      expect(result).toEqual([{ path: 'build/server.js', rule: 'generated' }]);
    });

    it('matches a file in the out/ directory', () => {
      const file = makeFile({ path: 'out/main.js' });
      const result = evaluateAutoMarkRules([file], '', ['generated']);
      expect(result).toEqual([{ path: 'out/main.js', rule: 'generated' }]);
    });

    it('matches a file in the __generated__ directory', () => {
      const file = makeFile({ path: 'src/__generated__/graphql.ts' });
      const result = evaluateAutoMarkRules([file], '', ['generated']);
      expect(result).toEqual([{ path: 'src/__generated__/graphql.ts', rule: 'generated' }]);
    });

    it('matches a TypeScript declaration file (.d.ts)', () => {
      const file = makeFile({ path: 'src/types.d.ts' });
      const result = evaluateAutoMarkRules([file], '', ['generated']);
      expect(result).toEqual([{ path: 'src/types.d.ts', rule: 'generated' }]);
    });

    it('matches a source map file (.map)', () => {
      const file = makeFile({ path: 'dist/app.js.map' });
      const result = evaluateAutoMarkRules([file], '', ['generated']);
      expect(result).toEqual([{ path: 'dist/app.js.map', rule: 'generated' }]);
    });

    it('does not match a regular source file', () => {
      const file = makeFile({ path: 'src/auth/middleware.ts' });
      const result = evaluateAutoMarkRules([file], '', ['generated']);
      expect(result).toEqual([]);
    });

    it('does not match a file named "distribution.ts" (partial word match guard)', () => {
      // "distribution" contains "dist" but not at a path separator boundary
      const file = makeFile({ path: 'src/distribution.ts' });
      const result = evaluateAutoMarkRules([file], '', ['generated']);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Rule: import-only
  // -------------------------------------------------------------------------

  describe('rule: import-only', () => {
    it('matches a diff where all changed lines are import statements', () => {
      const diff = makeDiff('src/index.ts', [
        "-import { foo } from './foo.js';",
        "+import { foo, bar } from './foo.js';",
      ]);
      const file = makeFile({ path: 'src/index.ts' });
      const result = evaluateAutoMarkRules([file], diff, ['import-only']);
      expect(result).toEqual([{ path: 'src/index.ts', rule: 'import-only' }]);
    });

    it('matches a diff that only adds a new import', () => {
      const diff = makeDiff('src/index.ts', ["+import { baz } from './baz.js';"]);
      const file = makeFile({ path: 'src/index.ts', additions: 1, deletions: 0 });
      const result = evaluateAutoMarkRules([file], diff, ['import-only']);
      expect(result).toEqual([{ path: 'src/index.ts', rule: 'import-only' }]);
    });

    it('matches a diff with require() calls', () => {
      const diff = makeDiff('src/legacy.js', [
        '-const fs = require("fs");',
        '+const fs = require("node:fs");',
      ]);
      const file = makeFile({ path: 'src/legacy.js' });
      const result = evaluateAutoMarkRules([file], diff, ['import-only']);
      expect(result).toEqual([{ path: 'src/legacy.js', rule: 'import-only' }]);
    });

    it('matches a diff with re-export statements', () => {
      const diff = makeDiff('src/barrel.ts', [
        "-export { Alpha } from './alpha.js';",
        "+export { Alpha, Beta } from './alpha.js';",
      ]);
      const file = makeFile({ path: 'src/barrel.ts' });
      const result = evaluateAutoMarkRules([file], diff, ['import-only']);
      expect(result).toEqual([{ path: 'src/barrel.ts', rule: 'import-only' }]);
    });

    it('does not match a diff that contains non-import changed lines', () => {
      const diff = makeDiff('src/app.ts', ["+import { foo } from './foo.js';", '+const x = 42;']);
      const file = makeFile({ path: 'src/app.ts' });
      const result = evaluateAutoMarkRules([file], diff, ['import-only']);
      expect(result).toEqual([]);
    });

    it('does not match when the diff section is empty (file not in diff)', () => {
      const file = makeFile({ path: 'src/app.ts' });
      // diffText contains a different file
      const diff = makeDiff('src/other.ts', ["+import { x } from './x.js';"]);
      const result = evaluateAutoMarkRules([file], diff, ['import-only']);
      expect(result).toEqual([]);
    });

    it('does not match a diff that has no changed lines (hunk with only context)', () => {
      const diffWithNoChanges = [
        'diff --git a/src/index.ts b/src/index.ts',
        '--- a/src/index.ts',
        '+++ b/src/index.ts',
        '@@ -1,2 +1,2 @@',
        ' const x = 1;',
        ' const y = 2;',
      ].join('\n');
      const file = makeFile({ path: 'src/index.ts' });
      const result = evaluateAutoMarkRules([file], diffWithNoChanges, ['import-only']);
      expect(result).toEqual([]);
    });

    it('does not match when the diff text is empty', () => {
      const file = makeFile({ path: 'src/app.ts' });
      const result = evaluateAutoMarkRules([file], '', ['import-only']);
      expect(result).toEqual([]);
    });

    it('skips the +++ and --- header lines when evaluating changed lines', () => {
      // Make sure the +++ / --- header lines are not mistakenly treated as added/removed lines
      const diff = [
        'diff --git a/src/index.ts b/src/index.ts',
        '--- a/src/index.ts',
        '+++ b/src/index.ts',
        '@@ -1,1 +1,1 @@',
        "-import { foo } from './foo.js';",
        "+import { foo, bar } from './foo.js';",
      ].join('\n');
      const file = makeFile({ path: 'src/index.ts' });
      const result = evaluateAutoMarkRules([file], diff, ['import-only']);
      expect(result).toEqual([{ path: 'src/index.ts', rule: 'import-only' }]);
    });
  });

  // -------------------------------------------------------------------------
  // Rule: whitespace-only
  // -------------------------------------------------------------------------

  describe('rule: whitespace-only', () => {
    it('matches a diff where only indentation changed', () => {
      const diff = [
        'diff --git a/src/foo.ts b/src/foo.ts',
        '--- a/src/foo.ts',
        '+++ b/src/foo.ts',
        '@@ -1,2 +1,2 @@',
        '-const x = 1;',
        '+  const x = 1;',
      ].join('\n');
      const file = makeFile({ path: 'src/foo.ts' });
      const result = evaluateAutoMarkRules([file], diff, ['whitespace-only']);
      expect(result).toEqual([{ path: 'src/foo.ts', rule: 'whitespace-only' }]);
    });

    it('matches a diff where only tabs vs spaces changed', () => {
      const diff = [
        'diff --git a/src/foo.ts b/src/foo.ts',
        '--- a/src/foo.ts',
        '+++ b/src/foo.ts',
        '@@ -1,1 +1,1 @@',
        '-\tconst x = 1;',
        '+    const x = 1;',
      ].join('\n');
      const file = makeFile({ path: 'src/foo.ts' });
      const result = evaluateAutoMarkRules([file], diff, ['whitespace-only']);
      expect(result).toEqual([{ path: 'src/foo.ts', rule: 'whitespace-only' }]);
    });

    it('does not match a diff with real content changes', () => {
      const diff = [
        'diff --git a/src/foo.ts b/src/foo.ts',
        '--- a/src/foo.ts',
        '+++ b/src/foo.ts',
        '@@ -1,1 +1,1 @@',
        '-const x = 1;',
        '+const x = 2;',
      ].join('\n');
      const file = makeFile({ path: 'src/foo.ts' });
      const result = evaluateAutoMarkRules([file], diff, ['whitespace-only']);
      expect(result).toEqual([]);
    });

    it('does not match when added and removed lines differ in non-whitespace characters', () => {
      const diff = [
        'diff --git a/src/foo.ts b/src/foo.ts',
        '--- a/src/foo.ts',
        '+++ b/src/foo.ts',
        '@@ -1,2 +1,2 @@',
        '-const x = 1;',
        '-const y = 2;',
        '+const a = 1;',
        '+const b = 2;',
      ].join('\n');
      const file = makeFile({ path: 'src/foo.ts' });
      const result = evaluateAutoMarkRules([file], diff, ['whitespace-only']);
      expect(result).toEqual([]);
    });

    it('does not match when the diff section is empty (file not in diff)', () => {
      const file = makeFile({ path: 'src/app.ts' });
      const diff = [
        'diff --git a/src/other.ts b/src/other.ts',
        '--- a/src/other.ts',
        '+++ b/src/other.ts',
        '@@ -1,1 +1,1 @@',
        '-const a = 1;',
        '+  const a = 1;',
      ].join('\n');
      const result = evaluateAutoMarkRules([file], diff, ['whitespace-only']);
      expect(result).toEqual([]);
    });

    it('does not match when the diff text is empty', () => {
      const file = makeFile({ path: 'src/app.ts' });
      const result = evaluateAutoMarkRules([file], '', ['whitespace-only']);
      expect(result).toEqual([]);
    });

    it('does not match when the hunk has only context lines (no additions or deletions)', () => {
      const diff = [
        'diff --git a/src/foo.ts b/src/foo.ts',
        '--- a/src/foo.ts',
        '+++ b/src/foo.ts',
        '@@ -1,2 +1,2 @@',
        ' const x = 1;',
        ' const y = 2;',
      ].join('\n');
      const file = makeFile({ path: 'src/foo.ts' });
      const result = evaluateAutoMarkRules([file], diff, ['whitespace-only']);
      expect(result).toEqual([]);
    });

    it('handles multiple hunks: matches only if ALL hunks are whitespace-only', () => {
      const diff = [
        'diff --git a/src/foo.ts b/src/foo.ts',
        '--- a/src/foo.ts',
        '+++ b/src/foo.ts',
        '@@ -1,1 +1,1 @@',
        '-const x = 1;',
        '+  const x = 1;',
        '@@ -10,1 +10,1 @@',
        '-const y = 2;',
        '+  const y = 2;',
      ].join('\n');
      const file = makeFile({ path: 'src/foo.ts' });
      const result = evaluateAutoMarkRules([file], diff, ['whitespace-only']);
      expect(result).toEqual([{ path: 'src/foo.ts', rule: 'whitespace-only' }]);
    });

    it('does not match when one hunk has real changes and another is whitespace-only', () => {
      const diff = [
        'diff --git a/src/foo.ts b/src/foo.ts',
        '--- a/src/foo.ts',
        '+++ b/src/foo.ts',
        '@@ -1,1 +1,1 @@',
        '-const x = 1;',
        '+  const x = 1;',
        '@@ -10,1 +10,1 @@',
        '-const y = 2;',
        '+const y = 99;',
      ].join('\n');
      const file = makeFile({ path: 'src/foo.ts' });
      const result = evaluateAutoMarkRules([file], diff, ['whitespace-only']);
      expect(result).toEqual([]);
    });
  });

  // -------------------------------------------------------------------------
  // Rule ordering and multi-rule interaction
  // -------------------------------------------------------------------------

  describe('rule ordering', () => {
    it('processes rules in order and stops after the first match for each file', () => {
      // rename-only fires first; the same file should not be attributed to lockfile
      // even though the path ends in a lockfile name.
      const file = makeFile({
        path: 'packages/app/yarn.lock',
        oldPath: 'packages/old-app/yarn.lock',
        status: 'renamed',
        additions: 0,
        deletions: 0,
      });
      const result = evaluateAutoMarkRules([file], '', ['rename-only', 'lockfile']);
      expect(result).toHaveLength(1);
      expect(result[0]?.rule).toBe('rename-only');
    });

    it('falls through to the next rule when earlier rules do not match', () => {
      // rename-only won't match (status is modified), but lockfile should
      const file = makeFile({ path: 'yarn.lock', status: 'modified' });
      const result = evaluateAutoMarkRules([file], '', ['rename-only', 'lockfile']);
      expect(result).toHaveLength(1);
      expect(result[0]?.rule).toBe('lockfile');
    });

    it('skips content-based diff parsing when only non-content rules are used', () => {
      // Even without any diff text, rename-only and lockfile rules should work correctly
      const files = [
        makeFile({ path: 'yarn.lock' }),
        makeFile({
          path: 'src/renamed.ts',
          oldPath: 'src/old.ts',
          status: 'renamed',
          additions: 0,
          deletions: 0,
        }),
      ];
      const result = evaluateAutoMarkRules(files, '', ['rename-only', 'lockfile']);
      expect(result).toHaveLength(2);
      expect(result.find((m) => m.path === 'yarn.lock')?.rule).toBe('lockfile');
      expect(result.find((m) => m.path === 'src/renamed.ts')?.rule).toBe('rename-only');
    });
  });

  // -------------------------------------------------------------------------
  // Result shape
  // -------------------------------------------------------------------------

  describe('result shape', () => {
    it('returns matches with the correct path and rule properties', () => {
      const file = makeFile({ path: 'Cargo.lock' });
      const result = evaluateAutoMarkRules([file], '', ['lockfile']);
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ path: 'Cargo.lock', rule: 'lockfile' });
    });

    it('preserves the original file path in the match', () => {
      const file = makeFile({ path: 'packages/deep/nested/pnpm-lock.yaml' });
      const result = evaluateAutoMarkRules([file], '', ['lockfile']);
      expect(result[0]?.path).toBe('packages/deep/nested/pnpm-lock.yaml');
    });
  });
});
