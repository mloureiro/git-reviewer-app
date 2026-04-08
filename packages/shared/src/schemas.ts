/**
 * Runtime validation functions for every API response type shared between
 * the Node.js (HTTP) and Rust (Tauri) backends.
 *
 * These are intentionally hand-written (no Zod dependency) so the shared
 * package stays dependency-free. Each validator throws a descriptive error
 * when the value does not match the expected shape, and returns the
 * validated value typed as the concrete type on success.
 */

import type {
  DiffFile,
  CommitInfo,
  ReviewComment,
  ReviewSession,
  ViewedFile,
  ReviewData,
} from './types.js';
import type {
  FilesResponse,
  DiffResponse,
  SessionListResponse,
  SessionResponse,
  UpdateSessionStatusResponse,
  AutoMarkRulesResponse,
  AutoMarkApplyResponse,
  CommitsResponse,
} from './api-types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function assertString(val: unknown, label: string): asserts val is string {
  if (typeof val !== 'string') throw new Error(`${label}: expected string, got ${typeof val}`);
}

function assertNumber(val: unknown, label: string): asserts val is number {
  if (typeof val !== 'number') throw new Error(`${label}: expected number, got ${typeof val}`);
}

function assertBoolean(val: unknown, label: string): asserts val is boolean {
  if (typeof val !== 'boolean') throw new Error(`${label}: expected boolean, got ${typeof val}`);
}

function assertArray(val: unknown, label: string): asserts val is unknown[] {
  if (!Array.isArray(val)) throw new Error(`${label}: expected array, got ${typeof val}`);
}

function assertObject(val: unknown, label: string): asserts val is Record<string, unknown> {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) {
    throw new Error(`${label}: expected object, got ${val === null ? 'null' : typeof val}`);
  }
}

function assertOneOf<T extends string>(
  val: unknown,
  allowed: readonly T[],
  label: string,
): asserts val is T {
  assertString(val, label);
  if (!(allowed as readonly string[]).includes(val)) {
    throw new Error(`${label}: expected one of [${allowed.join(', ')}], got "${val}"`);
  }
}

function assertOptional(val: unknown, label: string, check: (v: unknown, l: string) => void): void {
  if (val !== undefined && val !== null) {
    check(val, label);
  }
}

// ---------------------------------------------------------------------------
// Length limit constants (exported for use in route handlers)
// ---------------------------------------------------------------------------

export const MAX_SESSION_TITLE_LENGTH = 200;
export const MAX_COMMENT_BODY_LENGTH = 10_000;

// ---------------------------------------------------------------------------
// Enum constants
// ---------------------------------------------------------------------------

const REVIEW_STATUSES = ['pending', 'approved', 'changes_requested'] as const;
const FILE_STATUSES = ['added', 'modified', 'deleted', 'renamed'] as const;
const COMMENT_SIDES = ['left', 'right'] as const;
const AUTO_MARK_RULES = [
  'rename-only',
  'import-only',
  'whitespace-only',
  'lockfile',
  'generated',
] as const;

// ---------------------------------------------------------------------------
// Entity validators
// ---------------------------------------------------------------------------

export function validateDiffFile(val: unknown, label = 'DiffFile'): DiffFile {
  assertObject(val, label);
  assertString(val.path, `${label}.path`);
  assertOneOf(val.status, FILE_STATUSES, `${label}.status`);
  assertNumber(val.additions, `${label}.additions`);
  assertNumber(val.deletions, `${label}.deletions`);
  assertOptional(val.oldPath, `${label}.oldPath`, assertString);
  assertOptional(val.binary, `${label}.binary`, assertBoolean);
  return val as unknown as DiffFile;
}

export function validateCommitInfo(val: unknown, label = 'CommitInfo'): CommitInfo {
  assertObject(val, label);
  assertString(val.hash, `${label}.hash`);
  assertString(val.shortHash, `${label}.shortHash`);
  assertString(val.message, `${label}.message`);
  assertString(val.author, `${label}.author`);
  assertString(val.date, `${label}.date`);
  return val as unknown as CommitInfo;
}

export function validateReviewComment(val: unknown, label = 'ReviewComment'): ReviewComment {
  assertObject(val, label);
  assertString(val.id, `${label}.id`);
  assertString(val.file, `${label}.file`);
  assertNumber(val.line, `${label}.line`);
  assertOneOf(val.side, COMMENT_SIDES, `${label}.side`);
  assertString(val.body, `${label}.body`);
  assertString(val.author, `${label}.author`);
  assertString(val.createdAt, `${label}.createdAt`);
  assertBoolean(val.resolved, `${label}.resolved`);
  return val as unknown as ReviewComment;
}

export function validateReviewSession(val: unknown, label = 'ReviewSession'): ReviewSession {
  assertObject(val, label);
  assertString(val.id, `${label}.id`);
  assertString(val.title, `${label}.title`);
  assertString(val.baseRef, `${label}.baseRef`);
  assertString(val.headRef, `${label}.headRef`);
  assertString(val.baseCommit, `${label}.baseCommit`);
  assertString(val.headCommit, `${label}.headCommit`);
  assertOneOf(val.status, REVIEW_STATUSES, `${label}.status`);
  assertString(val.createdAt, `${label}.createdAt`);
  assertString(val.updatedAt, `${label}.updatedAt`);
  return val as unknown as ReviewSession;
}

