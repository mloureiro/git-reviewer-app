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

      expect(mockApiGet).toHaveBeenCalledWith('/api/files?base=main&head=HEAD');
    });

    it('calls apiGet with uncommitted param', async () => {
      mockApiGet.mockResolvedValue({ files: [] });

      await backend.fetchFiles({ uncommitted: 'true' });

      expect(mockApiGet).toHaveBeenCalledWith('/api/files?uncommitted=true');
    });

    it('calls apiGet with repo param when provided', async () => {
      mockApiGet.mockResolvedValue({ files: [] });

      await backend.fetchFiles({ base: 'main', repo: REPO });

      expect(mockApiGet).toHaveBeenCalledWith(
        `/api/files?base=main&repo=${encodeURIComponent(REPO)}`,
      );
    });

    it('calls apiGet with no query string when params are empty', async () => {
      mockApiGet.mockResolvedValue({ files: [] });

      await backend.fetchFiles({});

      expect(mockApiGet).toHaveBeenCalledWith('/api/files');
    });

    it('omits undefined params from query string', async () => {
      mockApiGet.mockResolvedValue({ files: [] });

      await backend.fetchFiles({ base: 'main', head: undefined });

      expect(mockApiGet).toHaveBeenCalledWith('/api/files?base=main');
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

      expect(mockApiGet).toHaveBeenCalledWith('/api/diff?base=main&head=HEAD');
    });

    it('calls apiGet with uncommitted param', async () => {
      mockApiGet.mockResolvedValue({ diff: '' });

      await backend.fetchDiff({ uncommitted: 'true' });

      expect(mockApiGet).toHaveBeenCalledWith('/api/diff?uncommitted=true');
    });

    it('calls apiGet with no query string when params are empty', async () => {
      mockApiGet.mockResolvedValue({ diff: '' });

      await backend.fetchDiff({});

      expect(mockApiGet).toHaveBeenCalledWith('/api/diff');
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
    it('calls apiGet for /api/sessions', async () => {
      mockApiGet.mockResolvedValue({ sessions: [] });

      await backend.fetchSessions();

      expect(mockApiGet).toHaveBeenCalledWith('/api/sessions');
    });

    it('returns the resolved value from apiGet', async () => {
      const response = { sessions: [] };
      mockApiGet.mockResolvedValue(response);

      const result = await backend.fetchSessions();

      expect(result).toEqual(response);
    });
  });

  describe('validateSessions', () => {
    it('calls apiGet for /api/sessions/validate', async () => {
      mockApiGet.mockResolvedValue({ health: {}, stats: {} });

      await backend.validateSessions();

      expect(mockApiGet).toHaveBeenCalledWith('/api/sessions/validate');
    });
  });

  describe('fetchSession', () => {
    it('calls apiGet for /api/sessions/:sha without repo', async () => {
      mockApiGet.mockResolvedValue({ version: 1, session: {}, comments: [] });

      await backend.fetchSession(SHA);

      expect(mockApiGet).toHaveBeenCalledWith(`/api/sessions/${SHA}`);
    });

    it('appends repo query param when provided', async () => {
      mockApiGet.mockResolvedValue({ version: 1, session: {}, comments: [] });

      await backend.fetchSession(SHA, REPO);

      expect(mockApiGet).toHaveBeenCalledWith(
        `/api/sessions/${SHA}?repo=${encodeURIComponent(REPO)}`,
      );
    });
  });

  describe('createSession', () => {
    it('calls apiPost for /api/sessions with the request body', async () => {
      mockApiPost.mockResolvedValue({ version: 1, session: {}, comments: [] });
      const data = { title: 'Test Review', baseRef: 'main', headRef: 'HEAD' };

      await backend.createSession(data);

      expect(mockApiPost).toHaveBeenCalledWith('/api/sessions', data);
    });

    it('appends repo query param when provided', async () => {
      mockApiPost.mockResolvedValue({ version: 1, session: {}, comments: [] });
      const data = { title: 'Test', baseRef: 'main', headRef: 'HEAD' };

      await backend.createSession(data, REPO);

      expect(mockApiPost).toHaveBeenCalledWith(
        `/api/sessions?repo=${encodeURIComponent(REPO)}`,
        data,
      );
    });
  });

  describe('deleteSession', () => {
    it('calls apiDelete for /api/sessions/:sha', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      await backend.deleteSession(SHA);

      expect(mockApiDelete).toHaveBeenCalledWith(`/api/sessions/${SHA}`);
    });

    it('appends repo query param when provided', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      await backend.deleteSession(SHA, REPO);

      expect(mockApiDelete).toHaveBeenCalledWith(
        `/api/sessions/${SHA}?repo=${encodeURIComponent(REPO)}`,
      );
    });
  });

  describe('updateSessionStatus', () => {
    it('calls apiPatch for /api/sessions/:sha with status data', async () => {
      mockApiPatch.mockResolvedValue({ id: 'session-1', status: 'approved' });
      const data = { status: 'approved' as const };

      await backend.updateSessionStatus(SHA, data);

      expect(mockApiPatch).toHaveBeenCalledWith(`/api/sessions/${SHA}`, data);
    });

    it('appends repo query param when provided', async () => {
      mockApiPatch.mockResolvedValue({ id: 'session-1', status: 'approved' });

      await backend.updateSessionStatus(SHA, { status: 'approved' }, REPO);

      expect(mockApiPatch).toHaveBeenCalledWith(
        `/api/sessions/${SHA}?repo=${encodeURIComponent(REPO)}`,
        { status: 'approved' },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Comments
  // ---------------------------------------------------------------------------

  describe('postComment', () => {
    it('calls apiPost for /api/sessions/:sha/comments', async () => {
      mockApiPost.mockResolvedValue({ id: COMMENT_ID });
      const data = {
        file: 'src/foo.ts',
        line: 5,
        side: 'right' as const,
        body: 'Fix this',
        author: 'reviewer',
      };

      await backend.postComment(SHA, data);

      expect(mockApiPost).toHaveBeenCalledWith(`/api/sessions/${SHA}/comments`, data);
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
        `/api/sessions/${SHA}/comments?repo=${encodeURIComponent(REPO)}`,
        data,
      );
    });
  });

  describe('patchComment', () => {
    it('calls apiPatch for /api/sessions/:sha/comments/:id', async () => {
      mockApiPatch.mockResolvedValue({ id: COMMENT_ID, resolved: true });
      const data = { resolved: true };

      await backend.patchComment(SHA, COMMENT_ID, data);

      expect(mockApiPatch).toHaveBeenCalledWith(
        `/api/sessions/${SHA}/comments/${COMMENT_ID}`,
        data,
      );
    });

    it('appends repo query param when provided', async () => {
      mockApiPatch.mockResolvedValue({ id: COMMENT_ID, resolved: false });

      await backend.patchComment(SHA, COMMENT_ID, { resolved: false }, REPO);

      expect(mockApiPatch).toHaveBeenCalledWith(
        `/api/sessions/${SHA}/comments/${COMMENT_ID}?repo=${encodeURIComponent(REPO)}`,
        { resolved: false },
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Viewed files
  // ---------------------------------------------------------------------------

  describe('markFileViewed', () => {
    it('calls apiPost for /api/sessions/:sha/viewed-files with path', async () => {
      mockApiPost.mockResolvedValue({ path: 'src/foo.ts' });

      await backend.markFileViewed(SHA, 'src/foo.ts');

      expect(mockApiPost).toHaveBeenCalledWith(`/api/sessions/${SHA}/viewed-files`, {
        path: 'src/foo.ts',
      });
    });

    it('appends repo query param when provided', async () => {
      mockApiPost.mockResolvedValue({ path: 'src/foo.ts' });

      await backend.markFileViewed(SHA, 'src/foo.ts', REPO);

      expect(mockApiPost).toHaveBeenCalledWith(
        `/api/sessions/${SHA}/viewed-files?repo=${encodeURIComponent(REPO)}`,
        { path: 'src/foo.ts' },
      );
    });
  });

  describe('unmarkFileViewed', () => {
    it('calls apiDelete for /api/sessions/:sha/viewed-files/:encodedPath', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      await backend.unmarkFileViewed(SHA, 'src/foo.ts');

      expect(mockApiDelete).toHaveBeenCalledWith(
        `/api/sessions/${SHA}/viewed-files/${encodeURIComponent('src/foo.ts')}`,
      );
    });

    it('URL-encodes the file path', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      await backend.unmarkFileViewed(SHA, 'src/path with spaces/foo.ts');

      expect(mockApiDelete).toHaveBeenCalledWith(
        `/api/sessions/${SHA}/viewed-files/${encodeURIComponent('src/path with spaces/foo.ts')}`,
      );
    });

    it('appends repo query param when provided', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      await backend.unmarkFileViewed(SHA, 'src/foo.ts', REPO);

      expect(mockApiDelete).toHaveBeenCalledWith(
        `/api/sessions/${SHA}/viewed-files/${encodeURIComponent('src/foo.ts')}?repo=${encodeURIComponent(REPO)}`,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Auto-mark rules
  // ---------------------------------------------------------------------------

  describe('updateAutoMarkRules', () => {
    it('calls apiPut for /api/sessions/:sha/auto-mark-rules with rules array', async () => {
      mockApiPut.mockResolvedValue({ rules: [], autoMarked: [] });
      const rules: AutoMarkRule[] = ['lockfile', 'generated'];

      await backend.updateAutoMarkRules(SHA, rules);

      expect(mockApiPut).toHaveBeenCalledWith(`/api/sessions/${SHA}/auto-mark-rules`, { rules });
    });

    it('appends repo query param when provided', async () => {
      mockApiPut.mockResolvedValue({ rules: [], autoMarked: [] });

      await backend.updateAutoMarkRules(SHA, [], REPO);

      expect(mockApiPut).toHaveBeenCalledWith(
        `/api/sessions/${SHA}/auto-mark-rules?repo=${encodeURIComponent(REPO)}`,
        { rules: [] },
      );
    });
  });

  describe('applyAutoMarkRules', () => {
    it('calls apiPost for /api/sessions/:sha/auto-mark-apply with empty body', async () => {
      mockApiPost.mockResolvedValue({ autoMarked: [] });

      await backend.applyAutoMarkRules(SHA);

      expect(mockApiPost).toHaveBeenCalledWith(`/api/sessions/${SHA}/auto-mark-apply`, {});
    });

    it('appends repo query param when provided', async () => {
      mockApiPost.mockResolvedValue({ autoMarked: [] });

      await backend.applyAutoMarkRules(SHA, REPO);

      expect(mockApiPost).toHaveBeenCalledWith(
        `/api/sessions/${SHA}/auto-mark-apply?repo=${encodeURIComponent(REPO)}`,
        {},
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Refs
  // ---------------------------------------------------------------------------

  describe('fetchRefs', () => {
    it('calls apiGet for /api/refs without repo', async () => {
      mockApiGet.mockResolvedValue({ branches: [], tags: [], currentBranch: 'main' });

      await backend.fetchRefs();

      expect(mockApiGet).toHaveBeenCalledWith('/api/refs');
    });

    it('appends repo query param when provided', async () => {
      mockApiGet.mockResolvedValue({ branches: [], tags: [], currentBranch: 'main' });

      await backend.fetchRefs(REPO);

      expect(mockApiGet).toHaveBeenCalledWith(`/api/refs?repo=${encodeURIComponent(REPO)}`);
    });
  });

  describe('resolveRefs', () => {
    it('calls apiGet for /api/resolve-refs with refs joined by comma', async () => {
      mockApiGet.mockResolvedValue({ refs: {} });

      await backend.resolveRefs(['main', 'HEAD']);

      expect(mockApiGet).toHaveBeenCalledWith('/api/resolve-refs?refs=main%2CHEAD');
    });

    it('handles a single ref', async () => {
      mockApiGet.mockResolvedValue({ refs: {} });

      await backend.resolveRefs(['main']);

      expect(mockApiGet).toHaveBeenCalledWith('/api/resolve-refs?refs=main');
    });

    it('appends repo query param when provided', async () => {
      mockApiGet.mockResolvedValue({ refs: {} });

      await backend.resolveRefs(['main'], REPO);

      expect(mockApiGet).toHaveBeenCalledWith(
        `/api/resolve-refs?refs=main&repo=${encodeURIComponent(REPO)}`,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Repos
  // ---------------------------------------------------------------------------

  describe('fetchRepos', () => {
    it('calls apiGet for /api/repos', async () => {
      mockApiGet.mockResolvedValue({ repos: [] });

      await backend.fetchRepos();

      expect(mockApiGet).toHaveBeenCalledWith('/api/repos');
    });
  });

  describe('removeRepo', () => {
    it('calls apiDelete for /api/repos with path query param', async () => {
      mockApiDelete.mockResolvedValue(undefined);

      await backend.removeRepo(REPO);

      expect(mockApiDelete).toHaveBeenCalledWith(`/api/repos?path=${encodeURIComponent(REPO)}`);
    });
  });

  // ---------------------------------------------------------------------------
  // Commits
  // ---------------------------------------------------------------------------

  describe('fetchCommits', () => {
    it('calls apiGet for /api/sessions/:sha/commits', async () => {
      mockApiGet.mockResolvedValue({ commits: [] });

      await backend.fetchCommits(SHA);

      expect(mockApiGet).toHaveBeenCalledWith(`/api/sessions/${SHA}/commits`);
    });

    it('appends repo query param when provided', async () => {
      mockApiGet.mockResolvedValue({ commits: [] });

      await backend.fetchCommits(SHA, REPO);

      expect(mockApiGet).toHaveBeenCalledWith(
        `/api/sessions/${SHA}/commits?repo=${encodeURIComponent(REPO)}`,
      );
    });
  });

  describe('fetchCommitDiff', () => {
    it('calls apiGet for /api/commits/:hash/diff', async () => {
      mockApiGet.mockResolvedValue({ diff: '' });

      await backend.fetchCommitDiff(SHA);

      expect(mockApiGet).toHaveBeenCalledWith(`/api/commits/${SHA}/diff`);
    });

    it('appends repo query param when provided', async () => {
      mockApiGet.mockResolvedValue({ diff: '' });

      await backend.fetchCommitDiff(SHA, REPO);

      expect(mockApiGet).toHaveBeenCalledWith(
        `/api/commits/${SHA}/diff?repo=${encodeURIComponent(REPO)}`,
      );
    });
  });

  describe('fetchCommitFiles', () => {
    it('calls apiGet for /api/commits/:hash/files', async () => {
      mockApiGet.mockResolvedValue({ files: [] });

      await backend.fetchCommitFiles(SHA);

      expect(mockApiGet).toHaveBeenCalledWith(`/api/commits/${SHA}/files`);
    });

    it('appends repo query param when provided', async () => {
      mockApiGet.mockResolvedValue({ files: [] });

      await backend.fetchCommitFiles(SHA, REPO);

      expect(mockApiGet).toHaveBeenCalledWith(
        `/api/commits/${SHA}/files?repo=${encodeURIComponent(REPO)}`,
      );
    });
  });
});
