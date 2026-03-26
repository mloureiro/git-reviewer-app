import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client';
import type {
  AutoMarkRule,
  FilesQueryParams,
  FilesResponse,
  DiffQueryParams,
  DiffResponse,
  SessionListResponse,
  SessionResponse,
  CreateSessionRequest,
  CommentsResponse,
  CreateCommentRequest,
  CreateCommentResponse,
  UpdateCommentRequest,
  UpdateCommentResponse,
  UpdateSessionStatusRequest,
  UpdateSessionStatusResponse,
  ViewedFile,
  AutoMarkRulesResponse,
  AutoMarkApplyResponse,
  CommitsResponse,
  CommitDiffResponse,
  CommitFilesResponse,
} from '../types/review';

/** GET /api/files — Fetch the list of changed files for the given base/head/uncommitted params. */
export function fetchFiles(params: FilesQueryParams): Promise<FilesResponse> {
  const query = new URLSearchParams();

  if (params.base !== undefined) {
    query.set('base', params.base);
  }
  if (params.head !== undefined) {
    query.set('head', params.head);
  }
  if (params.uncommitted !== undefined) {
    query.set('uncommitted', params.uncommitted);
  }

  const qs = query.toString();
  return apiGet<FilesResponse>(`/api/files${qs ? `?${qs}` : ''}`);
}

/** GET /api/diff — Fetch raw diff text for the given base/head/uncommitted params. */
export function fetchDiff(params: DiffQueryParams): Promise<DiffResponse> {
  const query = new URLSearchParams();

  if (params.base !== undefined) {
    query.set('base', params.base);
  }
  if (params.head !== undefined) {
    query.set('head', params.head);
  }
  if (params.uncommitted !== undefined) {
    query.set('uncommitted', params.uncommitted);
  }

  const qs = query.toString();
  return apiGet<DiffResponse>(`/api/diff${qs ? `?${qs}` : ''}`);
}

/** GET /api/sessions — List all review sessions. */
export function fetchSessions(): Promise<SessionListResponse> {
  return apiGet<SessionListResponse>('/api/sessions');
}

/** GET /api/sessions/:commitSha — Fetch a single review session by its head commit SHA. */
export function fetchSession(commitSha: string): Promise<SessionResponse> {
  return apiGet<SessionResponse>(`/api/sessions/${commitSha}`);
}

/** POST /api/sessions — Create a new review session. */
export function createSession(data: CreateSessionRequest): Promise<SessionResponse> {
  return apiPost<SessionResponse>('/api/sessions', data);
}

/**
 * GET /api/sessions/:commitSha/comments — Fetch all comments for a review session.
 * Comments are stored as part of the session in git-notes, so this extracts them
 * from the full session response rather than a dedicated endpoint.
 */
export async function fetchComments(commitSha: string): Promise<CommentsResponse> {
  const session = await fetchSession(commitSha);
  return { comments: session.comments };
}

/** POST /api/sessions/:commitSha/comments — Add a comment to a review session. */
export function postComment(
  commitSha: string,
  data: CreateCommentRequest,
): Promise<CreateCommentResponse> {
  return apiPost<CreateCommentResponse>(`/api/sessions/${commitSha}/comments`, data);
}

/** PATCH /api/sessions/:commitSha/comments/:commentId — Resolve or unresolve a comment. */
export function patchComment(
  commitSha: string,
  commentId: string,
  data: UpdateCommentRequest,
): Promise<UpdateCommentResponse> {
  return apiPatch<UpdateCommentResponse>(`/api/sessions/${commitSha}/comments/${commentId}`, data);
}

/** POST /api/sessions/:commitSha/viewed-files — Mark a file as viewed. */
export function markFileViewed(commitSha: string, path: string): Promise<ViewedFile> {
  return apiPost<ViewedFile>(`/api/sessions/${commitSha}/viewed-files`, { path });
}

/** DELETE /api/sessions/:commitSha/viewed-files/:filePath — Unmark a file as viewed. */
export function unmarkFileViewed(commitSha: string, path: string): Promise<void> {
  return apiDelete(`/api/sessions/${commitSha}/viewed-files/${encodeURIComponent(path)}`);
}

/** PATCH /api/sessions/:commitSha — Update the status of a review session. */
export function updateSessionStatus(
  commitSha: string,
  data: UpdateSessionStatusRequest,
): Promise<UpdateSessionStatusResponse> {
  return apiPatch<UpdateSessionStatusResponse>(`/api/sessions/${commitSha}`, data);
}

/** PUT /api/sessions/:commitSha/auto-mark-rules — Update auto-mark rules and apply them. */
export function updateAutoMarkRules(
  commitSha: string,
  rules: AutoMarkRule[],
): Promise<AutoMarkRulesResponse> {
  return apiPut<AutoMarkRulesResponse>(`/api/sessions/${commitSha}/auto-mark-rules`, { rules });
}

/** POST /api/sessions/:commitSha/auto-mark-apply — Re-apply existing auto-mark rules. */
export function applyAutoMarkRules(commitSha: string): Promise<AutoMarkApplyResponse> {
  return apiPost<AutoMarkApplyResponse>(`/api/sessions/${commitSha}/auto-mark-apply`, {});
}

/** GET /api/sessions/:commitSha/commits — Fetch the commit list for a session's base..head range. */
export function fetchCommits(commitSha: string): Promise<CommitsResponse> {
  return apiGet<CommitsResponse>(`/api/sessions/${commitSha}/commits`);
}

/** GET /api/commits/:commitHash/diff — Fetch the diff for a single commit. */
export function fetchCommitDiff(commitHash: string): Promise<CommitDiffResponse> {
  return apiGet<CommitDiffResponse>(`/api/commits/${commitHash}/diff`);
}

/** GET /api/commits/:commitHash/files — Fetch the changed files for a single commit. */
export function fetchCommitFiles(commitHash: string): Promise<CommitFilesResponse> {
  return apiGet<CommitFilesResponse>(`/api/commits/${commitHash}/files`);
}
