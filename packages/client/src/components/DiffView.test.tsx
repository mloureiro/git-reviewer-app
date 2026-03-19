import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { DiffView, filePathToId } from './DiffView';

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const SINGLE_FILE_DIFF = `diff --git a/src/foo.ts b/src/foo.ts
index 1234567..abcdefg 100644
--- a/src/foo.ts
+++ b/src/foo.ts
@@ -1,3 +1,4 @@
 existing line
+added line
 another line
`;

const MULTI_FILE_DIFF = `diff --git a/src/alpha.ts b/src/alpha.ts
index 1111111..2222222 100644
--- a/src/alpha.ts
+++ b/src/alpha.ts
@@ -1,2 +1,3 @@
 first line
+new alpha line
 second line
diff --git a/src/beta.ts b/src/beta.ts
index 3333333..4444444 100644
--- a/src/beta.ts
+++ b/src/beta.ts
@@ -1,2 +1,3 @@
 beta first line
+new beta line
 beta second line
`;

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('DiffView', () => {
  it('renders diff content for a valid unified diff string', () => {
    const { container } = render(<DiffView diffText={SINGLE_FILE_DIFF} />);

    // diff2html renders an element with class d2h-wrapper inside the output
    expect(container.querySelector('.d2h-wrapper')).not.toBeNull();
  });

  it('renders nothing when an empty diff string is passed', () => {
    const { container } = render(<DiffView diffText="" />);

    expect(container.firstChild).toBeNull();
  });

  it('renders per-file sections with anchor IDs derived from file paths', () => {
    const { container } = render(<DiffView diffText={MULTI_FILE_DIFF} />);

    const sections = container.querySelectorAll('section');
    expect(sections).toHaveLength(2);

    const ids = Array.from(sections).map((s) => s.id);
    expect(ids).toContain(filePathToId('src/alpha.ts'));
    expect(ids).toContain(filePathToId('src/beta.ts'));
  });
});
