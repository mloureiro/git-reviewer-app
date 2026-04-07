import type { SimpleGit } from 'simple-git';
import { v4 as uuid } from 'uuid';
import {
  getDiffText,
  getUncommittedDiffText,
  getChangedFiles,
  getUncommittedChangedFiles,
  getFileDiffHashes,
} from '../git/diff.js';
import {
  listReviewNotes,
  readReviewNote,
  removeReviewNote,
  writeReviewNote,
} from '../git/notes.js';
import { evaluateAutoMarkRules } from '../git/auto-mark.js';
import { withSessionLock } from './session-lock.js';
import type {
  AutoMarkRule,
  DiffFile,
  ReviewComment,
  ReviewData,
  ReviewStatus,
  ViewedFile,
} from '@git-reviewer/shared';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Sentinel value for uncommitted (working-tree) sessions — not a real git ref */
const WORKING_TREE_SENTINEL = 'working tree';

function isUncommittedSession(headRef: string): boolean {
  return headRef === WORKING_TREE_SENTINEL;
}

async function getSessionDiffText(
  git: SimpleGit,
  baseRef: string,
  headRef: string,
): Promise<string> {
  return isUncommittedSession(headRef)
    ? getUncommittedDiffText(git)
    : getDiffText(git, baseRef, headRef);
}

async function getSessionChangedFiles(
  git: SimpleGit,
  baseRef: string,
  headRef: string,
): Promise<DiffFile[]> {
  return isUncommittedSession(headRef)
    ? getUncommittedChangedFiles(git)
    : getChangedFiles(git, baseRef, headRef);
}

/**
 * Merge auto-marked ViewedFile entries into the existing set.
 * Keeps manually-viewed files, replaces stale auto-marked ones,
 * and prevents manual entries from being overwritten by new auto-marks.
 */