export function validateViewedFile(val: unknown, label = 'ViewedFile'): ViewedFile {
  assertObject(val, label);
  assertString(val.path, `${label}.path`);
  assertString(val.viewedAt, `${label}.viewedAt`);
  assertString(val.diffHash, `${label}.diffHash`);
  assertOptional(val.autoMarkedBy, `${label}.autoMarkedBy`, (v, l) =>
    assertOneOf(v, AUTO_MARK_RULES, l),
  );
  return val as unknown as ViewedFile;
}

export function validateReviewData(val: unknown, label = 'ReviewData'): ReviewData {
  assertObject(val, label);
  assertNumber(val.version, `${label}.version`);
  if (val.version !== 1) throw new Error(`${label}.version: expected 1, got ${val.version}`);

  validateReviewSession(val.session, `${label}.session`);

  assertArray(val.comments, `${label}.comments`);
  (val.comments as unknown[]).forEach((c, i) =>
    validateReviewComment(c, `${label}.comments[${i}]`),
  );

  assertOptional(val.viewedFiles, `${label}.viewedFiles`, (v, l) => {
    assertArray(v, l);
    (v as unknown[]).forEach((vf, i) => validateViewedFile(vf, `${l}[${i}]`));
  });

  assertOptional(val.autoMarkRules, `${label}.autoMarkRules`, (v, l) => {
    assertArray(v, l);
    (v as unknown[]).forEach((r, i) => assertOneOf(r, AUTO_MARK_RULES, `${l}[${i}]`));
  });

  return val as unknown as ReviewData;
}

// ---------------------------------------------------------------------------
// Response validators
// ---------------------------------------------------------------------------

export function validateFilesResponse(val: unknown): FilesResponse {
  assertObject(val, 'FilesResponse');
  assertArray(val.files, 'FilesResponse.files');
  (val.files as unknown[]).forEach((f, i) => validateDiffFile(f, `FilesResponse.files[${i}]`));

  assertOptional(val.diffHashes, 'FilesResponse.diffHashes', (v, l) => {
    assertObject(v, l);
    for (const [key, value] of Object.entries(v as Record<string, unknown>)) {
      assertString(key, `${l} key`);
      assertString(value, `${l}["${key}"]`);
    }
  });

  return val as unknown as FilesResponse;
}

export function validateDiffResponse(val: unknown): DiffResponse {
  assertObject(val, 'DiffResponse');
  assertString(val.diff, 'DiffResponse.diff');
  return val as unknown as DiffResponse;
}

export function validateSessionListResponse(val: unknown): SessionListResponse {
  assertObject(val, 'SessionListResponse');
  assertArray(val.sessions, 'SessionListResponse.sessions');
  (val.sessions as unknown[]).forEach((s, i) =>
    validateReviewData(s, `SessionListResponse.sessions[${i}]`),
  );
  assertNumber(val.total, 'SessionListResponse.total');
  assertNumber(val.page, 'SessionListResponse.page');
  assertNumber(val.limit, 'SessionListResponse.limit');
  return val as unknown as SessionListResponse;
}

export function validateSessionResponse(val: unknown): SessionResponse {
  assertObject(val, 'SessionResponse');
  validateReviewData(val.session, 'SessionResponse.session');
  return val as unknown as SessionResponse;
}

export function validateCreateCommentResponse(val: unknown): ReviewComment {
  return validateReviewComment(val, 'CreateCommentResponse');
}

export function validateUpdateCommentResponse(val: unknown): ReviewComment {
  return validateReviewComment(val, 'UpdateCommentResponse');
}

export function validateUpdateSessionStatusResponse(val: unknown): UpdateSessionStatusResponse {
  assertObject(val, 'UpdateSessionStatusResponse');
  validateReviewSession(val.session, 'UpdateSessionStatusResponse.session');
  return val as unknown as UpdateSessionStatusResponse;
}

export function validateViewedFileResponse(val: unknown): ViewedFile {
  return validateViewedFile(val, 'ViewedFileResponse');
}

export function validateAutoMarkRulesResponse(val: unknown): AutoMarkRulesResponse {
  assertObject(val, 'AutoMarkRulesResponse');
  assertArray(val.rules, 'AutoMarkRulesResponse.rules');
  (val.rules as unknown[]).forEach((r, i) =>
    assertOneOf(r, AUTO_MARK_RULES, `AutoMarkRulesResponse.rules[${i}]`),
  );
  assertArray(val.autoMarked, 'AutoMarkRulesResponse.autoMarked');
  (val.autoMarked as unknown[]).forEach((vf, i) =>
    validateViewedFile(vf, `AutoMarkRulesResponse.autoMarked[${i}]`),
  );
  return val as unknown as AutoMarkRulesResponse;
}

export function validateAutoMarkApplyResponse(val: unknown): AutoMarkApplyResponse {
  assertObject(val, 'AutoMarkApplyResponse');
  assertArray(val.autoMarked, 'AutoMarkApplyResponse.autoMarked');
  (val.autoMarked as unknown[]).forEach((vf, i) =>
    validateViewedFile(vf, `AutoMarkApplyResponse.autoMarked[${i}]`),
  );
  return val as unknown as AutoMarkApplyResponse;
}

export function validateCommitsResponse(val: unknown): CommitsResponse {
  assertObject(val, 'CommitsResponse');
  assertArray(val.commits, 'CommitsResponse.commits');
  (val.commits as unknown[]).forEach((c, i) =>
    validateCommitInfo(c, `CommitsResponse.commits[${i}]`),
  );
  return val as unknown as CommitsResponse;
}

export function validateCommitDiffResponse(val: unknown): DiffResponse {
  return validateDiffResponse(val);
}

export function validateCommitFilesResponse(val: unknown): FilesResponse {
  return validateFilesResponse(val);
}
