import type {
  ReviewComment,
  ReviewStatus,
  ReviewData,
  DiffFile,
  AutoMarkRule,
  ViewedFile,
  CommitInfo,
  SessionHealth,
} from '@git-reviewer/shared';

export type {
  AutoMarkRule,
  CommitInfo,
  ReviewComment,
  ReviewStatus,
  ReviewSession,
  ReviewData,
  SessionHealth,
  SessionHealthReason,
  DiffFile,
  ViewedFile,
} from '@git-reviewer/shared';

// Generic API response envelopes

/** Successful response wrapper for list endpoints */
export interface ApiSuccessResponse<T> {
  data: T;
}

/** Error response returned by the server on failure */
export interface ApiErrorResponse {
  error: string;
}

// GET /api/files
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

// GET /api/diff
export interface DiffQueryParams {
  base?: string;
  head?: string;
  uncommitted?: 'true' | 'false';
  repo?: string;
}

export interface DiffResponse {
  diff: string;
}

// GET /api/sessions
export interface SessionListResponse {
  sessions: ReviewData[];
}

// POST /api/sessions
export interface CreateSessionRequest {
  title: string;
  baseRef: string;
  headRef: string;
}

/** Response for POST /api/sessions (201) and GET /api/sessions/:commitSha (200) */
export type SessionResponse = ReviewData;

// POST /api/sessions/:commitSha/comments
export type CreateCommentRequest = Omit<ReviewComment, 'id' | 'createdAt' | 'resolved'>;

/** Response for POST /api/sessions/:commitSha/comments (201) */
export type CreateCommentResponse = ReviewComment;

// GET /api/sessions/:commitSha/comments (extracted from session response)
/** Response shape for fetchComments — the comments array from a session. */
export interface CommentsResponse {
  comments: ReviewComment[];
}

// PATCH /api/sessions/:commitSha/comments/:commentId
export interface UpdateCommentRequest {
  resolved: boolean;
}

/** Response for PATCH /api/sessions/:commitSha/comments/:commentId */
export type UpdateCommentResponse = ReviewComment;

// PATCH /api/sessions/:commitSha
export interface UpdateSessionStatusRequest {
  status: ReviewStatus;
}

/** Response for PATCH /api/sessions/:commitSha */
export type UpdateSessionStatusResponse = ReviewData['session'];

// PUT /api/sessions/:commitSha/auto-mark-rules
export interface AutoMarkRulesResponse {
  rules: AutoMarkRule[];
  autoMarked: ViewedFile[];
}

// POST /api/sessions/:commitSha/auto-mark-apply
export interface AutoMarkApplyResponse {
  autoMarked: ViewedFile[];
}

// GET /api/resolve-refs
export interface ResolveRefsResponse {
  refs: Record<string, string>;
}

// GET /api/refs
export interface RefsResponse {
  branches: string[];
  tags: string[];
  currentBranch: string;
}

// GET /api/sessions/:commitSha/commits
export interface CommitsResponse {
  commits: CommitInfo[];
}

// GET /api/repos
export interface ReposResponse {
  repos: string[];
}

// GET /api/sessions/validate
export interface ValidateSessionsResponse {
  health: Record<string, SessionHealth>;
}

// GET /api/commits/:commitHash/diff
export type CommitDiffResponse = DiffResponse;

// GET /api/commits/:commitHash/files
export type CommitFilesResponse = FilesResponse;

// Client-only UI types (not API types)

/**
 * Shape of data needed to create a new comment from the review UI.
 * Excludes server-assigned fields (id, author, createdAt, resolved).
 */
export interface CommentFormData {
  file: string;
  line: number;
  side: 'left' | 'right';
  body: string;
}

/**
 * Metadata for a clickable diff line, captured when the user clicks a line
 * in the diff view. Used by the inline comment UI to know which line was clicked.
 */
export interface DiffLineData {
  file: string;
  line: number;
  side: 'left' | 'right';
  content: string;
}

/**
 * Display metadata for a given ReviewStatus value.
 * Used by StatusBadge to render the correct label and color variant.
 */
export interface ReviewStatusMeta {
  label: string;
  /** Semantic color variant key for CSS styling. */
  variant: 'neutral' | 'success' | 'warning';
}

/** Lookup map from each ReviewStatus to its display metadata. */
export type ReviewStatusMetaMap = Record<ReviewStatus, ReviewStatusMeta>;

/**
 * Aggregated comment counts for a review session.
 * Used by ReviewSummaryBar to show total and unresolved comment tallies.
 */
export interface ReviewSummaryStats {
  total: number;
  unresolved: number;
}

/**
 * Diff display mode — controls whether the diff is rendered line-by-line
 * (unified) or side-by-side (split view).
 */
export type DiffViewMode = 'line-by-line' | 'side-by-side';
