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
  CommitsResponse,
  CommitDiffResponse,
  CommitFilesResponse,
  ReposResponse,
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
export function fetchSession(commitSha: string, repo?: string): Promise<SessionResponse> {
  return getBackend().fetchSession(commitSha, repo);
}

/** POST /api/sessions — Create a new review session. */
export function createSession(data: CreateSessionRequest, repo?: string): Promise<SessionResponse> {
  return getBackend().createSession(data, repo);
}

/** DELETE /api/sessions/:commitSha — Delete a review session. */
export function deleteSession(commitSha: string, repo?: string): Promise<void> {
  return getBackend().deleteSession(commitSha, repo);
}

/**
 * GET /api/sessions/:commitSha/comments — Fetch all comments for a review session.
 * Comments are stored as part of the session in git-notes, so this extracts them
 * from the full session response rather than a dedicated endpoint.
 */
export async function fetchComments(commitSha: string, repo?: string): Promise<CommentsResponse> {
  const session = await fetchSession(commitSha, repo);
  return { comments: session.comments };
}

/** POST /api/sessions/:commitSha/comments — Add a comment to a review session. */
export function postComment(
  commitSha: string,
  data: CreateCommentRequest,
  repo?: string,
): Promise<CreateCommentResponse> {
  return getBackend().postComment(commitSha, data, repo);
}

/** PATCH /api/sessions/:commitSha/comments/:commentId — Resolve or unresolve a comment. */
export function patchComment(
  commitSha: string,
  commentId: string,
  data: UpdateCommentRequest,
  repo?: string,
): Promise<UpdateCommentResponse> {
  return getBackend().patchComment(commitSha, commentId, data, repo);
}

/** POST /api/sessions/:commitSha/viewed-files — Mark a file as viewed. */
export function markFileViewed(
  commitSha: string,
  path: string,
  repo?: string,
): Promise<ViewedFile> {
  return getBackend().markFileViewed(commitSha, path, repo);
}

/** DELETE /api/sessions/:commitSha/viewed-files/:filePath — Unmark a file as viewed. */
export function unmarkFileViewed(commitSha: string, path: string, repo?: string): Promise<void> {
  return getBackend().unmarkFileViewed(commitSha, path, repo);
}

/** PATCH /api/sessions/:commitSha — Update the status of a review session. */
export function updateSessionStatus(
  commitSha: string,
  data: UpdateSessionStatusRequest,
  repo?: string,
): Promise<UpdateSessionStatusResponse> {
  return getBackend().updateSessionStatus(commitSha, data, repo);
}

/** PUT /api/sessions/:commitSha/auto-mark-rules — Update auto-mark rules and apply them. */
export function updateAutoMarkRules(
  commitSha: string,
  rules: AutoMarkRule[],
  repo?: string,
): Promise<AutoMarkRulesResponse> {
  return getBackend().updateAutoMarkRules(commitSha, rules, repo);
}

/** POST /api/sessions/:commitSha/auto-mark-apply — Re-apply existing auto-mark rules. */
export function applyAutoMarkRules(
  commitSha: string,
  repo?: string,
): Promise<AutoMarkApplyResponse> {
  return getBackend().applyAutoMarkRules(commitSha, repo);
}

/** GET /api/refs — Fetch branches and tags for the repository. */
export function fetchRefs(repo?: string): Promise<RefsResponse> {
  return getBackend().fetchRefs(repo);
}

/** GET /api/resolve-refs — Resolve ref names to commit hashes. */
export function resolveRefs(refs: string[], repo?: string): Promise<ResolveRefsResponse> {
  return getBackend().resolveRefs(refs, repo);
}

/** GET /api/repos — Fetch the list of registered repositories. */
export function fetchRepos(): Promise<ReposResponse> {
  return getBackend().fetchRepos();
}

/** DELETE /api/repos — Remove a repository from the registry. */
export function removeRepo(path: string): Promise<void> {
  return getBackend().removeRepo(path);
}

/** GET /api/sessions/:commitSha/commits — Fetch the commit list for a session's base..head range. */
export function fetchCommits(commitSha: string, repo?: string): Promise<CommitsResponse> {
  return getBackend().fetchCommits(commitSha, repo);
}

/** GET /api/commits/:commitHash/diff — Fetch the diff for a single commit. */
export function fetchCommitDiff(commitHash: string, repo?: string): Promise<CommitDiffResponse> {
  return getBackend().fetchCommitDiff(commitHash, repo);
}

/** GET /api/commits/:commitHash/files — Fetch the changed files for a single commit. */
export function fetchCommitFiles(commitHash: string, repo?: string): Promise<CommitFilesResponse> {
  return getBackend().fetchCommitFiles(commitHash, repo);
}
