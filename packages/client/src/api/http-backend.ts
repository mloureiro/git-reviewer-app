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
  ValidateSessionsResponse,
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
    return apiGet<FilesResponse>(`/api/v1/files${qs}`);
  }

  fetchDiff(params: DiffQueryParams): Promise<DiffResponse> {
    const qs = buildQueryString({
      base: params.base,
      head: params.head,
      uncommitted: params.uncommitted,
      repo: params.repo,
    });
    return apiGet<DiffResponse>(`/api/v1/diff${qs}`);
  }

  // Sessions

  fetchSessions(): Promise<SessionListResponse> {
    return apiGet<SessionListResponse>('/api/v1/sessions');
  }

  validateSessions(): Promise<ValidateSessionsResponse> {
    return apiGet<ValidateSessionsResponse>('/api/v1/sessions/validate');
  }

  async fetchSession(commitSha: string, repo?: string): Promise<SessionResponse> {
    const qs = buildQueryString({ repo });
    const response = await apiGet<SessionResponse>(`/api/v1/sessions/${commitSha}${qs}`);
    return response;
  }

  async createSession(data: CreateSessionRequest, repo?: string): Promise<SessionResponse> {
    const qs = buildQueryString({ repo });
    const response = await apiPost<SessionResponse>(`/api/v1/sessions${qs}`, data);
    return response;
  }

  deleteSession(commitSha: string, repo?: string): Promise<void> {
    const qs = buildQueryString({ repo });
    return apiDelete(`/api/v1/sessions/${commitSha}${qs}`);
  }

  async updateSessionStatus(
    commitSha: string,
    data: UpdateSessionStatusRequest,
    repo?: string,
  ): Promise<UpdateSessionStatusResponse> {
    const qs = buildQueryString({ repo });
    const response = await apiPatch<UpdateSessionStatusResponse>(
      `/api/v1/sessions/${commitSha}${qs}`,
      data,
    );
    return response;
  }

  // Comments

  postComment(
    commitSha: string,
    data: CreateCommentRequest,
    repo?: string,
  ): Promise<CreateCommentResponse> {
    const qs = buildQueryString({ repo });
    return apiPost<CreateCommentResponse>(`/api/v1/sessions/${commitSha}/comments${qs}`, data);
  }

  patchComment(
    commitSha: string,
    commentId: string,
    data: UpdateCommentRequest,
    repo?: string,
  ): Promise<UpdateCommentResponse> {
    const qs = buildQueryString({ repo });
    return apiPatch<UpdateCommentResponse>(
      `/api/v1/sessions/${commitSha}/comments/${commentId}${qs}`,
      data,
    );
  }

  deleteComment(commitSha: string, commentId: string, repo?: string): Promise<void> {
    const qs = buildQueryString({ repo });
    return apiDelete(`/api/v1/sessions/${commitSha}/comments/${commentId}${qs}`);
  }

  // Viewed files

  markFileViewed(commitSha: string, path: string, repo?: string): Promise<ViewedFile> {
    const qs = buildQueryString({ repo });
    return apiPut<ViewedFile>(
      `/api/v1/sessions/${commitSha}/viewed-files/${encodeURIComponent(path)}${qs}`,
      {},
    );
  }

  unmarkFileViewed(commitSha: string, path: string, repo?: string): Promise<void> {
    const qs = buildQueryString({ repo });
    return apiDelete(`/api/v1/sessions/${commitSha}/viewed-files/${encodeURIComponent(path)}${qs}`);
  }

  // Auto-mark rules

  updateAutoMarkRules(
    commitSha: string,
    rules: AutoMarkRule[],
    repo?: string,
  ): Promise<AutoMarkRulesResponse> {
    const qs = buildQueryString({ repo });
    return apiPut<AutoMarkRulesResponse>(`/api/v1/sessions/${commitSha}/auto-mark-rules${qs}`, {
      rules,
    });
  }

  applyAutoMarkRules(commitSha: string, repo?: string): Promise<AutoMarkApplyResponse> {
    const qs = buildQueryString({ repo });
    return apiPost<AutoMarkApplyResponse>(`/api/v1/sessions/${commitSha}/auto-mark-apply${qs}`, {});
  }

  // Refs

  fetchRefs(repo?: string): Promise<RefsResponse> {
    const qs = buildQueryString({ repo });
    return apiGet<RefsResponse>(`/api/v1/refs${qs}`);
  }

  resolveRefs(refs: string[], repo?: string): Promise<ResolveRefsResponse> {
    const qs = buildQueryString({ refs: refs.join(','), repo });
    return apiGet<ResolveRefsResponse>(`/api/v1/resolve-refs${qs}`);
  }

  // Repos

  fetchRepos(): Promise<ReposResponse> {
    return apiGet<ReposResponse>('/api/v1/repos');
  }

  removeRepo(path: string): Promise<void> {
    const qs = buildQueryString({ path });
    return apiDelete(`/api/v1/repos${qs}`);
  }

  // Commits

  fetchCommits(commitSha: string, repo?: string): Promise<CommitsResponse> {
    const qs = buildQueryString({ repo });
    return apiGet<CommitsResponse>(`/api/v1/sessions/${commitSha}/commits${qs}`);
  }

  fetchCommitDiff(commitHash: string, repo?: string): Promise<CommitDiffResponse> {
    const qs = buildQueryString({ repo });
    return apiGet<CommitDiffResponse>(`/api/v1/commits/${commitHash}/diff${qs}`);
  }

  fetchCommitFiles(commitHash: string, repo?: string): Promise<CommitFilesResponse> {
    const qs = buildQueryString({ repo });
    return apiGet<CommitFilesResponse>(`/api/v1/commits/${commitHash}/files${qs}`);
  }
}
