import { getBackend } from './backend-provider';
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
  RefsResponse,
  CommitsResponse,
  CommitDiffResponse,
  CommitFilesResponse,
} from '../types/review';

/** GET /api/files — Fetch the list of changed files for the given base/head/uncommitted params. */
export function fetchFiles(params: FilesQueryParams): Promise<FilesResponse> {
  return getBackend().fetchFiles(params);
}

/** GET /api/diff — Fetch raw diff text for the given base/head/uncommitted params. */
export function fetchDiff(params: DiffQueryParams): Promise<DiffResponse> {
  return getBackend().fetchDiff(params);
}

/** GET /api/sessions — List all review sessions. */
export function fetchSessions(): Promise<SessionListResponse> {
  return getBackend().fetchSessions();
}

/** GET /api/sessions/:commitSha — Fetch a single review session by its head commit SHA. */
export function fetchSession(commitSha: string): Promise<SessionResponse> {
  return getBackend().fetchSession(commitSha);
}

/** POST /api/sessions — Create a new review session. */
export function createSession(data: CreateSessionRequest): Promise<SessionResponse> {
  return getBackend().createSession(data);
}

/** DELETE /api/sessions/:commitSha — Delete a review session. */
export function deleteSession(commitSha: string): Promise<void> {
  return getBackend().deleteSession(commitSha);
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
  return getBackend().postComment(commitSha, data);
}

/** PATCH /api/sessions/:commitSha/comments/:commentId — Resolve or unresolve a comment. */
export function patchComment(
  commitSha: string,
  commentId: string,
  data: UpdateCommentRequest,
): Promise<UpdateCommentResponse> {
  return getBackend().patchComment(commitSha, commentId, data);
}

/** POST /api/sessions/:commitSha/viewed-files — Mark a file as viewed. */
export function markFileViewed(commitSha: string, path: string): Promise<ViewedFile> {
  return getBackend().markFileViewed(commitSha, path);
}

/** DELETE /api/sessions/:commitSha/viewed-files/:filePath — Unmark a file as viewed. */
export function unmarkFileViewed(commitSha: string, path: string): Promise<void> {
  return getBackend().unmarkFileViewed(commitSha, path);
}

/** PATCH /api/sessions/:commitSha — Update the status of a review session. */
export function updateSessionStatus(
  commitSha: string,
  data: UpdateSessionStatusRequest,
): Promise<UpdateSessionStatusResponse> {
  return getBackend().updateSessionStatus(commitSha, data);
}

/** PUT /api/sessions/:commitSha/auto-mark-rules — Update auto-mark rules and apply them. */
export function updateAutoMarkRules(
  commitSha: string,
  rules: AutoMarkRule[],
): Promise<AutoMarkRulesResponse> {
  return getBackend().updateAutoMarkRules(commitSha, rules);
}

/** POST /api/sessions/:commitSha/auto-mark-apply — Re-apply existing auto-mark rules. */
export function applyAutoMarkRules(commitSha: string): Promise<AutoMarkApplyResponse> {
  return getBackend().applyAutoMarkRules(commitSha);
}

/** GET /api/refs — Fetch branches and tags for the repository. */
export function fetchRefs(): Promise<RefsResponse> {
  return getBackend().fetchRefs();
}

/** GET /api/sessions/:commitSha/commits — Fetch the commit list for a session's base..head range. */
export function fetchCommits(commitSha: string): Promise<CommitsResponse> {
  return getBackend().fetchCommits(commitSha);
}

/** GET /api/commits/:commitHash/diff — Fetch the diff for a single commit. */
export function fetchCommitDiff(commitHash: string): Promise<CommitDiffResponse> {
  return getBackend().fetchCommitDiff(commitHash);
}

/** GET /api/commits/:commitHash/files — Fetch the changed files for a single commit. */
export function fetchCommitFiles(commitHash: string): Promise<CommitFilesResponse> {
  return getBackend().fetchCommitFiles(commitHash);
}
