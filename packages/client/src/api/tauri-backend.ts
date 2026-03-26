import type { Backend } from './backend';
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

type InvokeFn = (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;

/** Lazily import the Tauri invoke function so this module doesn't break in non-Tauri environments. */
async function getInvoke(): Promise<InvokeFn> {
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke;
}

/**
 * Tauri backend — each method maps to a Tauri command via `invoke`.
 * Command names follow Rust snake_case convention.
 */
export class TauriBackend implements Backend {
  // Files & Diff

  async fetchFiles(params: FilesQueryParams): Promise<FilesResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_files', {
      base: params.base,
      head: params.head,
      uncommitted: params.uncommitted,
    }) as Promise<FilesResponse>;
  }

  async fetchDiff(params: DiffQueryParams): Promise<DiffResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_diff', {
      base: params.base,
      head: params.head,
      uncommitted: params.uncommitted,
    }) as Promise<DiffResponse>;
  }

  // Sessions

  async fetchSessions(): Promise<SessionListResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_sessions') as Promise<SessionListResponse>;
  }

  async fetchSession(commitSha: string): Promise<SessionResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_session', { commitSha }) as Promise<SessionResponse>;
  }

  async createSession(data: CreateSessionRequest): Promise<SessionResponse> {
    const invoke = await getInvoke();
    return invoke('create_session', {
      title: data.title,
      baseRef: data.baseRef,
      headRef: data.headRef,
    }) as Promise<SessionResponse>;
  }

  async deleteSession(commitSha: string): Promise<void> {
    const invoke = await getInvoke();
    await invoke('delete_session', { commitSha });
  }

  async updateSessionStatus(
    commitSha: string,
    data: UpdateSessionStatusRequest,
  ): Promise<UpdateSessionStatusResponse> {
    const invoke = await getInvoke();
    return invoke('update_session_status', {
      commitSha,
      status: data.status,
    }) as Promise<UpdateSessionStatusResponse>;
  }

  // Comments

  async postComment(commitSha: string, data: CreateCommentRequest): Promise<CreateCommentResponse> {
    const invoke = await getInvoke();
    return invoke('post_comment', { commitSha, ...data }) as Promise<CreateCommentResponse>;
  }

  async patchComment(
    commitSha: string,
    commentId: string,
    data: UpdateCommentRequest,
  ): Promise<UpdateCommentResponse> {
    const invoke = await getInvoke();
    return invoke('patch_comment', {
      commitSha,
      commentId,
      resolved: data.resolved,
    }) as Promise<UpdateCommentResponse>;
  }

  // Viewed files

  async markFileViewed(commitSha: string, path: string): Promise<ViewedFile> {
    const invoke = await getInvoke();
    return invoke('mark_file_viewed', { commitSha, path }) as Promise<ViewedFile>;
  }

  async unmarkFileViewed(commitSha: string, path: string): Promise<void> {
    const invoke = await getInvoke();
    await invoke('unmark_file_viewed', { commitSha, path });
  }

  // Auto-mark rules

  async updateAutoMarkRules(
    commitSha: string,
    rules: AutoMarkRule[],
  ): Promise<AutoMarkRulesResponse> {
    const invoke = await getInvoke();
    return invoke('update_auto_mark_rules', { commitSha, rules }) as Promise<AutoMarkRulesResponse>;
  }

  async applyAutoMarkRules(commitSha: string): Promise<AutoMarkApplyResponse> {
    const invoke = await getInvoke();
    return invoke('apply_auto_mark_rules', { commitSha }) as Promise<AutoMarkApplyResponse>;
  }

  // Commits

  async fetchCommits(commitSha: string): Promise<CommitsResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_commits', { commitSha }) as Promise<CommitsResponse>;
  }

  async fetchCommitDiff(commitHash: string): Promise<CommitDiffResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_commit_diff', { commitHash }) as Promise<CommitDiffResponse>;
  }

  async fetchCommitFiles(commitHash: string): Promise<CommitFilesResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_commit_files', { commitHash }) as Promise<CommitFilesResponse>;
  }
}
