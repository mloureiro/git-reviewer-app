/**
 * API request/response types shared between the client and server.
 *
 * These types describe the HTTP contract for every endpoint in the
 * git-reviewer API. Both packages/server and packages/client import
 * from this module so the contract is enforced at compile time on
 * both sides.
 */

import type {
  DiffFile,
  ReviewComment,
  ReviewData,
  ReviewSession,
  ReviewStatus,
  AutoMarkRule,
  ViewedFile,
  CommitInfo,
  SessionHealth,
  SessionStats,
} from './types.js';

// ---------------------------------------------------------------------------
// Generic API response envelopes
// ---------------------------------------------------------------------------

/** Successful response wrapper for list endpoints */
export interface ApiSuccessResponse<T> {
  data: T;
}

/** Error response returned by the server on failure */
export interface ApiErrorResponse {
  error: string;
}

// ---------------------------------------------------------------------------
// GET /api/files
// ---------------------------------------------------------------------------

export interface FilesQueryParams {
  base?: string;
  head?: string;
  uncommitted?: 'true' | 'false';
  repo?: string;
}

export interface FilesResponse {
  files: DiffFile[];
  diffHashes?: Record<string, string>;
}

// ---------------------------------------------------------------------------
// GET /api/diff
// ---------------------------------------------------------------------------

export interface DiffQueryParams {
  base?: string;
  head?: string;
  uncommitted?: 'true' | 'false';
  repo?: string;
}

export interface DiffResponse {
  diff: string;
}

// ---------------------------------------------------------------------------
// GET /api/sessions
// ---------------------------------------------------------------------------

export interface SessionListResponse {
  sessions: ReviewData[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// POST /api/sessions
// ---------------------------------------------------------------------------

export interface CreateSessionRequest {
  title: string;
  baseRef: string;
  headRef: string;
}

/** Response for POST /api/sessions (201) and GET /api/sessions/:commitSha (200) */
export interface SessionResponse {
  session: ReviewData;
}

// ---------------------------------------------------------------------------
// POST /api/sessions/:commitSha/comments
// ---------------------------------------------------------------------------

export type CreateCommentRequest = Omit<ReviewComment, 'id' | 'createdAt' | 'resolved'>;

/** Response for POST /api/sessions/:commitSha/comments (201) */
export type CreateCommentResponse = ReviewComment;

// ---------------------------------------------------------------------------
// GET /api/sessions/:commitSha/comments (extracted from session response)
// ---------------------------------------------------------------------------

/** Response shape for fetchComments — the comments array from a session. */
export interface CommentsResponse {
  comments: ReviewComment[];
}

// ---------------------------------------------------------------------------
// PATCH /api/sessions/:commitSha/comments/:commentId
// ---------------------------------------------------------------------------

export interface UpdateCommentRequest {
  resolved?: boolean;
  body?: string;
}

/** Response for PATCH /api/sessions/:commitSha/comments/:commentId */
export type UpdateCommentResponse = ReviewComment;

// ---------------------------------------------------------------------------
// PATCH /api/sessions/:commitSha
// ---------------------------------------------------------------------------

export interface UpdateSessionStatusRequest {
  status: ReviewStatus;
}

/** Response for PATCH /api/sessions/:commitSha */
export interface UpdateSessionStatusResponse {
  session: ReviewSession;
}

// ---------------------------------------------------------------------------
// PUT /api/sessions/:commitSha/auto-mark-rules
// ---------------------------------------------------------------------------

export interface AutoMarkRulesRequest {
  rules: AutoMarkRule[];
}

export interface AutoMarkRulesResponse {
  rules: AutoMarkRule[];
  autoMarked: ViewedFile[];
}

// ---------------------------------------------------------------------------
// PUT /api/sessions/:commitSha/viewed-files/:filePath
// ---------------------------------------------------------------------------

export type ViewedFileResponse = ViewedFile;

// ---------------------------------------------------------------------------
// POST /api/sessions/:commitSha/auto-mark-apply
// ---------------------------------------------------------------------------

export interface AutoMarkApplyResponse {
  autoMarked: ViewedFile[];
}

// ---------------------------------------------------------------------------
// GET /api/resolve-refs
// ---------------------------------------------------------------------------

export interface ResolveRefsResponse {
  refs: Record<string, string>;
}

// ---------------------------------------------------------------------------
// GET /api/refs
// ---------------------------------------------------------------------------

export interface RefsResponse {
  branches: string[];
  remoteBranches: string[];
  tags: string[];
  currentBranch: string;
}

// ---------------------------------------------------------------------------
// GET /api/sessions/:commitSha/commits
// ---------------------------------------------------------------------------

export interface CommitsResponse {
  commits: CommitInfo[];
}

// ---------------------------------------------------------------------------
// GET /api/repos
// ---------------------------------------------------------------------------

export interface ReposResponse {
  repos: string[];
}

// ---------------------------------------------------------------------------
// GET /api/sessions/validate
// ---------------------------------------------------------------------------

export interface ValidateSessionsResponse {
  health: Record<string, SessionHealth>;
  stats: Record<string, SessionStats>;
}

// ---------------------------------------------------------------------------
// GET /api/commits/:commitHash/diff
// ---------------------------------------------------------------------------

export type CommitDiffResponse = DiffResponse;

// ---------------------------------------------------------------------------
// GET /api/commits/:commitHash/files
// ---------------------------------------------------------------------------

export type CommitFilesResponse = FilesResponse;
