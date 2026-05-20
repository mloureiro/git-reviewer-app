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
  MergeBaseResponse,
  CommitsResponse,
  CommitDiffResponse,
  CommitFilesResponse,
  ReposResponse,
  ValidateSessionsResponse,
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
  validateSessions(): Promise<ValidateSessionsResponse>;
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
  deleteComment(commitSha: string, commentId: string, repo?: string): Promise<void>;

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
  fetchMergeBase(base: string, head: string, repo?: string): Promise<MergeBaseResponse>;

  // Repos
  fetchRepos(): Promise<ReposResponse>;
  removeRepo(path: string): Promise<void>;

  // Commits
  fetchCommits(commitSha: string, repo?: string): Promise<CommitsResponse>;
  fetchCommitDiff(commitHash: string, repo?: string): Promise<CommitDiffResponse>;
  fetchCommitFiles(commitHash: string, repo?: string): Promise<CommitFilesResponse>;
}
