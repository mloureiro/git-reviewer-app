import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpBackend } from './http-backend';
import type { AutoMarkRule } from '../types/review';
import * as client from './client';

vi.mock('./client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
}));

const mockApiGet = vi.mocked(client.apiGet);
const mockApiPost = vi.mocked(client.apiPost);
const mockApiPut = vi.mocked(client.apiPut);
const mockApiPatch = vi.mocked(client.apiPatch);
const mockApiDelete = vi.mocked(client.apiDelete);

const SHA = 'deadbeef1234';
const COMMENT_ID = 'comment-abc';
const REPO = '/path/to/repo';

describe('HttpBackend', () => {
  let backend: HttpBackend;

  beforeEach(() => {
    vi.resetAllMocks();
    backend = new HttpBackend();
  });

  // ---------------------------------------------------------------------------
  // Files & Diff
  // ---------------------------------------------------------------------------

  describe('fetchFiles', () => {
    it('calls apiGet with base and head params', async () => {
      mockApiGet.mockResolvedValue({ files: [] });

      await backend.fetchFiles({ base: 'main', head: 'HEAD' });

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/files?base=main&head=HEAD');
    });

    it('calls apiGet with uncommitted param', async () => {
      mockApiGet.mockResolvedValue({ files: [] });

      await backend.fetchFiles({ uncommitted: 'true' });

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/files?uncommitted=true');
    });

    it('calls apiGet with repo param when provided', async () => {
      mockApiGet.mockResolvedValue({ files: [] });

      await backend.fetchFiles({ base: 'main', repo: REPO });

      expect(mockApiGet).toHaveBeenCalledWith(
        `/api/v1/files?base=main&repo=${encodeURIComponent(REPO)}`,
      );
    });

    it('calls apiGet with no query string when params are empty', async () => {
      mockApiGet.mockResolvedValue({ files: [] });

      await backend.fetchFiles({});

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/files');
    });

    it('omits undefined params from query string', async () => {
      mockApiGet.mockResolvedValue({ files: [] });

      await backend.fetchFiles({ base: 'main', head: undefined });

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/files?base=main');
    });

    it('returns the resolved value from apiGet', async () => {
      const response = {
        files: [{ path: 'src/foo.ts', status: 'modified' as const, additions: 1, deletions: 0 }],
      };
      mockApiGet.mockResolvedValue(response);

      const result = await backend.fetchFiles({ base: 'main' });

      expect(result).toEqual(response);
    });

    it('propagates errors thrown by apiGet', async () => {
      mockApiGet.mockRejectedValue(new Error('Network error'));

      await expect(backend.fetchFiles({})).rejects.toThrow('Network error');
    });
  });

  describe('fetchDiff', () => {
    it('calls apiGet with base and head params', async () => {
      mockApiGet.mockResolvedValue({ diff: '' });

      await backend.fetchDiff({ base: 'main', head: 'HEAD' });

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/diff?base=main&head=HEAD');
    });

    it('calls apiGet with uncommitted param', async () => {
      mockApiGet.mockResolvedValue({ diff: '' });

      await backend.fetchDiff({ uncommitted: 'true' });

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/diff?uncommitted=true');
    });

    it('calls apiGet with no query string when params are empty', async () => {
      mockApiGet.mockResolvedValue({ diff: '' });

      await backend.fetchDiff({});

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/diff');
    });

    it('returns the resolved value from apiGet', async () => {
      const response = { diff: 'diff --git a/foo.ts b/foo.ts' };
      mockApiGet.mockResolvedValue(response);

      const result = await backend.fetchDiff({ base: 'main' });

      expect(result).toEqual(response);
    });
  });

  // ---------------------------------------------------------------------------
  // Sessions
  // ---------------------------------------------------------------------------

  describe('fetchSessions', () => {
    it('calls apiGet for /api/v1/sessions', async () => {
      mockApiGet.mockResolvedValue({ sessions: [], total: 0, page: 1, limit: 20 });

      await backend.fetchSessions();

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/sessions');
    });

    it('returns the resolved value from apiGet', async () => {
      const response = { sessions: [], total: 0, page: 1, limit: 20 };
      mockApiGet.mockResolvedValue(response);

      const result = await backend.fetchSessions();

      expect(result).toEqual(response);
    });
  });

  describe('validateSessions', () => {
    it('calls apiGet for /api/v1/sessions/validate', async () => {
      mockApiGet.mockResolvedValue({ health: {}, stats: {} });

      await backend.validateSessions();

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/sessions/validate');
    });
  });

  describe('fetchSession', () => {
    it('calls apiGet for /api/v1/sessions/:sha without repo', async () => {
      mockApiGet.mockResolvedValue({
        session: {
          version: 1,
          session: {
            id: 'session-1',
            title: 'Test',
            baseRef: 'main',
            headRef: 'feature',
            baseCommit: 'abc',
            headCommit: 'def',
            status: 'pending',
            createdAt: '2026-03-19T00:00:00Z',
            updatedAt: '2026-03-19T00:00:00Z',
          },
          comments: [],
        },
      });

      await backend.fetchSession(SHA);

      expect(mockApiGet).toHaveBeenCalledWith(`/api/v1/sessions/${SHA}`);
    });

    it('appends repo query param when provided', async () => {
      mockApiGet.mockResolvedValue({
        session: {
          version: 1,
          session: {
            id: 'session-1',
            title: 'Test',
            baseRef: 'main',
            headRef: 'feature',
            baseCommit: 'abc',
            headCommit: 'def',
            status: 'pending',
            createdAt: '2026-03-19T00:00:00Z',
            updatedAt: '2026-03-19T00:00:00Z',
          },
          comments: [],
        },
      });

      await backend.fetchSession(SHA, REPO);

      expect(mockApiGet).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}?repo=${encodeURIComponent(REPO)}`,
      );
    });
  });

  describe('createSession', () => {
    it('calls apiPost for /api/v1/sessions with the request body', async () => {
      mockApiPost.mockResolvedValue({
        session: {
          version: 1,
          session: {
            id: 'session-1',
            title: 'Test Review',
            baseRef: 'main',
            headRef: 'HEAD',
            baseCommit: 'abc',
            headCommit: 'def',
            status: 'pending',
            createdAt: '2026-03-19T00:00:00Z',
            updatedAt: '2026-03-19T00:00:00Z',
          },
          comments: [],
        },
      });
      const data = { title: 'Test Review', baseRef: 'main', headRef: 'HEAD' };

      await backend.createSession(data);

      expect(mockApiPost).toHaveBeenCalledWith('/api/v1/sessions', data);
    });

    it('appends repo query param when provided', async () => {
      mockApiPost.mockResolvedValue({
        session: {
          version: 1,
          session: {
            id: 'session-1',
            title: 'Test',
            baseRef: 'main',
            headRef: 'HEAD',
            baseCommit: 'abc',
            headCommit: 'def',
            status: 'pending',
            createdAt: '2026-03-19T00:00:00Z',
            updatedAt: '2026-03-19T00:00:00Z',
          },
          comments: [],
        },
      });
      const data = { title: 'Test', baseRef: 'main', headRef: 'HEAD' };

      await backend.createSession(data, REPO);

      expect(mockApiPost).toHaveBeenCalledWith(
        `/api/v1/sessions?repo=${encodeURIComponent(REPO)}`,
        data,
      );
    });
  });

  describe('deleteSession', () => {
    it('calls apiDelete for /api/v1/sessions/:sha', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      await backend.deleteSession(SHA);

      expect(mockApiDelete).toHaveBeenCalledWith(`/api/v1/sessions/${SHA}`);
    });

    it('appends repo query param when provided', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      await backend.deleteSession(SHA, REPO);

      expect(mockApiDelete).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}?repo=${encodeURIComponent(REPO)}`,
      );
    });
  });

  describe('updateSessionStatus', () => {
    it('calls apiPatch for /api/v1/sessions/:sha with status data', async () => {
      mockApiPatch.mockResolvedValue({
        session: {
          id: 'session-1',
          title: 'Test',
          baseRef: 'main',
          headRef: 'feature',
          baseCommit: 'abc',
          headCommit: 'def',
          status: 'approved',
          createdAt: '2026-03-19T00:00:00Z',
          updatedAt: '2026-03-19T00:00:00Z',
        },
      });
      const data = { status: 'approved' as const };

      await backend.updateSessionStatus(SHA, data);

      expect(mockApiPatch).toHaveBeenCalledWith(`/api/v1/sessions/${SHA}`, data);
    });

    it('appends repo query param when provided', async () => {
      mockApiPatch.mockResolvedValue({
        session: {
          id: 'session-1',
          title: 'Test',
          baseRef: 'main',
          headRef: 'feature',
          baseCommit: 'abc',
          headCommit: 'def',
          status: 'approved',
          createdAt: '2026-03-19T00:00:00Z',
          updatedAt: '2026-03-19T00:00:00Z',
        },
      });

      await backend.updateSessionStatus(SHA, { status: 'approved' }, REPO);

      expect(mockApiPatch).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}?repo=${encodeURIComponent(REPO)}`,
        { status: 'approved' },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  describe('postComment', () => {
    it('calls apiPost for /api/v1/sessions/:sha/comments', async () => {
      mockApiPost.mockResolvedValue({ id: COMMENT_ID });
      const data = {
        file: 'src/foo.ts',
        line: 5,
        side: 'right' as const,
        body: 'Fix this',
        author: 'reviewer',
      };

      await backend.postComment(SHA, data);

      expect(mockApiPost).toHaveBeenCalledWith(`/api/v1/sessions/${SHA}/comments`, data);
    });

    it('appends repo query param when provided', async () => {
      mockApiPost.mockResolvedValue({ id: COMMENT_ID });
      const data = {
        file: 'src/foo.ts',
        line: 1,
        side: 'right' as const,
        body: 'ok',
        author: 'reviewer',
      };

      await backend.postComment(SHA, data, REPO);

      expect(mockApiPost).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}/comments?repo=${encodeURIComponent(REPO)}`,
        data,
      );
    });
  });

  describe('patchComment', () => {
    it('calls apiPatch for /api/v1/sessions/:sha/comments/:id', async () => {
      mockApiPatch.mockResolvedValue({ id: COMMENT_ID, resolved: true });
      const data = { resolved: true };

      await backend.patchComment(SHA, COMMENT_ID, data);

      expect(mockApiPatch).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}/comments/${COMMENT_ID}`,
        data,
      );
    });

    it('appends repo query param when provided', async () => {
      mockApiPatch.mockResolvedValue({ id: COMMENT_ID, resolved: false });

      await backend.patchComment(SHA, COMMENT_ID, { resolved: false }, REPO);

      expect(mockApiPatch).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}/comments/${COMMENT_ID}?repo=${encodeURIComponent(REPO)}`,
        { resolved: false },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Viewed files
  // ---------------------------------------------------------------------------

  describe('markFileViewed', () => {
    it('calls apiPut for /api/v1/sessions/:sha/viewed-files/:filePath', async () => {
      mockApiPut.mockResolvedValue({ path: 'src/foo.ts' });

      await backend.markFileViewed(SHA, 'src/foo.ts');

      expect(mockApiPut).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}/viewed-files/${encodeURIComponent('src/foo.ts')}`,
        {},
      );
    });

    it('appends repo query param when provided', async () => {
      mockApiPut.mockResolvedValue({ path: 'src/foo.ts' });

      await backend.markFileViewed(SHA, 'src/foo.ts', REPO);

      expect(mockApiPut).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}/viewed-files/${encodeURIComponent('src/foo.ts')}?repo=${encodeURIComponent(REPO)}`,
        {},
      );
    });
  });

  describe('unmarkFileViewed', () => {
    it('calls apiDelete for /api/v1/sessions/:sha/viewed-files/:encodedPath', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      await backend.unmarkFileViewed(SHA, 'src/foo.ts');

      expect(mockApiDelete).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}/viewed-files/${encodeURIComponent('src/foo.ts')}`,
      );
    });

    it('URL-encodes the file path', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      await backend.unmarkFileViewed(SHA, 'src/path with spaces/foo.ts');

      expect(mockApiDelete).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}/viewed-files/${encodeURIComponent('src/path with spaces/foo.ts')}`,
      );
    });

    it('appends repo query param when provided', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      await backend.unmarkFileViewed(SHA, 'src/foo.ts', REPO);

      expect(mockApiDelete).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}/viewed-files/${encodeURIComponent('src/foo.ts')}?repo=${encodeURIComponent(REPO)}`,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-mark rules
  // ---------------------------------------------------------------------------

  describe('updateAutoMarkRules', () => {
    it('calls apiPut for /api/v1/sessions/:sha/auto-mark-rules with rules array', async () => {
      mockApiPut.mockResolvedValue({ rules: [], autoMarked: [] });
      const rules: AutoMarkRule[] = ['lockfile', 'generated'];

      await backend.updateAutoMarkRules(SHA, rules);

      expect(mockApiPut).toHaveBeenCalledWith(`/api/v1/sessions/${SHA}/auto-mark-rules`, { rules });
    });

    it('appends repo query param when provided', async () => {
      mockApiPut.mockResolvedValue({ rules: [], autoMarked: [] });

      await backend.updateAutoMarkRules(SHA, [], REPO);

      expect(mockApiPut).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}/auto-mark-rules?repo=${encodeURIComponent(REPO)}`,
        { rules: [] },
      );
    });
  });

  describe('applyAutoMarkRules', () => {
    it('calls apiPost for /api/v1/sessions/:sha/auto-mark-apply with empty body', async () => {
      mockApiPost.mockResolvedValue({ autoMarked: [] });

      await backend.applyAutoMarkRules(SHA);

      expect(mockApiPost).toHaveBeenCalledWith(`/api/v1/sessions/${SHA}/auto-mark-apply`, {});
    });

    it('appends repo query param when provided', async () => {
      mockApiPost.mockResolvedValue({ autoMarked: [] });

      await backend.applyAutoMarkRules(SHA, REPO);

      expect(mockApiPost).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}/auto-mark-apply?repo=${encodeURIComponent(REPO)}`,
        {},
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------

  describe('fetchRefs', () => {
    it('calls apiGet for /api/v1/refs without repo', async () => {
      mockApiGet.mockResolvedValue({ branches: [], tags: [], currentBranch: 'main' });

      await backend.fetchRefs();

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/refs');
    });

    it('appends repo query param when provided', async () => {
      mockApiGet.mockResolvedValue({ branches: [], tags: [], currentBranch: 'main' });

      await backend.fetchRefs(REPO);

      expect(mockApiGet).toHaveBeenCalledWith(`/api/v1/refs?repo=${encodeURIComponent(REPO)}`);
    });
  });

  describe('resolveRefs', () => {
    it('calls apiGet for /api/v1/resolve-refs with refs joined by comma', async () => {
      mockApiGet.mockResolvedValue({ refs: {} });

      await backend.resolveRefs(['main', 'HEAD']);

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/resolve-refs?refs=main%2CHEAD');
    });

    it('handles a single ref', async () => {
      mockApiGet.mockResolvedValue({ refs: {} });

      await backend.resolveRefs(['main']);

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/resolve-refs?refs=main');
    });

    it('appends repo query param when provided', async () => {
      mockApiGet.mockResolvedValue({ refs: {} });

      await backend.resolveRefs(['main'], REPO);

      expect(mockApiGet).toHaveBeenCalledWith(
        `/api/v1/resolve-refs?refs=main&repo=${encodeURIComponent(REPO)}`,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Repos
  // ---------------------------------------------------------------------------

  describe('fetchRepos', () => {
    it('calls apiGet for /api/v1/repos', async () => {
      mockApiGet.mockResolvedValue({ repos: [] });

      await backend.fetchRepos();

      expect(mockApiGet).toHaveBeenCalledWith('/api/v1/repos');
    });
  });

  describe('removeRepo', () => {
    it('calls apiDelete for /api/v1/repos with path query param', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      await backend.removeRepo(REPO);

      expect(mockApiDelete).toHaveBeenCalledWith(`/api/v1/repos?path=${encodeURIComponent(REPO)}`);
    });
  });

  // ---------------------------------------------------------------------------
  // Commits
  // ---------------------------------------------------------------------------

  describe('fetchCommits', () => {
    it('calls apiGet for /api/v1/sessions/:sha/commits', async () => {
      mockApiGet.mockResolvedValue({ commits: [] });

      await backend.fetchCommits(SHA);

      expect(mockApiGet).toHaveBeenCalledWith(`/api/v1/sessions/${SHA}/commits`);
    });

    it('appends repo query param when provided', async () => {
      mockApiGet.mockResolvedValue({ commits: [] });

      await backend.fetchCommits(SHA, REPO);

      expect(mockApiGet).toHaveBeenCalledWith(
        `/api/v1/sessions/${SHA}/commits?repo=${encodeURIComponent(REPO)}`,
      );
    });
  });

  describe('fetchCommitDiff', () => {
    it('calls apiGet for /api/v1/commits/:hash/diff', async () => {
      mockApiGet.mockResolvedValue({ diff: '' });

      await backend.fetchCommitDiff(SHA);

      expect(mockApiGet).toHaveBeenCalledWith(`/api/v1/commits/${SHA}/diff`);
    });

    it('appends repo query param when provided', async () => {
      mockApiGet.mockResolvedValue({ diff: '' });

      await backend.fetchCommitDiff(SHA, REPO);

      expect(mockApiGet).toHaveBeenCalledWith(
        `/api/v1/commits/${SHA}/diff?repo=${encodeURIComponent(REPO)}`,
      );
    });
  });

  describe('fetchCommitFiles', () => {
    it('calls apiGet for /api/v1/commits/:hash/files', async () => {
      mockApiGet.mockResolvedValue({ files: [] });

      await backend.fetchCommitFiles(SHA);

      expect(mockApiGet).toHaveBeenCalledWith(`/api/v1/commits/${SHA}/files`);
    });

    it('appends repo query param when provided', async () => {
      mockApiGet.mockResolvedValue({ files: [] });

      await backend.fetchCommitFiles(SHA, REPO);

      expect(mockApiGet).toHaveBeenCalledWith(
        `/api/v1/commits/${SHA}/files?repo=${encodeURIComponent(REPO)}`,
      );
    });
  });
});
