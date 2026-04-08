import type { ReviewStatus } from '@git-reviewer/shared';

export type {
  AutoMarkRule,
  CommitInfo,
  ReviewComment,
  ReviewStatus,
  ReviewSession,
  ReviewData,
  SessionHealth,
  SessionHealthReason,
  SessionStats,
  DiffFile,
  ViewedFile,
} from '@git-reviewer/shared';

export type {
  ApiSuccessResponse,
  ApiErrorResponse,
  FilesQueryParams,
  FilesResponse,
  DiffQueryParams,
  DiffResponse,
  SessionListResponse,
  CreateSessionRequest,
  SessionResponse,
  CreateCommentRequest,
  CreateCommentResponse,
  CommentsResponse,
  UpdateCommentRequest,
  UpdateCommentResponse,
  UpdateSessionStatusRequest,
  UpdateSessionStatusResponse,
  AutoMarkRulesResponse,
  AutoMarkApplyResponse,
  ViewedFileResponse,
  ResolveRefsResponse,
  RefsResponse,
  CommitsResponse,
  ReposResponse,
  ValidateSessionsResponse,
  CommitDiffResponse,
  CommitFilesResponse,
} from '@git-reviewer/shared';

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
