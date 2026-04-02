import { v4 as uuid } from 'uuid';
import type { SimpleGit } from 'simple-git';
import type { ReviewData } from '@git-reviewer/shared';
import { writeReviewNote } from './notes.js';

/**
 * Resolves a ref to a human-friendly name.
 * - If `ref` is provided and not literally `'HEAD'`, returns it as-is.
 * - Otherwise resolves HEAD to the current branch name.
 * - If detached (no branch), falls back to a 10-char short commit hash.
 */
export async function resolveRefName(
  git: SimpleGit,
  ref: string | undefined,
  fallback: string,
): Promise<string> {
  const raw = ref ?? fallback;
  if (raw !== 'HEAD') return raw;

  const branch = (await git.revparse(['--abbrev-ref', 'HEAD']).catch(() => '')).trim();
  if (branch && branch !== 'HEAD') return branch;

  // Detached HEAD — use short commit hash
  const short = (await git.revparse(['--short=10', 'HEAD']).catch(() => '')).trim();
  return short || raw;
}

export interface ValidateRefsOptions {
  base?: string;
  head?: string;
  uncommitted?: boolean;
}

export interface ValidateRefsResult {
  baseCommit: string;
  headCommit: string;
}

/**
 * Validates that --base and --head refs exist in the repo using git.revparse.
 * If --uncommitted is set, validates that the repo has uncommitted changes instead.
 * Throws a descriptive Error if validation fails.
 */
export async function validateRefs(
  git: SimpleGit,
  options: ValidateRefsOptions,
): Promise<ValidateRefsResult> {
  const { base, head, uncommitted } = options;

  if (uncommitted) {
    const status = await git.status();
    const hasChanges =
      status.modified.length > 0 ||
      status.staged.length > 0 ||
      status.created.length > 0 ||
      status.deleted.length > 0 ||
      status.renamed.length > 0 ||
      status.conflicted.length > 0;

    if (!hasChanges) {
      throw new Error(
        '--uncommitted was specified but there are no uncommitted changes in the repository.',
      );
    }

    // For uncommitted mode the "head" is the working tree; resolve HEAD as the base commit
    const headCommit = await git.revparse(['HEAD']).catch(() => {
      throw new Error('Could not resolve HEAD. Is this a git repository with at least one commit?');
    });

    return { baseCommit: headCommit.trim(), headCommit: headCommit.trim() };
  }

  if (!base) {
    throw new Error('--base <ref> is required unless --uncommitted is used.');
  }

  const resolvedHead = head ?? 'HEAD';

  const [baseCommit, headCommit] = await Promise.all([
    git.revparse([base]).catch(() => {
      throw new Error(`Invalid --base ref: '${base}' does not exist in the repository.`);
    }),
    git.revparse([resolvedHead]).catch(() => {
      throw new Error(`Invalid --head ref: '${resolvedHead}' does not exist in the repository.`);
    }),
  ]);

  return { baseCommit: baseCommit.trim(), headCommit: headCommit.trim() };
}

export interface CreateAutoSessionOptions {
  base?: string;
  head?: string;
  uncommitted?: boolean;
  baseCommit: string;
  headCommit: string;
  repoPath?: string;
}

/**
 * Creates and persists a ReviewData session in git-notes so the server can find it
 * immediately when it starts. Returns the created ReviewData.
 */
export async function createAutoSession(
  git: SimpleGit,
  options: CreateAutoSessionOptions,
): Promise<ReviewData> {
  const { base, head, uncommitted, baseCommit, headCommit, repoPath } = options;

  const baseRef = uncommitted ? headCommit : await resolveRefName(git, base, 'HEAD');
  const headRef = uncommitted ? 'working tree' : await resolveRefName(git, head, 'HEAD');
  const title = uncommitted ? 'Uncommitted changes' : `Review ${baseRef}..${headRef}`;

  const now = new Date().toISOString();

  const data: ReviewData = {
    version: 1,
    session: {
      id: uuid(),
      title,
      baseRef,
      headRef,
      baseCommit,
      headCommit,
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      repoPath,
    },
    comments: [],
  };

  // Store the note keyed on headCommit (working tree shares HEAD commit)
  await writeReviewNote(git, headCommit, data);

  return data;
}
