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
  ResolveRefsResponse,
  MergeBaseResponse,
  CommitsResponse,
  CommitDiffResponse,
  CommitFilesResponse,
  ReposResponse,
  ValidateSessionsResponse,
} from '../types/review';

/** GET /api/v1/files — Fetch the list of changed files for the given base/head/uncommitted params. */
export function fetchFiles(params: FilesQueryParams): Promise<FilesResponse> {
  return getBackend().fetchFiles(params);
}

/** GET /api/v1/diff — Fetch raw diff text for the given base/head/uncommitted params. */
export function fetchDiff(params: DiffQueryParams): Promise<DiffResponse> {
  return getBackend().fetchDiff(params);
}

/** GET /api/v1/sessions — List all review sessions. */
export function fetchSessions(): Promise<SessionListResponse> {
  return getBackend().fetchSessions();
}

/** GET /api/v1/sessions/validate — Validate all sessions (check refs, detect stale). */
export function validateSessions(): Promise<ValidateSessionsResponse> {
  return getBackend().validateSessions();
}

/** GET /api/v1/sessions/:commitSha — Fetch a single review session by its head commit SHA. */
export function fetchSession(commitSha: string, repo?: string): Promise<SessionResponse> {
  return getBackend().fetchSession(commitSha, repo);
}

/** POST /api/v1/sessions — Create a new review session. */
export function createSession(data: CreateSessionRequest, repo?: string): Promise<SessionResponse> {
  return getBackend().createSession(data, repo);
}

/** DELETE /api/v1/sessions/:commitSha — Delete a review session. */
export function deleteSession(commitSha: string, repo?: string): Promise<void> {
  return getBackend().deleteSession(commitSha, repo);
}

/**
 * GET /api/v1/sessions/:commitSha/comments — Fetch all comments for a review session.
 * Comments are stored as part of the session in git-notes, so this extracts them
 * from the full session response rather than a dedicated endpoint.
 */
export async function fetchComments(commitSha: string, repo?: string): Promise<CommentsResponse> {
  const response = await fetchSession(commitSha, repo);
  return { comments: response.session.comments };
}

/** POST /api/v1/sessions/:commitSha/comments — Add a comment to a review session. */
export function postComment(
  commitSha: string,
  data: CreateCommentRequest,
  repo?: string,
): Promise<CreateCommentResponse> {
  return getBackend().postComment(commitSha, data, repo);
}

/** PATCH /api/v1/sessions/:commitSha/comments/:commentId — Resolve or unresolve a comment. */
export function patchComment(
  commitSha: string,
  commentId: string,
  data: UpdateCommentRequest,
  repo?: string,
): Promise<UpdateCommentResponse> {
  return getBackend().patchComment(commitSha, commentId, data, repo);
}

/** DELETE /api/v1/sessions/:commitSha/comments/:commentId — Delete a comment. */
export function deleteComment(commitSha: string, commentId: string, repo?: string): Promise<void> {
  return getBackend().deleteComment(commitSha, commentId, repo);
}

/** PUT /api/v1/sessions/:commitSha/viewed-files/:filePath — Mark a file as viewed. */
export function markFileViewed(
  commitSha: string,
  path: string,
  repo?: string,
): Promise<ViewedFile> {
  return getBackend().markFileViewed(commitSha, path, repo);
}

/** DELETE /api/v1/sessions/:commitSha/viewed-files/:filePath — Unmark a file as viewed. */
export function unmarkFileViewed(commitSha: string, path: string, repo?: string): Promise<void> {
  return getBackend().unmarkFileViewed(commitSha, path, repo);
}

/** PATCH /api/v1/sessions/:commitSha — Update the status of a review session. */
export function updateSessionStatus(
  commitSha: string,
  data: UpdateSessionStatusRequest,
  repo?: string,
): Promise<UpdateSessionStatusResponse> {
  return getBackend().updateSessionStatus(commitSha, data, repo);
}

/** PUT /api/v1/sessions/:commitSha/auto-mark-rules — Update auto-mark rules and apply them. */
export function updateAutoMarkRules(
  commitSha: string,
  rules: AutoMarkRule[],
  repo?: string,
): Promise<AutoMarkRulesResponse> {
  return getBackend().updateAutoMarkRules(commitSha, rules, repo);
}

/** POST /api/v1/sessions/:commitSha/auto-mark-apply — Re-apply existing auto-mark rules. */
export function applyAutoMarkRules(
  commitSha: string,
  repo?: string,
): Promise<AutoMarkApplyResponse> {
  return getBackend().applyAutoMarkRules(commitSha, repo);
}

/** GET /api/v1/refs — Fetch branches and tags for the repository. */
export function fetchRefs(repo?: string): Promise<RefsResponse> {
  return getBackend().fetchRefs(repo);
}

/** GET /api/v1/resolve-refs — Resolve ref names to commit hashes. */
export function resolveRefs(refs: string[], repo?: string): Promise<ResolveRefsResponse> {
  return getBackend().resolveRefs(refs, repo);
}

/** GET /api/v1/merge-base — Find the fork-point SHA between base and head. */
export function fetchMergeBase(
  base: string,
  head: string,
  repo?: string,
): Promise<MergeBaseResponse> {
  return getBackend().fetchMergeBase(base, head, repo);
}

/** GET /api/v1/repos — Fetch the list of registered repositories. */
export function fetchRepos(): Promise<ReposResponse> {
  return getBackend().fetchRepos();
}

/** DELETE /api/v1/repos — Remove a repository from the registry. */
export function removeRepo(path: string): Promise<void> {
  return getBackend().removeRepo(path);
}

/** GET /api/v1/sessions/:commitSha/commits — Fetch the commit list for a session's base..head range. */
export function fetchCommits(commitSha: string, repo?: string): Promise<CommitsResponse> {
  return getBackend().fetchCommits(commitSha, repo);
}

/** GET /api/v1/commits/:commitHash/diff — Fetch the diff for a single commit. */
export function fetchCommitDiff(commitHash: string, repo?: string): Promise<CommitDiffResponse> {
  return getBackend().fetchCommitDiff(commitHash, repo);
}

/** GET /api/v1/commits/:commitHash/files — Fetch the changed files for a single commit. */
export function fetchCommitFiles(commitHash: string, repo?: string): Promise<CommitFilesResponse> {
  return getBackend().fetchCommitFiles(commitHash, repo);
}
