import type { ReviewComment, ReviewStatus, ReviewData } from '@git-reviewer/shared';

export type {
  ReviewComment,
  ReviewStatus,
  ReviewSession,
  ReviewData,
  DiffFile,
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

// GET /api/diff
export interface DiffQueryParams {
  base?: string;
  head?: string;
  uncommitted?: 'true' | 'false';
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