function mergeAutoMarked(existing: ViewedFile[], incoming: ViewedFile[]): ViewedFile[] {
  const manuallyViewed = existing.filter((vf) => vf.autoMarkedBy == null);
  const incomingPaths = new Set(incoming.map((vf) => vf.path));
  const kept = manuallyViewed.filter((vf) => !incomingPaths.has(vf.path));
  return [...kept, ...incoming];
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateSessionInput {
  title: string;
  baseRef: string;
  headRef: string;
  repoPath: string;
}

export interface AddCommentInput {
  file: string;
  line: number;
  side: ReviewComment['side'];
  body: string;
  author: string;
}

// ---------------------------------------------------------------------------
// Read operations
// ---------------------------------------------------------------------------

/**
 * Read a single review session by its head commit SHA.
 * Returns `null` when no note exists for that SHA.
 */
export async function getSession(git: SimpleGit, commitSha: string): Promise<ReviewData | null> {
  return readReviewNote(git, commitSha);
}

/**
 * List all review sessions stored in the given repo.
 */
export async function listSessions(git: SimpleGit): Promise<ReviewData[]> {
  const notes = await listReviewNotes(git);
  const sessions: ReviewData[] = [];
  for (const { commitHash } of notes) {
    const data = await readReviewNote(git, commitHash);
    if (data) {
      sessions.push(data);
    }
  }
  return sessions;
}

// ---------------------------------------------------------------------------
// Write operations
// ---------------------------------------------------------------------------

/**
 * Create a new review session. Resolves `headRef` and `baseRef` to commit SHAs
 * via git, writes the review note, and returns the full `ReviewData`.
 */
export async function createSession(
  git: SimpleGit,
  input: CreateSessionInput,
): Promise<ReviewData> {
  const { title, baseRef, headRef, repoPath } = input;

  const headCommit = await git.revparse([headRef]);
  const baseCommit = await git.revparse([baseRef]);
  const now = new Date().toISOString();

  const data: ReviewData = {
    version: 1,
    session: {
      id: uuid(),
      title,
      baseRef,
      headRef,
      baseCommit: baseCommit.trim(),
      headCommit: headCommit.trim(),
      status: 'pending',
      createdAt: now,
      updatedAt: now,
      repoPath,
    },
    comments: [],
  };

  await writeReviewNote(git, headCommit.trim(), data);
  return data;
}

/**
 * Delete a review session by its head commit SHA.
 * Returns `false` when the session does not exist, `true` on success.
 */
export async function deleteSession(git: SimpleGit, commitSha: string): Promise<boolean> {
  const data = await readReviewNote(git, commitSha);
  if (!data) return false;
  await removeReviewNote(git, commitSha);
  return true;
}

/**
 * Update the status of a review session.
 * Returns the updated session object, or `null` when the session is not found.
 */
export async function updateStatus(
  git: SimpleGit,
  commitSha: string,
  status: ReviewStatus,
): Promise<ReviewData['session'] | null> {
  return withSessionLock(commitSha, async () => {
    const data = await readReviewNote(git, commitSha);
    if (!data) return null;

    data.session.status = status;
    data.session.updatedAt = new Date().toISOString();
    await writeReviewNote(git, commitSha, data);

    return data.session;
  });
}

/**
 * Add a comment to a review session.
 * Returns the created comment, or `null` when the session is not found.
 */
export async function addComment(
  git: SimpleGit,
  commitSha: string,
  input: AddCommentInput,
): Promise<ReviewComment | null> {
  return withSessionLock(commitSha, async () => {
    const data = await readReviewNote(git, commitSha);
    if (!data) return null;

    const comment: ReviewComment = {
      id: uuid(),
      file: input.file,
      line: input.line,
      side: input.side,
      body: input.body,
      author: input.author,
      createdAt: new Date().toISOString(),
      resolved: false,
    };

    data.comments.push(comment);
    data.session.updatedAt = new Date().toISOString();
    await writeReviewNote(git, commitSha, data);

    return comment;
  });
}

/**
 * Resolve or unresolve a comment.
 * Returns the updated comment, `null` when the session is not found, or
 * `'comment-not-found'` when the comment ID does not exist in the session.
 */
export async function resolveComment(
  git: SimpleGit,
  commitSha: string,
  commentId: string,
  resolved: boolean,
): Promise<ReviewComment | null | 'comment-not-found'> {
  return withSessionLock(commitSha, async () => {
    const data = await readReviewNote(git, commitSha);
    if (!data) return null;

    const comment = data.comments.find(({ id }) => id === commentId);
    if (!comment) return 'comment-not-found';

    comment.resolved = resolved;
    data.session.updatedAt = new Date().toISOString();
    await writeReviewNote(git, commitSha, data);

    return comment;
  });
}

/**
 * Mark a file as viewed in a session. Computes the current diff hash for the
 * file so that stale-view detection works later.
 * Returns the created `ViewedFile` entry, or `null` when the session is not found.
 */
export async function markFileViewed(
  git: SimpleGit,
  commitSha: string,
  filePath: string,
): Promise<ViewedFile | null> {
  return withSessionLock(commitSha, async () => {
    const data = await readReviewNote(git, commitSha);
    if (!data) return null;

    const diffText = await getSessionDiffText(git, data.session.baseRef, data.session.headRef);
    const diffHashes = getFileDiffHashes(diffText);

    const viewedFile: ViewedFile = {
      path: filePath,
      viewedAt: new Date().toISOString(),
      diffHash: diffHashes[filePath] ?? '',
    };

    const viewedFiles = data.viewedFiles ?? [];
    const existingIndex = viewedFiles.findIndex((vf) => vf.path === filePath);
    if (existingIndex >= 0) {
      viewedFiles[existingIndex] = viewedFile;
    } else {
      viewedFiles.push(viewedFile);
    }

    data.viewedFiles = viewedFiles;
    data.session.updatedAt = new Date().toISOString();
    await writeReviewNote(git, commitSha, data);

    return viewedFile;
  });
}

/**
 * Unmark a file as viewed in a session.
 * Returns `true` on success, `false` when the session is not found.
 */
export async function unmarkFileViewed(
  git: SimpleGit,
  commitSha: string,
  filePath: string,
): Promise<boolean> {
  return withSessionLock(commitSha, async () => {
    const data = await readReviewNote(git, commitSha);
    if (!data) return false;

    data.viewedFiles = (data.viewedFiles ?? []).filter((vf) => vf.path !== filePath);
    data.session.updatedAt = new Date().toISOString();
    await writeReviewNote(git, commitSha, data);

    return true;
  });
}

export interface ApplyAutoMarkResult {
  rules: AutoMarkRule[];
  autoMarked: ViewedFile[];
}

/**
 * Update the auto-mark rules for a session and immediately apply them to the
 * current diff. Returns the updated rules list and the set of newly auto-marked
 * files, or `null` when the session is not found.
 */
export async function setAutoMarkRules(
  git: SimpleGit,
  commitSha: string,
  rules: AutoMarkRule[],
): Promise<ApplyAutoMarkResult | null> {
  return withSessionLock(commitSha, async () => {
    const data = await readReviewNote(git, commitSha);
    if (!data) return null;

    data.autoMarkRules = rules;

    const files = await getSessionChangedFiles(git, data.session.baseRef, data.session.headRef);
    const diffText = await getSessionDiffText(git, data.session.baseRef, data.session.headRef);
    const diffHashes = getFileDiffHashes(diffText);
    const matches = evaluateAutoMarkRules(files, diffText, rules);

    const now = new Date().toISOString();
    const autoMarked: ViewedFile[] = matches.map((m) => ({
      path: m.path,
      viewedAt: now,
      diffHash: diffHashes[m.path] ?? '',
      autoMarkedBy: m.rule,
    }));

    data.viewedFiles = mergeAutoMarked(data.viewedFiles ?? [], autoMarked);
    data.session.updatedAt = now;
    await writeReviewNote(git, commitSha, data);

    return { rules, autoMarked };
  });
}

/**
 * Re-apply the existing auto-mark rules for a session against the current diff.
 * Returns the set of auto-marked files, or `null` when the session is not found.
 */
export async function applyAutoMarkRules(
  git: SimpleGit,
  commitSha: string,
): Promise<Pick<ApplyAutoMarkResult, 'autoMarked'> | null> {
  return withSessionLock(commitSha, async () => {
    const data = await readReviewNote(git, commitSha);
    if (!data) return null;

    const rules = data.autoMarkRules ?? [];
    const files = await getSessionChangedFiles(git, data.session.baseRef, data.session.headRef);
    const diffText = await getSessionDiffText(git, data.session.baseRef, data.session.headRef);
    const diffHashes = getFileDiffHashes(diffText);
    const matches = evaluateAutoMarkRules(files, diffText, rules);

    const now = new Date().toISOString();
    const autoMarked: ViewedFile[] = matches.map((m) => ({
      path: m.path,
      viewedAt: now,
      diffHash: diffHashes[m.path] ?? '',
      autoMarkedBy: m.rule,
    }));

    data.viewedFiles = mergeAutoMarked(data.viewedFiles ?? [], autoMarked);
    data.session.updatedAt = now;
    await writeReviewNote(git, commitSha, data);

    return { autoMarked };
  });
}
