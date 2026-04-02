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
  RefsResponse,
  ResolveRefsResponse,
  CommitsResponse,
  CommitDiffResponse,
  CommitFilesResponse,
  ReposResponse,
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
      repo: params.repo,
    }) as Promise<FilesResponse>;
  }

  async fetchDiff(params: DiffQueryParams): Promise<DiffResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_diff', {
      base: params.base,
      head: params.head,
      uncommitted: params.uncommitted,
      repo: params.repo,
    }) as Promise<DiffResponse>;
  }

  // Sessions

  async fetchSessions(): Promise<SessionListResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_sessions') as Promise<SessionListResponse>;
  }

  async fetchSession(commitSha: string, repo?: string): Promise<SessionResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_session', { commitSha, repo }) as Promise<SessionResponse>;
  }

  async createSession(data: CreateSessionRequest, repo?: string): Promise<SessionResponse> {
    const invoke = await getInvoke();
    return invoke('create_session', {
      title: data.title,
      baseRef: data.baseRef,
      headRef: data.headRef,
      repo,
    }) as Promise<SessionResponse>;
  }

  async deleteSession(commitSha: string, repo?: string): Promise<void> {
    const invoke = await getInvoke();
    await invoke('delete_session', { commitSha, repo });
  }

  async updateSessionStatus(
    commitSha: string,
    data: UpdateSessionStatusRequest,
    repo?: string,
  ): Promise<UpdateSessionStatusResponse> {
    const invoke = await getInvoke();
    return invoke('update_session_status', {
      commitSha,
      status: data.status,
      repo,
    }) as Promise<UpdateSessionStatusResponse>;
  }

  // Comments

  async postComment(
    commitSha: string,
    data: CreateCommentRequest,
    repo?: string,
  ): Promise<CreateCommentResponse> {
    const invoke = await getInvoke();
    return invoke('post_comment', { commitSha, ...data, repo }) as Promise<CreateCommentResponse>;
  }

  async patchComment(
    commitSha: string,
    commentId: string,
    data: UpdateCommentRequest,
    repo?: string,
  ): Promise<UpdateCommentResponse> {
    const invoke = await getInvoke();
    return invoke('patch_comment', {
      commitSha,
      commentId,
      resolved: data.resolved,
      repo,
    }) as Promise<UpdateCommentResponse>;
  }

  // Viewed files

  async markFileViewed(commitSha: string, path: string, repo?: string): Promise<ViewedFile> {
    const invoke = await getInvoke();
    return invoke('mark_file_viewed', { commitSha, path, repo }) as Promise<ViewedFile>;
  }

  async unmarkFileViewed(commitSha: string, path: string, repo?: string): Promise<void> {
    const invoke = await getInvoke();
    await invoke('unmark_file_viewed', { commitSha, path, repo });
  }

  // Auto-mark rules

  async updateAutoMarkRules(
    commitSha: string,
    rules: AutoMarkRule[],
    repo?: string,
  ): Promise<AutoMarkRulesResponse> {
    const invoke = await getInvoke();
    return invoke('update_auto_mark_rules', {
      commitSha,
      rules,
      repo,
    }) as Promise<AutoMarkRulesResponse>;
  }

  async applyAutoMarkRules(commitSha: string, repo?: string): Promise<AutoMarkApplyResponse> {
    const invoke = await getInvoke();
    return invoke('apply_auto_mark_rules', { commitSha, repo }) as Promise<AutoMarkApplyResponse>;
  }

  // Refs

  async fetchRefs(repo?: string): Promise<RefsResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_refs', { repo }) as Promise<RefsResponse>;
  }

  async resolveRefs(refs: string[], repo?: string): Promise<ResolveRefsResponse> {
    const invoke = await getInvoke();
    return invoke('resolve_refs', { refs, repo }) as Promise<ResolveRefsResponse>;
  }

  // Repos

  async fetchRepos(): Promise<ReposResponse> {
    const invoke = await getInvoke();
    return invoke('list_repos') as Promise<ReposResponse>;
  }

  // Commits

  async fetchCommits(commitSha: string, repo?: string): Promise<CommitsResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_commits', { commitSha, repo }) as Promise<CommitsResponse>;
  }

  async fetchCommitDiff(commitHash: string, repo?: string): Promise<CommitDiffResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_commit_diff', { commitHash, repo }) as Promise<CommitDiffResponse>;
  }

  async fetchCommitFiles(commitHash: string, repo?: string): Promise<CommitFilesResponse> {
    const invoke = await getInvoke();
    return invoke('fetch_commit_files', { commitHash, repo }) as Promise<CommitFilesResponse>;
  }

  async getInitialSession(): Promise<string | null> {
    const invoke = await getInvoke();
    return invoke('get_initial_session') as Promise<string | null>;
  }
}
