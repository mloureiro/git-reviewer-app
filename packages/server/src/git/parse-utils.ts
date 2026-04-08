import type { DiffFile } from '@git-reviewer/shared';

export type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

export function parseNameStatus(
  raw: string,
): Array<{ status: FileStatus; path: string; oldPath?: string }> {
  const result: Array<{ status: FileStatus; path: string; oldPath?: string }> = [];

  for (const line of raw.split('\n').filter(Boolean)) {
    const parts = line.split('\t');
    const code = parts[0] ?? '';
    const first = parts[1] ?? '';
    const second = parts[2];

    if (code === 'A') {
      result.push({ status: 'added', path: first });
    } else if (code === 'D') {
      result.push({ status: 'deleted', path: first });
    } else if (code.startsWith('R') && second !== undefined) {
      result.push({ status: 'renamed', oldPath: first, path: second });
    } else {
      // M and any other codes (C, T, U, X) → modified
      result.push({ status: 'modified', path: first });
    }
  }

  return result;
}

export function parseNumstat(
  raw: string,
): Array<{ additions: number; deletions: number; binary: boolean }> {
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      const addRaw = parts[0] ?? '0';
      const delRaw = parts[1] ?? '0';
      const binary = addRaw === '-' && delRaw === '-';
      return {
        additions: binary ? 0 : parseInt(addRaw, 10) || 0,
        deletions: binary ? 0 : parseInt(delRaw, 10) || 0,
        binary,
      };
    });
}

export function mergeStatusAndStats(
  statuses: Array<{ status: FileStatus; path: string; oldPath?: string }>,
  stats: Array<{ additions: number; deletions: number; binary: boolean }>,
): DiffFile[] {
  return statuses.map((entry, index) => {
    const stat = stats[index];
    return {
      path: entry.path,
      status: entry.status,
      additions: stat?.additions ?? 0,
      deletions: stat?.deletions ?? 0,
      ...(entry.oldPath !== undefined ? { oldPath: entry.oldPath } : {}),
      ...(stat?.binary === true ? { binary: true } : {}),
    };
  });
}

/**
 * Splits a unified diff text into per-file sections keyed by the "b/" file path
 * (the new name, which correctly handles renames).
 *
 * Returns a Map<filePath, sectionText> where each value is the full diff block
 * for that file, from the "diff --git" header line through to the next file's header.
 */
export function parseFileDiffSections(diffText: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!diffText.trim()) return result;

  // Split on "diff --git" boundaries, keeping the delimiter with each section
  const sections = diffText.split(/^(?=diff --git )/m).filter(Boolean);

  for (const section of sections) {
    // Extract file path from the diff header: "diff --git a/path b/path"
    const headerMatch = section.match(/^diff --git a\/(.+?) b\/(.+)/m);
    if (headerMatch == null) continue;

    // Use the "b/" path (the new name, handles renames)
    const filePath = headerMatch[2] as string;
    result.set(filePath, section);
  }

  return result;
}
