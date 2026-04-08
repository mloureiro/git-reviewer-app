import { createHash } from 'node:crypto';
import simpleGit, { type SimpleGit } from 'simple-git';
import type { DiffFile } from '@git-reviewer/shared';
import {
  parseNameStatus,
  parseNumstat,
  mergeStatusAndStats,
  parseFileDiffSections,
} from './parse-utils.js';

export function createGitClient(repoPath: string): SimpleGit {
  return simpleGit(repoPath, { timeout: { block: 30_000 } });
}

export async function getDiffText(git: SimpleGit, base: string, head: string): Promise<string> {
  return git.diff([`${base}...${head}`]);
}

export async function getUncommittedDiffText(git: SimpleGit): Promise<string> {
  return git.diff(['HEAD']);
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

  for (const [filePath, section] of parseFileDiffSections(diffText)) {
    const hash = createHash('sha256').update(section).digest('hex');
    result[filePath] = hash;
  }

  return result;
}
