import { createHash } from 'node:crypto';
import simpleGit, { type SimpleGit } from 'simple-git';
import type { DiffFile } from '@git-reviewer/shared';

export function createGitClient(repoPath: string): SimpleGit {
  return simpleGit(repoPath);
}

export async function getDiffText(git: SimpleGit, base: string, head: string): Promise<string> {
  return git.diff([`${base}...${head}`]);
}

export async function getUncommittedDiffText(git: SimpleGit): Promise<string> {
  const staged = await git.diff(['--cached']);
  const unstaged = await git.diff();
  return [staged, unstaged].filter(Boolean).join('\n');
}

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
      // M and any other codes (C, T, U, X) → modified
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

function mergeStatusAndStats(
  statuses: Array<{ status: FileStatus; path: string; oldPath?: string }>,
  stats: Array<{ additions: number; deletions: number }>,
): DiffFile[] {
  return statuses.map((entry, index) => ({
    path: entry.path,
    status: entry.status,
    additions: stats[index]?.additions ?? 0,
    deletions: stats[index]?.deletions ?? 0,
    ...(entry.oldPath !== undefined ? { oldPath: entry.oldPath } : {}),
  }));
}

export async function getChangedFiles(
  git: SimpleGit,
  base: string,
  head: string,
): Promise<DiffFile[]> {
  const range = `${base}...${head}`;
  const [nameStatusRaw, numstatRaw] = await Promise.all([
    git.raw(['diff', '--name-status', '-M', range]),
    git.raw(['diff', '--numstat', '-M', range]),
  ]);

  const statuses = parseNameStatus(nameStatusRaw);
  const stats = parseNumstat(numstatRaw);

  return mergeStatusAndStats(statuses, stats);
}

export async function getUncommittedChangedFiles(git: SimpleGit): Promise<DiffFile[]> {
  const [stagedNameStatus, stagedNumstat, unstagedNameStatus, unstagedNumstat] = await Promise.all([
    git.raw(['diff', '--name-status', '--cached', '-M']),
    git.raw(['diff', '--numstat', '--cached', '-M']),
    git.raw(['diff', '--name-status', '-M']),
    git.raw(['diff', '--numstat', '-M']),
  ]);

  const stagedStatuses = parseNameStatus(stagedNameStatus);
  const stagedStats = parseNumstat(stagedNumstat);
  const stagedFiles = mergeStatusAndStats(stagedStatuses, stagedStats);

  const unstagedStatuses = parseNameStatus(unstagedNameStatus);
  const unstagedStats = parseNumstat(unstagedNumstat);
  const unstagedFiles = mergeStatusAndStats(unstagedStatuses, unstagedStats);

  // Merge staged and unstaged: staged takes precedence; add unstaged-only files
  const stagedPaths = new Set(stagedFiles.map((f) => f.path));
  const merged = [...stagedFiles];
  for (const file of unstagedFiles) {
    if (!stagedPaths.has(file.path)) {
      merged.push(file);
    }
  }

  return merged;
}

/**
 * Splits a unified diff by file and hashes each file's diff section with SHA-256.
 * Returns a map of filePath -> hash.
 */
export function getFileDiffHashes(diffText: string): Record<string, string> {
  const result: Record<string, string> = {};

  if (!diffText.trim()) return result;

  // Split on "diff --git" boundaries, keeping the delimiter with the section
  const sections = diffText.split(/^(?=diff --git )/m).filter(Boolean);

  for (const section of sections) {
    // Extract file path from the diff header: "diff --git a/path b/path"
    const headerMatch = section.match(/^diff --git a\/(.+?) b\/(.+)/m);
    if (headerMatch == null) continue;

    // Use the "b/" path (the new name, handles renames)
    const filePath = headerMatch[2] as string;
    const hash = createHash('sha256').update(section).digest('hex');
    result[filePath] = hash;
  }

  return result;
}
