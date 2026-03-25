import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import type { ReviewData } from '@git-reviewer/shared';
import { createApp } from '../app.js';
import type { SimpleGit } from 'simple-git';

// Mock the git layer modules so tests need no real git repo
vi.mock('../git/notes.js', () => ({
  listReviewNotes: vi.fn(),
  readReviewNote: vi.fn(),
  writeReviewNote: vi.fn(),
}));

vi.mock('../git/diff.js', () => ({
  getDiffText: vi.fn(),
  getUncommittedDiffText: vi.fn(),
  getChangedFiles: vi.fn(),
  getUncommittedChangedFiles: vi.fn(),
  createGitClient: vi.fn(),
}));

import { listReviewNotes, readReviewNote, writeReviewNote } from '../git/notes.js';
import {
  getDiffText,
  getUncommittedDiffText,
  getChangedFiles,
  getUncommittedChangedFiles,
  createGitClient,
} from '../git/diff.js';

const mockListReviewNotes = vi.mocked(listReviewNotes);
const mockReadReviewNote = vi.mocked(readReviewNote);
const mockWriteReviewNote = vi.mocked(writeReviewNote);
const mockGetDiffText = vi.mocked(getDiffText);
const mockGetUncommittedDiffText = vi.mocked(getUncommittedDiffText);
const mockGetChangedFiles = vi.mocked(getChangedFiles);
const mockGetUncommittedChangedFiles = vi.mocked(getUncommittedChangedFiles);
const mockCreateGitClient = vi.mocked(createGitClient);

// Minimal SimpleGit stub — routes call git.revparse only in POST /sessions
const mockRevparse = vi.fn();
const mockGit = {
  revparse: mockRevparse,
} as unknown as SimpleGit;

const COMMIT_SHA = 'abc123def456abc123def456abc123def456abc1';

const sampleSession: ReviewData = {
  version: 1,
  session: {
    id: 'session-uuid-1',
    title: 'Test Review',
    baseRef: 'main',
    headRef: 'HEAD',
    baseCommit: 'base123',
    headCommit: COMMIT_SHA,
    status: 'pending',
    createdAt: '2026-03-19T10:00:00Z',
    updatedAt: '2026-03-19T10:00:00Z',
  },
  comments: [],
};

const sampleComment = {
  id: 'comment-uuid-1',
  file: 'src/foo.ts',
  line: 42,
  side: 'right' as const,
  body: 'This needs fixing',
  author: 'reviewer',
  createdAt: '2026-03-19T10:05:00Z',
  resolved: false,
};

