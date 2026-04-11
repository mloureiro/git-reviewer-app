/**
 * Contract tests — verify every endpoint returns a response whose JSON shape
 * matches the shared schema validators. This ensures the Node.js backend
 * fulfils the same contract the Rust (Tauri) backend is expected to fulfil.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { ReviewData } from '@git-reviewer/shared';
import {
  validateFilesResponse,
  validateDiffResponse,
  validateSessionListResponse,
  validateSessionResponse,
  validateCreateCommentResponse,
  validateUpdateCommentResponse,
  validateUpdateSessionStatusResponse,
  validateViewedFileResponse,
  validateAutoMarkRulesResponse,
  validateAutoMarkApplyResponse,
  validateCommitsResponse,
  validateCommitDiffResponse,
  validateCommitFilesResponse,
} from '@git-reviewer/shared';
import { createApp } from '../app.js';
import type { SimpleGit } from 'simple-git';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../git/notes.js', () => ({
  listReviewNotes: vi.fn(),
  readReviewNote: vi.fn(),
  removeReviewNote: vi.fn(),
  writeReviewNote: vi.fn(),
}));

vi.mock('../git/diff.js', () => ({
  getDiffText: vi.fn(),
  getUncommittedDiffText: vi.fn(),
  getChangedFiles: vi.fn(),
  getUncommittedChangedFiles: vi.fn(),
  getFileDiffHashes: vi.fn(),
  createGitClient: vi.fn(),
}));

vi.mock('../git/commits.js', () => ({
  getCommitDate: vi.fn(),
  getCommitList: vi.fn(),
  getCommitDiffText: vi.fn(),
  getCommitChangedFiles: vi.fn(),
}));

vi.mock('../git/auto-mark.js', () => ({
  evaluateAutoMarkRules: vi.fn(),
}));

import { listReviewNotes, readReviewNote, writeReviewNote } from '../git/notes.js';
import { getDiffText, getChangedFiles, getFileDiffHashes, createGitClient } from '../git/diff.js';
import { getCommitList, getCommitDiffText, getCommitChangedFiles } from '../git/commits.js';
import { evaluateAutoMarkRules } from '../git/auto-mark.js';

const mockListReviewNotes = vi.mocked(listReviewNotes);
const mockReadReviewNote = vi.mocked(readReviewNote);
const mockWriteReviewNote = vi.mocked(writeReviewNote);
const mockGetDiffText = vi.mocked(getDiffText);
const mockGetChangedFiles = vi.mocked(getChangedFiles);
const mockGetFileDiffHashes = vi.mocked(getFileDiffHashes);
const mockCreateGitClient = vi.mocked(createGitClient);
const mockGetCommitList = vi.mocked(getCommitList);
const mockGetCommitDiffText = vi.mocked(getCommitDiffText);
const mockGetCommitChangedFiles = vi.mocked(getCommitChangedFiles);
const mockEvaluateAutoMarkRules = vi.mocked(evaluateAutoMarkRules);

const mockRevparse = vi.fn();
const mockGit = { revparse: mockRevparse } as unknown as SimpleGit;

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMMIT_SHA = 'abc123def456abc123def456abc123def456abc1';

const sampleSession: ReviewData = {
  version: 1,
  session: {
    id: 'session-uuid-1',
    title: 'Test Review',
    baseRef: 'main',
    headRef: 'feature-branch',
    baseCommit: 'aaaa1111',
    headCommit: COMMIT_SHA,
    status: 'pending',
    createdAt: '2026-03-19T10:00:00.000Z',
    updatedAt: '2026-03-19T10:00:00.000Z',
  },
  comments: [
    {
      id: 'comment-uuid-1',
      file: 'src/foo.ts',
      line: 42,
      side: 'right',
      body: 'This needs fixing',
      author: 'reviewer',
      createdAt: '2026-03-19T10:05:00.000Z',
      resolved: false,
    },
  ],
  viewedFiles: [
    {
      path: 'src/bar.ts',
      viewedAt: '2026-03-19T10:10:00.000Z',
      diffHash: 'abc123hash',
    },
  ],
  autoMarkRules: ['lockfile'],
};

const sampleFiles = [
  { path: 'src/foo.ts', status: 'modified' as const, additions: 5, deletions: 2 },
  { path: 'src/bar.ts', status: 'added' as const, additions: 10, deletions: 0 },
  {
    path: 'src/old.ts',
    status: 'renamed' as const,
    additions: 1,
    deletions: 1,
    oldPath: 'src/legacy.ts',
  },
];

const sampleDiffHashes: Record<string, string> = {
  'src/foo.ts': 'hash-foo',
  'src/bar.ts': 'hash-bar',
};

const sampleCommits = [
  {
    hash: 'aaa111bbb222ccc333ddd444eee555fff666aaa1',
    shortHash: 'aaa111b',
    message: 'feat: add new feature',
    author: 'Dev',
    date: '2026-03-18T09:00:00.000Z',
  },
  {
    hash: 'bbb222ccc333ddd444eee555fff666aaa111bbb2',
    shortHash: 'bbb222c',
    message: 'fix: patch edge case',
    author: 'Dev',
    date: '2026-03-19T09:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('contract tests — response shapes match shared schemas', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    mockCreateGitClient.mockReturnValue(mockGit);
    app = createApp({ repoPath: '/mock/repo' });
  });

  beforeEach(() => {
    vi.resetAllMocks();
    mockWriteReviewNote.mockResolvedValue(undefined);
  });

  // -------------------------------------------------------------------------
  // GET /api/files
  // -------------------------------------------------------------------------
  describe('GET /api/v1/files — FilesResponse', () => {
    it('matches the shared FilesResponse schema with files and diffHashes', async () => {
      mockGetChangedFiles.mockResolvedValueOnce(sampleFiles);
      mockGetDiffText.mockResolvedValueOnce('diff text');
      mockGetFileDiffHashes.mockReturnValueOnce(sampleDiffHashes);

      const res = await request(app).get('/api/v1/files').query({ base: 'main', head: 'HEAD' });

      expect(res.status).toBe(200);
      expect(() => validateFilesResponse(res.body)).not.toThrow();
    });

    it('matches the schema with an empty files array', async () => {
      mockGetChangedFiles.mockResolvedValueOnce([]);
      mockGetDiffText.mockResolvedValueOnce('');
      mockGetFileDiffHashes.mockReturnValueOnce({});

      const res = await request(app).get('/api/v1/files').query({ base: 'main', head: 'HEAD' });

      expect(res.status).toBe(200);
      expect(() => validateFilesResponse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/diff
  // -------------------------------------------------------------------------
  describe('GET /api/v1/diff — DiffResponse', () => {
    it('matches the shared DiffResponse schema', async () => {
      mockGetDiffText.mockResolvedValueOnce('diff --git a/foo b/foo\n+line\n');

      const res = await request(app).get('/api/v1/diff').query({ base: 'main', head: 'HEAD' });

      expect(res.status).toBe(200);
      expect(() => validateDiffResponse(res.body)).not.toThrow();
    });

    it('matches the schema with an empty diff', async () => {
      mockGetDiffText.mockResolvedValueOnce('');

      const res = await request(app).get('/api/v1/diff').query({ base: 'main', head: 'HEAD' });

      expect(res.status).toBe(200);
      expect(() => validateDiffResponse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/sessions
  // -------------------------------------------------------------------------
  describe('GET /api/v1/sessions — SessionListResponse', () => {
    it('matches the schema with populated sessions', async () => {
      mockListReviewNotes.mockResolvedValueOnce([{ noteHash: 'n1', commitHash: COMMIT_SHA }]);
      mockReadReviewNote.mockResolvedValueOnce(sampleSession);

      const res = await request(app).get('/api/v1/sessions');

      expect(res.status).toBe(200);
      expect(() => validateSessionListResponse(res.body)).not.toThrow();
    });

    it('matches the schema with an empty sessions array', async () => {
      mockListReviewNotes.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/v1/sessions');

      expect(res.status).toBe(200);
      expect(() => validateSessionListResponse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/sessions/:commitSha
  // -------------------------------------------------------------------------
  describe('GET /api/v1/sessions/:commitSha — SessionResponse', () => {
    it('matches the shared SessionResponse schema', async () => {
      mockReadReviewNote.mockResolvedValueOnce(sampleSession);

      const res = await request(app).get(`/api/v1/sessions/${COMMIT_SHA}`);

      expect(res.status).toBe(200);
      expect(() => validateSessionResponse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/sessions
  // -------------------------------------------------------------------------
  describe('POST /api/v1/sessions — SessionResponse (create)', () => {
    it('matches the shared SessionResponse schema', async () => {
      mockRevparse.mockResolvedValueOnce(`${COMMIT_SHA}\n`);
      mockRevparse.mockResolvedValueOnce('aaaa1111\n');

      const res = await request(app).post('/api/v1/sessions').send({
        title: 'New Review',
        baseRef: 'main',
        headRef: 'feature-branch',
      });

      expect(res.status).toBe(201);
      expect(() => validateSessionResponse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/sessions/:commitSha/comments
  // -------------------------------------------------------------------------
  describe('POST /api/v1/sessions/:commitSha/comments — CreateCommentResponse', () => {
    it('matches the shared CreateCommentResponse schema', async () => {
      mockReadReviewNote.mockResolvedValueOnce({ ...sampleSession, comments: [] });

      const res = await request(app)
        .post(`/api/v1/sessions/${COMMIT_SHA}/comments`)
        .send({ file: 'src/foo.ts', line: 10, side: 'right', body: 'Needs work', author: 'dev' });

      expect(res.status).toBe(201);
      expect(() => validateCreateCommentResponse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/sessions/:commitSha/comments/:commentId
  // -------------------------------------------------------------------------
  describe('PATCH /api/v1/sessions/:commitSha/comments/:commentId — UpdateCommentResponse', () => {
    it('matches the shared UpdateCommentResponse schema', async () => {
      const comment = sampleSession.comments[0] as (typeof sampleSession.comments)[number];
      mockReadReviewNote.mockResolvedValueOnce({
        ...sampleSession,
        comments: [{ ...comment }],
      });

      const res = await request(app)
        .patch(`/api/v1/sessions/${COMMIT_SHA}/comments/${comment.id}`)
        .send({ resolved: true });

      expect(res.status).toBe(200);
      expect(() => validateUpdateCommentResponse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // PATCH /api/sessions/:commitSha — update status
  // -------------------------------------------------------------------------
  describe('PATCH /api/v1/sessions/:commitSha — UpdateSessionStatusResponse', () => {
    it('matches the shared UpdateSessionStatusResponse schema', async () => {
      mockReadReviewNote.mockResolvedValueOnce({ ...sampleSession });

      const res = await request(app)
        .patch(`/api/v1/sessions/${COMMIT_SHA}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
      expect(() => validateUpdateSessionStatusResponse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/sessions/:commitSha/viewed-files/:filePath
  // -------------------------------------------------------------------------
  describe('PUT /api/v1/sessions/:commitSha/viewed-files/:filePath — ViewedFileResponse', () => {
    it('matches the shared ViewedFileResponse schema', async () => {
      mockReadReviewNote.mockResolvedValueOnce({ ...sampleSession, viewedFiles: [] });
      mockGetDiffText.mockResolvedValueOnce('diff text');
      mockGetFileDiffHashes.mockReturnValueOnce({ 'src/foo.ts': 'hash123' });

      const res = await request(app).put(
        `/api/v1/sessions/${COMMIT_SHA}/viewed-files/${encodeURIComponent('src/foo.ts')}`,
      );

      expect(res.status).toBe(200);
      expect(() => validateViewedFileResponse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // PUT /api/sessions/:commitSha/auto-mark-rules
  // -------------------------------------------------------------------------
  describe('PUT /api/v1/sessions/:commitSha/auto-mark-rules — AutoMarkRulesResponse', () => {
    it('matches the shared AutoMarkRulesResponse schema', async () => {
      mockReadReviewNote.mockResolvedValueOnce({ ...sampleSession, viewedFiles: [] });
      mockGetChangedFiles.mockResolvedValueOnce(sampleFiles);
      mockGetDiffText.mockResolvedValueOnce('diff text');
      mockGetFileDiffHashes.mockReturnValueOnce(sampleDiffHashes);
      mockEvaluateAutoMarkRules.mockReturnValueOnce([
        { path: 'package-lock.json', rule: 'lockfile' },
      ]);

      const res = await request(app)
        .put(`/api/v1/sessions/${COMMIT_SHA}/auto-mark-rules`)
        .send({ rules: ['lockfile'] });

      expect(res.status).toBe(200);
      expect(() => validateAutoMarkRulesResponse(res.body)).not.toThrow();
    });

    it('matches the schema with no matches', async () => {
      mockReadReviewNote.mockResolvedValueOnce({ ...sampleSession, viewedFiles: [] });
      mockGetChangedFiles.mockResolvedValueOnce(sampleFiles);
      mockGetDiffText.mockResolvedValueOnce('diff text');
      mockGetFileDiffHashes.mockReturnValueOnce(sampleDiffHashes);
      mockEvaluateAutoMarkRules.mockReturnValueOnce([]);

      const res = await request(app)
        .put(`/api/v1/sessions/${COMMIT_SHA}/auto-mark-rules`)
        .send({ rules: ['lockfile'] });

      expect(res.status).toBe(200);
      expect(() => validateAutoMarkRulesResponse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // POST /api/sessions/:commitSha/auto-mark-apply
  // -------------------------------------------------------------------------
  describe('POST /api/v1/sessions/:commitSha/auto-mark-apply — AutoMarkApplyResponse', () => {
    it('matches the shared AutoMarkApplyResponse schema', async () => {
      mockReadReviewNote.mockResolvedValueOnce({
        ...sampleSession,
        autoMarkRules: ['lockfile'],
        viewedFiles: [],
      });
      mockGetChangedFiles.mockResolvedValueOnce(sampleFiles);
      mockGetDiffText.mockResolvedValueOnce('diff text');
      mockGetFileDiffHashes.mockReturnValueOnce(sampleDiffHashes);
      mockEvaluateAutoMarkRules.mockReturnValueOnce([
        { path: 'package-lock.json', rule: 'lockfile' },
      ]);

      const res = await request(app).post(`/api/v1/sessions/${COMMIT_SHA}/auto-mark-apply`);

      expect(res.status).toBe(200);
      expect(() => validateAutoMarkApplyResponse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/sessions/:commitSha/commits
  // -------------------------------------------------------------------------
  describe('GET /api/v1/sessions/:commitSha/commits — CommitsResponse', () => {
    it('matches the shared CommitsResponse schema', async () => {
      mockReadReviewNote.mockResolvedValueOnce(sampleSession);
      mockGetCommitList.mockResolvedValueOnce(sampleCommits);

      const res = await request(app).get(`/api/v1/sessions/${COMMIT_SHA}/commits`);

      expect(res.status).toBe(200);
      expect(() => validateCommitsResponse(res.body)).not.toThrow();
    });

    it('matches the schema with an empty commits array', async () => {
      mockReadReviewNote.mockResolvedValueOnce(sampleSession);
      mockGetCommitList.mockResolvedValueOnce([]);

      const res = await request(app).get(`/api/v1/sessions/${COMMIT_SHA}/commits`);

      expect(res.status).toBe(200);
      expect(() => validateCommitsResponse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/commits/:commitHash/diff
  // -------------------------------------------------------------------------
  describe('GET /api/v1/commits/:commitHash/diff — CommitDiffResponse', () => {
    it('matches the shared CommitDiffResponse schema', async () => {
      mockGetCommitDiffText.mockResolvedValueOnce('diff --git a/f b/f\n+new\n');

      const res = await request(app).get(`/api/v1/commits/${COMMIT_SHA}/diff`);

      expect(res.status).toBe(200);
      expect(() => validateCommitDiffResponse(res.body)).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // GET /api/commits/:commitHash/files
  // -------------------------------------------------------------------------
  describe('GET /api/v1/commits/:commitHash/files — CommitFilesResponse', () => {
    it('matches the shared CommitFilesResponse schema', async () => {
      mockGetCommitChangedFiles.mockResolvedValueOnce(sampleFiles);
      mockGetCommitDiffText.mockResolvedValueOnce('diff text');
      mockGetFileDiffHashes.mockReturnValueOnce(sampleDiffHashes);

      const res = await request(app).get(`/api/v1/commits/${COMMIT_SHA}/files`);

      expect(res.status).toBe(200);
      expect(() => validateCommitFilesResponse(res.body)).not.toThrow();
    });
  });
});
