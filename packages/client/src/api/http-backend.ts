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
    });
    return apiGet<FilesResponse>(`/api/files${qs}`);
  }

  fetchDiff(params: DiffQueryParams): Promise<DiffResponse> {
    const qs = buildQueryString({
      base: params.base,
      head: params.head,
      uncommitted: params.uncommitted,
    });
    return apiGet<DiffResponse>(`/api/diff${qs}`);
  }

  // Sessions

  fetchSessions(): Promise<SessionListResponse> {
    return apiGet<SessionListResponse>('/api/sessions');
  }

  fetchSession(commitSha: string): Promise<SessionResponse> {
    return apiGet<SessionResponse>(`/api/sessions/${commitSha}`);
  }

  createSession(data: CreateSessionRequest): Promise<SessionResponse> {
    return apiPost<SessionResponse>('/api/sessions', data);
  }

  deleteSession(commitSha: string): Promise<void> {
    return apiDelete(`/api/sessions/${commitSha}`);
  }

  updateSessionStatus(
    commitSha: string,
    data: UpdateSessionStatusRequest,
  ): Promise<UpdateSessionStatusResponse> {
    return apiPatch<UpdateSessionStatusResponse>(`/api/sessions/${commitSha}`, data);
  }

  // Comments

  postComment(commitSha: string, data: CreateCommentRequest): Promise<CreateCommentResponse> {
    return apiPost<CreateCommentResponse>(`/api/sessions/${commitSha}/comments`, data);
  }

  patchComment(
    commitSha: string,
    commentId: string,
    data: UpdateCommentRequest,
  ): Promise<UpdateCommentResponse> {
    return apiPatch<UpdateCommentResponse>(
      `/api/sessions/${commitSha}/comments/${commentId}`,
      data,
    );
  }

  // Viewed files

  markFileViewed(commitSha: string, path: string): Promise<ViewedFile> {
    return apiPost<ViewedFile>(`/api/sessions/${commitSha}/viewed-files`, { path });
  }

  unmarkFileViewed(commitSha: string, path: string): Promise<void> {
    return apiDelete(`/api/sessions/${commitSha}/viewed-files/${encodeURIComponent(path)}`);
  }

  // Auto-mark rules

  updateAutoMarkRules(commitSha: string, rules: AutoMarkRule[]): Promise<AutoMarkRulesResponse> {
    return apiPut<AutoMarkRulesResponse>(`/api/sessions/${commitSha}/auto-mark-rules`, { rules });
  }

  applyAutoMarkRules(commitSha: string): Promise<AutoMarkApplyResponse> {
    return apiPost<AutoMarkApplyResponse>(`/api/sessions/${commitSha}/auto-mark-apply`, {});
  }

  // Refs

  fetchRefs(): Promise<RefsResponse> {
    return apiGet<RefsResponse>('/api/refs');
  }

  resolveRefs(refs: string[]): Promise<ResolveRefsResponse> {
    const qs = buildQueryString({ refs: refs.join(',') });
    return apiGet<ResolveRefsResponse>(`/api/resolve-refs${qs}`);
  }

  // Commits

  fetchCommits(commitSha: string): Promise<CommitsResponse> {
    return apiGet<CommitsResponse>(`/api/sessions/${commitSha}/commits`);
  }

  fetchCommitDiff(commitHash: string): Promise<CommitDiffResponse> {
    return apiGet<CommitDiffResponse>(`/api/commits/${commitHash}/diff`);
  }

  fetchCommitFiles(commitHash: string): Promise<CommitFilesResponse> {
    return apiGet<CommitFilesResponse>(`/api/commits/${commitHash}/files`);
  }
}
