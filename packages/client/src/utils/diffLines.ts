import { parse } from 'diff2html';
import { LineType } from 'diff2html/lib-esm/types';
import type { FocusableLine } from '../hooks/useLineFocus';

/**
 * Parse a raw unified diff string and return a flat, ordered list of all
 * focusable diff lines across every file.
 *
 * Each line is uniquely identified by { file, line, side }.  The ordering
 * follows the diff's natural top-to-bottom rendering order:
 *   - files in parse order
 *   - blocks in order
 *   - lines in order within each block
 *
 * In side-by-side mode a single visual row may produce two entries (one per
 * side) when a DELETE and INSERT are paired, but for line-by-line mode every
 * row produces exactly one entry.  For simplicity we always emit one entry per
 * parsed DiffLine using the same line-number logic as DiffLineRow:
 *   - INSERT / CONTEXT  → side = 'right', line = newNumber
 *   - DELETE            → side = 'left',  line = oldNumber
 *
 * Lines that have no valid line number (edge-case in malformed diffs) are
 * silently omitted.
 */
export function extractFocusableLines(diffText: string): FocusableLine[] {
  if (diffText.trim() === '') return [];

  const diffFiles = parse(diffText);
  const result: FocusableLine[] = [];

  for (const file of diffFiles) {
    const filePath = file.isRename === true ? file.newName : file.newName || file.oldName;

    for (const block of file.blocks) {
      for (const diffLine of block.lines) {
        const isDelete = diffLine.type === LineType.DELETE;
        const side: 'left' | 'right' = isDelete ? 'left' : 'right';
        const lineNum = isDelete ? diffLine.oldNumber : diffLine.newNumber;

        if (lineNum == null) continue;

        result.push({ file: filePath, line: lineNum, side });
      }
    }
  }

  return result;
}
