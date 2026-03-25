import { describe, it, expect } from 'vitest';
import { extractFocusableLines } from './diffLines';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SINGLE_FILE_DIFF = `diff --git a/src/foo.ts b/src/foo.ts
index 0000000..1111111 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 context line one
-deleted line
+inserted line
+another insert
 context line two
`;

const MULTI_FILE_DIFF = `diff --git a/a.ts b/a.ts
index 0000000..1111111 100644
--- a/a.ts
+++ b/a.ts
@@ -1,2 +1,2 @@
-old line
+new line
 context
diff --git a/b.ts b/b.ts
index 0000000..2222222 100644
--- a/b.ts
+++ b/b.ts
@@ -5,3 +5,3 @@
 context b
-removed
+added
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractFocusableLines', () => {
  it('returns an empty array for an empty diff string', () => {
    expect(extractFocusableLines('')).toEqual([]);
    expect(extractFocusableLines('   ')).toEqual([]);
  });

  it('extracts lines with correct file path', () => {
    const lines = extractFocusableLines(SINGLE_FILE_DIFF);
    for (const line of lines) {
      expect(line.file).toBe('src/foo.ts');
    }
  });

  it('assigns side=left to deleted lines', () => {
    const lines = extractFocusableLines(SINGLE_FILE_DIFF);
    const deletedLines = lines.filter((l) => l.side === 'left');
    expect(deletedLines.length).toBeGreaterThan(0);
  });

  it('assigns side=right to inserted and context lines', () => {
    const lines = extractFocusableLines(SINGLE_FILE_DIFF);
    const rightLines = lines.filter((l) => l.side === 'right');
    expect(rightLines.length).toBeGreaterThan(0);
  });

  it('extracts lines from all files in a multi-file diff', () => {
    const lines = extractFocusableLines(MULTI_FILE_DIFF);
    const files = [...new Set(lines.map((l) => l.file))];
    expect(files).toContain('a.ts');
    expect(files).toContain('b.ts');
  });

  it('maintains file ordering — a.ts lines come before b.ts lines', () => {
    const lines = extractFocusableLines(MULTI_FILE_DIFF);
    const firstBIndex = lines.findIndex((l) => l.file === 'b.ts');
    // All a.ts entries must appear before the first b.ts entry.
    const aLinesAfterB = lines.slice(firstBIndex).filter((l) => l.file === 'a.ts');
    expect(aLinesAfterB).toHaveLength(0);
  });

  it('returns a non-empty array for a valid single-file diff', () => {
    const lines = extractFocusableLines(SINGLE_FILE_DIFF);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('all returned entries have a numeric line number', () => {
    const lines = extractFocusableLines(SINGLE_FILE_DIFF);
    for (const l of lines) {
      expect(typeof l.line).toBe('number');
      expect(l.line).toBeGreaterThan(0);
    }
  });
});
