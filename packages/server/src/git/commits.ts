import type { SimpleGit } from 'simple-git';
import type { CommitInfo, DiffFile } from '@git-reviewer/shared';

/**
 * Returns the list of commits between `base` and `head` (exclusive of base),
 * ordered oldest-first.
 */
export async function getCommitList(
  git: SimpleGit,
  base: string,
  head: string,
): Promise<CommitInfo[]> {
  const log = await git.log({ from: base, to: head });

  const commits: CommitInfo[] = log.all.map((entry) => ({
    hash: entry.hash,
    shortHash: entry.hash.slice(0, 7),
    message: entry.message,
    author: entry.author_name,
    date: entry.date,
  }));

  // git.log returns newest-first; reverse to oldest-first
  commits.reverse();

  return commits;
}

/**
 * Returns the unified diff text for a single commit.
 * Handles the edge case of a root commit (no parent) by diffing against the
 * empty tree.
 */
export async function getCommitDiffText(git: SimpleGit, commitHash: string): Promise<string> {
  try {
    return await git.diff([`${commitHash}^`, commitHash]);
  } catch {
    // Root commit — no parent; diff against the empty tree
    const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf899d15f13a88e28';
    return git.diff([EMPTY_TREE, commitHash]);
  }
}

/**
 * Returns the list of files changed in a single commit, with addition/deletion
 * counts.
 */
export async function getCommitChangedFiles(
  git: SimpleGit,
  commitHash: string,
): Promise<DiffFile[]> {
  let nameStatusRaw: string;
  let numstatRaw: string;

  try {
    [nameStatusRaw, numstatRaw] = await Promise.all([
      git.raw(['diff', '--name-status', '-M', `${commitHash}^`, commitHash]),
      git.raw(['diff', '--numstat', '-M', `${commitHash}^`, commitHash]),
    ]);
  } catch {
    // Root commit — no parent
    const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf899d15f13a88e28';
    [nameStatusRaw, numstatRaw] = await Promise.all([
      git.raw(['diff', '--name-status', '-M', EMPTY_TREE, commitHash]),
      git.raw(['diff', '--numstat', '-M', EMPTY_TREE, commitHash]),
    ]);
  }

  const statuses = parseNameStatus(nameStatusRaw);
  const stats = parseNumstat(numstatRaw);

  return statuses.map((entry, index) => ({
    path: entry.path,
    status: entry.status,
    additions: stats[index]?.additions ?? 0,
    deletions: stats[index]?.deletions ?? 0,
    ...(entry.oldPath !== undefined ? { oldPath: entry.oldPath } : {}),
  }));
}

// ---------------------------------------------------------------------------
// Helpers (mirrored from diff.ts to keep commits module self-contained)
// ---------------------------------------------------------------------------

type FileStatus = 'added' | 'modified' | 'deleted' | 'renamed';

function parseNameStatus(
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
      result.push({ status: 'modified', path: first });
    }
  }

  return result;
}

function parseNumstat(raw: string): Array<{ additions: number; deletions: number }> {
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const parts = line.split('\t');
      return {
        additions: parseInt(parts[0] ?? '0', 10) || 0,
        deletions: parseInt(parts[1] ?? '0', 10) || 0,
      };
    });
}
