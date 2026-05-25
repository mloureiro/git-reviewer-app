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

/**
 * Find the fork-point SHA used by three-dot diff semantics, automatically
 * considering both `base` and its local/remote counterpart.
 *
 * When `base_ref` is a local branch like `master` that has fallen behind
 * `origin/master` while head was rebased onto the remote, the naïve
 * merge-base lands on the stale local commit and the diff includes
 * unrelated commits. This helper computes the merge-base against each
 * candidate (local + counterpart) and picks whichever is closest to head.
 */
export async function smartMergeBase(git: SimpleGit, base: string, head: string): Promise<string> {
  const candidates = await expandBaseCandidates(git, base);

  const mbs: string[] = [];
  for (const candidate of candidates) {
    try {
      const sha = (await git.raw(['merge-base', candidate, head])).trim();
      if (sha) mbs.push(sha);
    } catch {
      // candidate doesn't resolve or has no common history with head
    }
  }

  const [first, ...rest] = mbs;
  if (first === undefined) {
    throw new Error(`Failed to find merge-base of '${base}' and '${head}'`);
  }

  // Pick the merge-base closest to head: the one that is a descendant of all others.
  let best = first;
  for (const candidate of rest) {
    try {
      const common = (await git.raw(['merge-base', best, candidate])).trim();
      if (common === best) {
        best = candidate; // best is ancestor of candidate → candidate is closer to head
      }
      // else: candidate is ancestor of best, or they diverged — keep best
    } catch {
      // keep best
    }
  }

  return best;
}

async function expandBaseCandidates(git: SimpleGit, base: string): Promise<string[]> {
  const candidates = [base];

  // Case 1: base is already a remote-tracking ref like "origin/master".
  const remotes = await listRemotes(git);
  for (const r of remotes) {
    const prefix = `${r}/`;
    if (base.startsWith(prefix)) {
      candidates.push(base.slice(prefix.length));
      return candidates;
    }
  }

  // Case 2: base looks local. Add the remote counterpart using the branch's
  // configured upstream remote, falling back to "origin".
  const remoteForBranch = await getUpstreamRemote(git, base);
  candidates.push(`${remoteForBranch}/${base}`);
  return candidates;
}

async function listRemotes(git: SimpleGit): Promise<string[]> {
  try {
    const out = await git.raw(['remote']);
    return out
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

async function getUpstreamRemote(git: SimpleGit, branchName: string): Promise<string> {
  try {
    const out = await git.raw(['config', `branch.${branchName}.remote`]);
    return out.trim() || 'origin';
  } catch {
    return 'origin';
  }
}

export async function getDiffText(git: SimpleGit, base: string, head: string): Promise<string> {
  const mb = await smartMergeBase(git, base, head);
  return git.diff([`${mb}..${head}`]);
}

export async function getUncommittedDiffText(git: SimpleGit): Promise<string> {
  return git.diff(['HEAD']);
}

export async function getChangedFiles(
  git: SimpleGit,
  base: string,
  head: string,
): Promise<DiffFile[]> {
  const mb = await smartMergeBase(git, base, head);
  const range = `${mb}..${head}`;
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
