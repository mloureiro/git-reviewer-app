import { apiGet, apiPost, apiPatch } from './client';
import type {
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

/** PATCH /api/sessions/:commitSha — Update the status of a review session. */
export function updateSessionStatus(
  commitSha: string,
  data: UpdateSessionStatusRequest,
): Promise<UpdateSessionStatusResponse> {
  return apiPatch<UpdateSessionStatusResponse>(`/api/sessions/${commitSha}`, data);
}
