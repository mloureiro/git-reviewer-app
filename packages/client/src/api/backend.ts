import type {
  AutoMarkRule,
  FilesQueryParams,
  FilesResponse,
  DiffQueryParams,
  DiffResponse,
  SessionListResponse,
  SessionResponse,
  CreateSessionRequest,
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

/**
 * Contract that both backends (HTTP REST and Tauri IPC) must fulfill.
 * Every method maps 1:1 to a server endpoint or Tauri command.
 */
export interface Backend {
  // Files & Diff
  fetchFiles(params: FilesQueryParams): Promise<FilesResponse>;
  fetchDiff(params: DiffQueryParams): Promise<DiffResponse>;

  // Sessions
  fetchSessions(): Promise<SessionListResponse>;
  fetchSession(commitSha: string, repo?: string): Promise<SessionResponse>;
  createSession(data: CreateSessionRequest, repo?: string): Promise<SessionResponse>;
  deleteSession(commitSha: string, repo?: string): Promise<void>;
  updateSessionStatus(
    commitSha: string,
    data: UpdateSessionStatusRequest,
    repo?: string,
  ): Promise<UpdateSessionStatusResponse>;

  // Comments
  postComment(
    commitSha: string,
    data: CreateCommentRequest,
    repo?: string,
  ): Promise<CreateCommentResponse>;
  patchComment(
    commitSha: string,
    commentId: string,
    data: UpdateCommentRequest,
    repo?: string,
  ): Promise<UpdateCommentResponse>;

  // Viewed files
  markFileViewed(commitSha: string, path: string, repo?: string): Promise<ViewedFile>;
  unmarkFileViewed(commitSha: string, path: string, repo?: string): Promise<void>;

  // Auto-mark rules
  updateAutoMarkRules(
    commitSha: string,
    rules: AutoMarkRule[],
    repo?: string,
  ): Promise<AutoMarkRulesResponse>;
  applyAutoMarkRules(commitSha: string, repo?: string): Promise<AutoMarkApplyResponse>;

  // Refs
  fetchRefs(repo?: string): Promise<RefsResponse>;
  resolveRefs(refs: string[], repo?: string): Promise<ResolveRefsResponse>;

  // Repos
  fetchRepos(): Promise<ReposResponse>;

  // Commits
  fetchCommits(commitSha: string, repo?: string): Promise<CommitsResponse>;
  fetchCommitDiff(commitHash: string, repo?: string): Promise<CommitDiffResponse>;
  fetchCommitFiles(commitHash: string, repo?: string): Promise<CommitFilesResponse>;
}