describe('review API routes — integration', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    mockCreateGitClient.mockReturnValue(mockGit);
    app = createApp({ repoPath: '/mock/repo' });
  });

  beforeEach(() => {
    vi.resetAllMocks();
    mockWriteReviewNote.mockResolvedValue(undefined);
  });

  // ---------------------------------------------------------------------------
  // GET /api/diff
  // ---------------------------------------------------------------------------
  describe('GET /api/diff', () => {
    it('returns 500 when getDiffText throws', async () => {
      mockGetDiffText.mockRejectedValueOnce(new Error('git diff failed'));

      const res = await request(app).get('/api/diff').query({ base: 'main', head: 'HEAD' });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    it('returns diff text for base and head query params', async () => {
      const diffText = 'diff --git a/src/foo.ts b/src/foo.ts\n+added line\n';
      mockGetDiffText.mockResolvedValueOnce(diffText);

      const res = await request(app).get('/api/diff').query({ base: 'main', head: 'HEAD' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ diff: diffText });
      expect(mockGetDiffText).toHaveBeenCalledWith(mockGit, 'main', 'HEAD');
    });

    it('returns uncommitted diff when uncommitted=true is passed', async () => {
      const diffText = 'diff --git a/src/bar.ts b/src/bar.ts\n+uncommitted change\n';
      mockGetUncommittedDiffText.mockResolvedValueOnce(diffText);

      const res = await request(app).get('/api/diff').query({ uncommitted: 'true' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ diff: diffText });
      expect(mockGetUncommittedDiffText).toHaveBeenCalledWith(mockGit);
      expect(mockGetDiffText).not.toHaveBeenCalled();
    });

    it('falls back to main..HEAD when base and head params are omitted', async () => {
      mockGetDiffText.mockResolvedValueOnce('');

      const res = await request(app).get('/api/diff');

      expect(res.status).toBe(200);
      expect(mockGetDiffText).toHaveBeenCalledWith(mockGit, 'main', 'HEAD');
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/files
  // ---------------------------------------------------------------------------
  describe('GET /api/files', () => {
    it('returns 500 when getChangedFiles throws', async () => {
      mockGetChangedFiles.mockRejectedValueOnce(new Error('git diff --name-status failed'));

      const res = await request(app).get('/api/files').query({ base: 'main', head: 'HEAD' });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    it('returns changed files for base and head query params', async () => {
      const files = [
        { path: 'src/foo.ts', status: 'modified' as const, additions: 5, deletions: 2 },
        { path: 'src/bar.ts', status: 'added' as const, additions: 10, deletions: 0 },
      ];
      mockGetChangedFiles.mockResolvedValueOnce(files);

      const res = await request(app).get('/api/files').query({ base: 'main', head: 'HEAD' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ files });
      expect(mockGetChangedFiles).toHaveBeenCalledWith(mockGit, 'main', 'HEAD');
    });

    it('returns uncommitted changed files when uncommitted=true is passed', async () => {
      const files = [
        { path: 'src/baz.ts', status: 'modified' as const, additions: 3, deletions: 1 },
      ];
      mockGetUncommittedChangedFiles.mockResolvedValueOnce(files);

      const res = await request(app).get('/api/files').query({ uncommitted: 'true' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ files });
      expect(mockGetUncommittedChangedFiles).toHaveBeenCalledWith(mockGit);
      expect(mockGetChangedFiles).not.toHaveBeenCalled();
    });

    it('falls back to main..HEAD when base and head params are omitted', async () => {
      mockGetChangedFiles.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/files');

      expect(res.status).toBe(200);
      expect(mockGetChangedFiles).toHaveBeenCalledWith(mockGit, 'main', 'HEAD');
    });

    it('returns an empty files array when there are no changed files', async () => {
      mockGetChangedFiles.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/files').query({ base: 'main', head: 'HEAD' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ files: [] });
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/sessions
  // ---------------------------------------------------------------------------
  describe('GET /api/sessions', () => {
    it('returns 500 when listReviewNotes throws', async () => {
      mockListReviewNotes.mockRejectedValueOnce(new Error('git notes list failed'));

      const res = await request(app).get('/api/sessions');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    it('returns an empty sessions array when no notes exist', async () => {
      mockListReviewNotes.mockResolvedValueOnce([]);

      const res = await request(app).get('/api/sessions');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ sessions: [] });
    });

    it('returns populated sessions array when notes exist', async () => {
      mockListReviewNotes.mockResolvedValueOnce([{ noteHash: 'note1', commitHash: COMMIT_SHA }]);
      mockReadReviewNote.mockResolvedValueOnce(sampleSession);

      const res = await request(app).get('/api/sessions');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ sessions: [sampleSession] });
    });
  });

  // ---------------------------------------------------------------------------
  // GET /api/sessions/:commitSha
  // ---------------------------------------------------------------------------
  describe('GET /api/sessions/:commitSha', () => {
    it('returns 500 when readReviewNote throws', async () => {
      mockReadReviewNote.mockRejectedValueOnce(new Error('git notes show failed'));

      const res = await request(app).get(`/api/sessions/${COMMIT_SHA}`);

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });

    it('returns the review session for a known commitSha', async () => {
      mockReadReviewNote.mockResolvedValueOnce(sampleSession);

      const res = await request(app).get(`/api/sessions/${COMMIT_SHA}`);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(sampleSession);
      expect(mockReadReviewNote).toHaveBeenCalledWith(mockGit, COMMIT_SHA);
    });

    it('returns 404 when the commitSha has no associated session', async () => {
      mockReadReviewNote.mockResolvedValueOnce(null);

      const res = await request(app).get('/api/sessions/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Review session not found' });
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/sessions
  // ---------------------------------------------------------------------------
  describe('POST /api/sessions', () => {
    it('creates and returns a new review session with status 201', async () => {
      mockRevparse.mockResolvedValueOnce(`${COMMIT_SHA}\n`); // headRef
      mockRevparse.mockResolvedValueOnce('base123\n'); // baseRef

      const res = await request(app).post('/api/sessions').send({
        title: 'Test Review',
        baseRef: 'main',
        headRef: 'HEAD',
      });

      expect(res.status).toBe(201);
      expect(res.body.version).toBe(1);
      expect(res.body.session.title).toBe('Test Review');
      expect(res.body.session.baseRef).toBe('main');
      expect(res.body.session.headRef).toBe('HEAD');
      expect(res.body.session.status).toBe('pending');
      expect(res.body.session.headCommit).toBe(COMMIT_SHA);
      expect(res.body.session.baseCommit).toBe('base123');
      expect(res.body.comments).toEqual([]);
      expect(mockWriteReviewNote).toHaveBeenCalledOnce();
    });

    it('returns 500 when git.revparse throws (invalid ref)', async () => {
      mockRevparse.mockRejectedValueOnce(new Error('fatal: ambiguous argument'));

      const res = await request(app).post('/api/sessions').send({
        title: 'Bad Review',
        baseRef: 'nonexistent-branch',
        headRef: 'HEAD',
      });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ---------------------------------------------------------------------------
  // POST /api/sessions/:commitSha/comments
  // ---------------------------------------------------------------------------
  describe('POST /api/sessions/:commitSha/comments', () => {
    it('adds a comment to a session and returns it with status 201', async () => {
      const sessionWithComment: ReviewData = {
        ...sampleSession,
        comments: [],
      };
      mockReadReviewNote.mockResolvedValueOnce(sessionWithComment);

      const res = await request(app).post(`/api/sessions/${COMMIT_SHA}/comments`).send({
        file: 'src/foo.ts',
        line: 42,
        side: 'right',
        body: 'This needs fixing',
        author: 'reviewer',
      });

      expect(res.status).toBe(201);
      expect(res.body.file).toBe('src/foo.ts');
      expect(res.body.line).toBe(42);
      expect(res.body.side).toBe('right');
      expect(res.body.body).toBe('This needs fixing');
      expect(res.body.author).toBe('reviewer');
      expect(res.body.resolved).toBe(false);
      expect(res.body.id).toBeDefined();
      expect(res.body.createdAt).toBeDefined();
      expect(mockWriteReviewNote).toHaveBeenCalledOnce();
    });

    it('returns 404 when the session does not exist', async () => {
      mockReadReviewNote.mockResolvedValueOnce(null);

      const res = await request(app)
        .post('/api/sessions/nonexistent/comments')
        .send({ file: 'src/foo.ts', line: 1, body: 'comment', author: 'reviewer' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Review session not found' });
    });

    it('returns 500 when writeReviewNote throws during comment creation', async () => {
      mockReadReviewNote.mockResolvedValueOnce({ ...sampleSession, comments: [] });
      mockWriteReviewNote.mockRejectedValueOnce(new Error('git notes write failed'));

      const res = await request(app)
        .post(`/api/sessions/${COMMIT_SHA}/comments`)
        .send({ file: 'src/foo.ts', line: 1, body: 'boom', author: 'reviewer' });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/sessions/:commitSha/comments/:commentId
  // ---------------------------------------------------------------------------
  describe('PATCH /api/sessions/:commitSha/comments/:commentId', () => {
    it('resolves a comment and returns the updated comment', async () => {
      const sessionWithComment: ReviewData = {
        ...sampleSession,
        comments: [{ ...sampleComment }],
      };
      mockReadReviewNote.mockResolvedValueOnce(sessionWithComment);

      const res = await request(app)
        .patch(`/api/sessions/${COMMIT_SHA}/comments/${sampleComment.id}`)
        .send({ resolved: true });

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(sampleComment.id);
      expect(res.body.resolved).toBe(true);
      expect(mockWriteReviewNote).toHaveBeenCalledOnce();
    });

    it('returns 404 when the comment does not exist in the session', async () => {
      const sessionWithComment: ReviewData = {
        ...sampleSession,
        comments: [{ ...sampleComment }],
      };
      mockReadReviewNote.mockResolvedValueOnce(sessionWithComment);

      const res = await request(app)
        .patch(`/api/sessions/${COMMIT_SHA}/comments/nonexistent-comment-id`)
        .send({ resolved: true });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Comment not found' });
    });

    it('returns 404 when the session is not found during PATCH comment', async () => {
      mockReadReviewNote.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch(`/api/sessions/${COMMIT_SHA}/comments/${sampleComment.id}`)
        .send({ resolved: true });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Review session not found' });
    });

    it('returns 500 when writeReviewNote throws during comment resolve', async () => {
      const sessionWithComment: ReviewData = { ...sampleSession, comments: [{ ...sampleComment }] };
      mockReadReviewNote.mockResolvedValueOnce(sessionWithComment);
      mockWriteReviewNote.mockRejectedValueOnce(new Error('git notes write failed'));

      const res = await request(app)
        .patch(`/api/sessions/${COMMIT_SHA}/comments/${sampleComment.id}`)
        .send({ resolved: true });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  // ---------------------------------------------------------------------------
  // PATCH /api/sessions/:commitSha
  // ---------------------------------------------------------------------------
  describe('PATCH /api/sessions/:commitSha', () => {
    it('updates session status and returns the updated session', async () => {
      mockReadReviewNote.mockResolvedValueOnce({ ...sampleSession });

      const res = await request(app)
        .patch(`/api/sessions/${COMMIT_SHA}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('approved');
      expect(res.body.id).toBe(sampleSession.session.id);
      expect(mockWriteReviewNote).toHaveBeenCalledOnce();
    });

    it('returns 404 when the session does not exist', async () => {
      mockReadReviewNote.mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/api/sessions/nonexistent')
        .send({ status: 'approved' });

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Review session not found' });
    });

    it('returns 500 when writeReviewNote throws during status update', async () => {
      mockReadReviewNote.mockResolvedValueOnce({ ...sampleSession });
      mockWriteReviewNote.mockRejectedValueOnce(new Error('git notes write failed'));

      const res = await request(app)
        .patch(`/api/sessions/${COMMIT_SHA}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });
});
