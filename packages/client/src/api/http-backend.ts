import { apiGet, apiPost, apiPut, apiPatch, apiDelete } from './client';
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

function buildQueryString(params: Record<string, string | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      query.set(key, value);
    }
  }
  const qs = query.toString();
  return qs ? `?${qs}` : '';
}

/**
 * HTTP backend — delegates every call to the REST API via the existing
 * `apiGet` / `apiPost` / … helpers from `client.ts`.
 */
export class HttpBackend implements Backend {
  // Files & Diff

  fetchFiles(params: FilesQueryParams): Promise<FilesResponse> {
    const qs = buildQueryString({
      base: params.base,
      head: params.head,
      uncommitted: params.uncommitted,
      repo: params.repo,
    });
    return apiGet<FilesResponse>(`/api/files${qs}`);
  }

  fetchDiff(params: DiffQueryParams): Promise<DiffResponse> {
    const qs = buildQueryString({
      base: params.base,
      head: params.head,
      uncommitted: params.uncommitted,
      repo: params.repo,
    });
    return apiGet<DiffResponse>(`/api/diff${qs}`);
  }

  // Sessions

  fetchSessions(): Promise<SessionListResponse> {
    return apiGet<SessionListResponse>('/api/sessions');
  }

  fetchSession(commitSha: string, repo?: string): Promise<SessionResponse> {
    const qs = buildQueryString({ repo });
    return apiGet<SessionResponse>(`/api/sessions/${commitSha}${qs}`);
  }

  createSession(data: CreateSessionRequest, repo?: string): Promise<SessionResponse> {
    const qs = buildQueryString({ repo });
    return apiPost<SessionResponse>(`/api/sessions${qs}`, data);
  }

  deleteSession(commitSha: string, repo?: string): Promise<void> {
    const qs = buildQueryString({ repo });
    return apiDelete(`/api/sessions/${commitSha}${qs}`);
  }

  updateSessionStatus(
    commitSha: string,
    data: UpdateSessionStatusRequest,
    repo?: string,
  ): Promise<UpdateSessionStatusResponse> {
    const qs = buildQueryString({ repo });
    return apiPatch<UpdateSessionStatusResponse>(`/api/sessions/${commitSha}${qs}`, data);
  }

  // Comments

  postComment(
    commitSha: string,
    data: CreateCommentRequest,
    repo?: string,
  ): Promise<CreateCommentResponse> {
    const qs = buildQueryString({ repo });
    return apiPost<CreateCommentResponse>(`/api/sessions/${commitSha}/comments${qs}`, data);
  }

  patchComment(
    commitSha: string,
    commentId: string,
    data: UpdateCommentRequest,
    repo?: string,
  ): Promise<UpdateCommentResponse> {
    const qs = buildQueryString({ repo });
    return apiPatch<UpdateCommentResponse>(
      `/api/sessions/${commitSha}/comments/${commentId}${qs}`,
      data,
    );
  }

  // Viewed files

  markFileViewed(commitSha: string, path: string, repo?: string): Promise<ViewedFile> {
    const qs = buildQueryString({ repo });
    return apiPost<ViewedFile>(`/api/sessions/${commitSha}/viewed-files${qs}`, { path });
  }

  unmarkFileViewed(commitSha: string, path: string, repo?: string): Promise<void> {
    const qs = buildQueryString({ repo });
    return apiDelete(`/api/sessions/${commitSha}/viewed-files/${encodeURIComponent(path)}${qs}`);
  }

  // Auto-mark rules

  updateAutoMarkRules(
    commitSha: string,
    rules: AutoMarkRule[],
    repo?: string,
  ): Promise<AutoMarkRulesResponse> {
    const qs = buildQueryString({ repo });
    return apiPut<AutoMarkRulesResponse>(`/api/sessions/${commitSha}/auto-mark-rules${qs}`, {
      rules,
    });
  }

  applyAutoMarkRules(commitSha: string, repo?: string): Promise<AutoMarkApplyResponse> {
    const qs = buildQueryString({ repo });
    return apiPost<AutoMarkApplyResponse>(`/api/sessions/${commitSha}/auto-mark-apply${qs}`, {});
  }

  // Refs

  fetchRefs(repo?: string): Promise<RefsResponse> {
    const qs = buildQueryString({ repo });
    return apiGet<RefsResponse>(`/api/refs${qs}`);
  }

  resolveRefs(refs: string[], repo?: string): Promise<ResolveRefsResponse> {
    const qs = buildQueryString({ refs: refs.join(','), repo });
    return apiGet<ResolveRefsResponse>(`/api/resolve-refs${qs}`);
  }

  // Repos

  fetchRepos(): Promise<ReposResponse> {
    return apiGet<ReposResponse>('/api/repos');
  }

  removeRepo(path: string): Promise<void> {
    const qs = buildQueryString({ path });
    return apiDelete(`/api/repos${qs}`);
  }

  // Commits

  fetchCommits(commitSha: string, repo?: string): Promise<CommitsResponse> {
    const qs = buildQueryString({ repo });
    return apiGet<CommitsResponse>(`/api/sessions/${commitSha}/commits${qs}`);
  }

  fetchCommitDiff(commitHash: string, repo?: string): Promise<CommitDiffResponse> {
    const qs = buildQueryString({ repo });
    return apiGet<CommitDiffResponse>(`/api/commits/${commitHash}/diff${qs}`);
  }

  fetchCommitFiles(commitHash: string, repo?: string): Promise<CommitFilesResponse> {
    const qs = buildQueryString({ repo });
    return apiGet<CommitFilesResponse>(`/api/commits/${commitHash}/files${qs}`);
  }
}
