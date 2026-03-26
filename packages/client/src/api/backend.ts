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
  CommitsResponse,
  CommitDiffResponse,
  CommitFilesResponse,
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
  fetchSession(commitSha: string): Promise<SessionResponse>;
  createSession(data: CreateSessionRequest): Promise<SessionResponse>;
  deleteSession(commitSha: string): Promise<void>;
  updateSessionStatus(
    commitSha: string,
    data: UpdateSessionStatusRequest,
  ): Promise<UpdateSessionStatusResponse>;

  // Comments
  postComment(commitSha: string, data: CreateCommentRequest): Promise<CreateCommentResponse>;
  patchComment(
    commitSha: string,
    commentId: string,
    data: UpdateCommentRequest,
  ): Promise<UpdateCommentResponse>;

  // Viewed files
  markFileViewed(commitSha: string, path: string): Promise<ViewedFile>;
  unmarkFileViewed(commitSha: string, path: string): Promise<void>;

  // Auto-mark rules
  updateAutoMarkRules(commitSha: string, rules: AutoMarkRule[]): Promise<AutoMarkRulesResponse>;
  applyAutoMarkRules(commitSha: string): Promise<AutoMarkApplyResponse>;

  // Commits
  fetchCommits(commitSha: string): Promise<CommitsResponse>;
  fetchCommitDiff(commitHash: string): Promise<CommitDiffResponse>;
  fetchCommitFiles(commitHash: string): Promise<CommitFilesResponse>;
}
