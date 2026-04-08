import { describe, it, expect, vi, beforeAll } from 'vitest';
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

import { readReviewNote, writeReviewNote } from '../git/notes.js';
import { getDiffText, createGitClient } from '../git/diff.js';

const mockReadReviewNote = vi.mocked(readReviewNote);
const mockWriteReviewNote = vi.mocked(writeReviewNote);
const mockGetDiffText = vi.mocked(getDiffText);
const mockCreateGitClient = vi.mocked(createGitClient);

// ---------------------------------------------------------------------------
// In-memory git-notes store — simulates what writeReviewNote/readReviewNote
// would do against real git-notes, so each step sees the updated state from
// the previous step without touching the filesystem or a real git repo.
// ---------------------------------------------------------------------------
let noteStore: ReviewData | null = null;

const HEAD_COMMIT = 'deadbeef1234deadbeef1234deadbeef12345678';
const BASE_COMMIT = 'cafecafe5678cafecafe5678cafecafe56789012';

const SAMPLE_DIFF =
  'diff --git a/src/auth.ts b/src/auth.ts\n' +
  'index 0000000..1111111 100644\n' +
  '--- a/src/auth.ts\n' +
  '+++ b/src/auth.ts\n' +
  '@@ -1,3 +1,5 @@\n' +
  '+export function authenticate(token: string): boolean {\n' +
  '+  return token.length > 0;\n' +
  ' }\n';

const mockRevparse = vi.fn();
const mockGit = { revparse: mockRevparse } as unknown as SimpleGit;

describe('E2E smoke test — full review flow', () => {
  let app: ReturnType<typeof createApp>;

  // Accumulated state across steps
  let headCommit: string;
  let commentId: string;

  beforeAll(() => {
    mockCreateGitClient.mockReturnValue(mockGit);
    app = createApp({ repoPath: '/mock/repo' });

    // Wire the in-memory store: writeReviewNote saves, readReviewNote returns it
    mockWriteReviewNote.mockImplementation(async (_git, _sha, data) => {
      noteStore = structuredClone(data);
    });
    mockReadReviewNote.mockImplementation(async () => {
      return noteStore ? structuredClone(noteStore) : null;
    });
  });

  // ---------------------------------------------------------------------------
  // Step 1: Create a review session
  // ---------------------------------------------------------------------------
  it('step 1 — POST /api/sessions creates a new review session', async () => {
    mockRevparse.mockResolvedValueOnce(`${HEAD_COMMIT}\n`);
    mockRevparse.mockResolvedValueOnce(`${BASE_COMMIT}\n`);

    const res = await request(app).post('/api/sessions').send({
      title: 'E2E Smoke Review',
      baseRef: 'main',
      headRef: 'HEAD',
    });

    expect(res.status).toBe(201);
    expect(res.body.session.version).toBe(1);
    expect(res.body.session.session.title).toBe('E2E Smoke Review');
    expect(res.body.session.session.baseRef).toBe('main');
    expect(res.body.session.session.headRef).toBe('HEAD');
    expect(res.body.session.session.status).toBe('pending');
    expect(res.body.session.session.headCommit).toBe(HEAD_COMMIT);
    expect(res.body.session.session.baseCommit).toBe(BASE_COMMIT);
    expect(res.body.session.comments).toEqual([]);

    headCommit = res.body.session.session.headCommit;
    expect(mockWriteReviewNote).toHaveBeenCalledOnce();
  });

  // ---------------------------------------------------------------------------
  // Step 2: Get the session
  // ---------------------------------------------------------------------------
  it('step 2 — GET /api/sessions/:commitSha returns the created session', async () => {
    const res = await request(app).get(`/api/sessions/${headCommit}`);

    expect(res.status).toBe(200);
    expect(res.body.session.session.title).toBe('E2E Smoke Review');
    expect(res.body.session.session.status).toBe('pending');
    expect(res.body.session.session.headCommit).toBe(HEAD_COMMIT);
    expect(res.body.session.comments).toEqual([]);
  });

  // ---------------------------------------------------------------------------
  // Step 3: Get the diff
  // ---------------------------------------------------------------------------
  it('step 3 — GET /api/diff returns diff for the session range', async () => {
    mockGetDiffText.mockResolvedValueOnce(SAMPLE_DIFF);

    const res = await request(app).get('/api/diff').query({ base: 'main', head: 'HEAD' });

    expect(res.status).toBe(200);
    expect(res.body.diff).toBe(SAMPLE_DIFF);
    expect(mockGetDiffText).toHaveBeenCalledWith(mockGit, 'main', 'HEAD');
  });

  // ---------------------------------------------------------------------------
  // Step 4: Add a comment
  // ---------------------------------------------------------------------------
  it('step 4 — POST /api/sessions/:commitSha/comments adds a comment', async () => {
    const res = await request(app).post(`/api/sessions/${headCommit}/comments`).send({
      file: 'src/auth.ts',
      line: 2,
      side: 'right',
      body: 'This does not handle expired tokens',
      author: 'reviewer',
    });

    expect(res.status).toBe(201);
    expect(res.body.file).toBe('src/auth.ts');
    expect(res.body.line).toBe(2);
    expect(res.body.side).toBe('right');
    expect(res.body.body).toBe('This does not handle expired tokens');
    expect(res.body.author).toBe('reviewer');
    expect(res.body.resolved).toBe(false);
    expect(res.body.id).toBeDefined();
    expect(res.body.createdAt).toBeDefined();

    commentId = res.body.id;

    // Session note should now contain the comment
    if (noteStore === null) {
      expect.fail('noteStore should not be null after adding a comment');
    }
    const storedComments = noteStore.comments;
    expect(storedComments).toHaveLength(1);
    const firstComment = storedComments.at(0);
    expect(firstComment?.id).toBe(commentId);
  });

  // ---------------------------------------------------------------------------
  // Step 5: Resolve the comment
  // ---------------------------------------------------------------------------
  it('step 5 — PATCH /api/sessions/:commitSha/comments/:id resolves the comment', async () => {
    const res = await request(app)
      .patch(`/api/sessions/${headCommit}/comments/${commentId}`)
      .send({ resolved: true });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(commentId);
    expect(res.body.resolved).toBe(true);

    // Persisted store should reflect resolved state
    if (noteStore === null) {
      expect.fail('noteStore should not be null after resolving comment');
    }
    expect(noteStore.comments.at(0)?.resolved).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Step 6: Change session status
  // ---------------------------------------------------------------------------
  it('step 6 — PATCH /api/sessions/:commitSha changes status to approved', async () => {
    const res = await request(app)
      .patch(`/api/sessions/${headCommit}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('approved');
    expect(res.body.session.id).toBe(noteStore?.session.id);

    // Persisted store should reflect new status
    expect(noteStore?.session.status).toBe('approved');
  });

  // ---------------------------------------------------------------------------
  // Step 7: Verify final state
  // ---------------------------------------------------------------------------
  it('step 7 — GET /api/sessions/:commitSha returns fully updated session', async () => {
    const res = await request(app).get(`/api/sessions/${headCommit}`);

    expect(res.status).toBe(200);

    // Session status
    expect(res.body.session.session.status).toBe('approved');
    expect(res.body.session.session.title).toBe('E2E Smoke Review');

    // Comment is present and resolved
    expect(res.body.session.comments).toHaveLength(1);
    expect(res.body.session.comments[0].id).toBe(commentId);
    expect(res.body.session.comments[0].resolved).toBe(true);
    expect(res.body.session.comments[0].body).toBe('This does not handle expired tokens');
  });
});
