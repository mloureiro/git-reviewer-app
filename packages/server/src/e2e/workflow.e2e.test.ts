/**
 * E2E tests — full review workflow against a real git repository.
 *
 * Unlike the smoke test (review.smoke.test.ts) which mocks the git layer,
 * these tests create an actual git repository in a temp directory, make real
 * commits, and drive the full API flow: register repo → create session →
 * get diff → add comment → resolve comment → change status.
 *
 * The temp repo is created once per suite in beforeAll and removed in afterAll.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { execSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createApp } from '../app.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Run a shell command inside the given working directory, throwing on error. */
function run(cmd: string, cwd: string): string {
  return execSync(cmd, { cwd, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

/** Create a minimal git repo with a linear commit history in a temp dir. */
function createTempRepo(): { repoPath: string; baseCommit: string; headCommit: string } {
  const repoPath = mkdtempSync(join(tmpdir(), 'git-reviewer-e2e-'));

  run('git init', repoPath);
  run('git config user.email "e2e@test.local"', repoPath);
  run('git config user.name "E2E Test"', repoPath);

  // Initial commit on main — this becomes the base ref
  writeFileSync(join(repoPath, 'README.md'), '# Hello\n');
  run('git add README.md', repoPath);
  run('git commit -m "chore: initial commit"', repoPath);
  const baseCommit = run('git rev-parse HEAD', repoPath).trim();

  // Create a feature branch and add a change
  run('git checkout -b feature', repoPath);
  writeFileSync(
    join(repoPath, 'auth.ts'),
    'export function authenticate(token: string): boolean {\n  return token.length > 0;\n}\n',
  );
  run('git add auth.ts', repoPath);
  run('git commit -m "feat: add authenticate function"', repoPath);
  const headCommit = run('git rev-parse HEAD', repoPath).trim();

  return { repoPath, baseCommit, headCommit };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('E2E — full review workflow against a real git repository', () => {
  let repoPath: string;
  let baseCommit: string;
  let headCommit: string;
  let app: ReturnType<typeof createApp>;

  // State accumulated across sequential steps
  let sessionHeadCommit: string;
  let commentId: string;

  beforeAll(() => {
    ({ repoPath, baseCommit, headCommit } = createTempRepo());
    app = createApp({ repoPath });
  });

  afterAll(() => {
    rmSync(repoPath, { recursive: true, force: true });
  });

  // -------------------------------------------------------------------------
  // Step 1 — Register a secondary repo via the API (verifies POST /repos)
  // -------------------------------------------------------------------------
  it('step 1 — GET /api/v1/repos lists the default repo registered at startup', async () => {
    const res = await request(app).get('/api/v1/repos');

    expect(res.status).toBe(200);
    expect(res.body.repos).toHaveLength(1);
    expect(res.body.repos[0]).toBe(repoPath);
  });

  // -------------------------------------------------------------------------
  // Step 2 — Create a review session for the real commits
  // -------------------------------------------------------------------------
  it('step 2 — POST /api/v1/sessions creates a session using real commit refs', async () => {
    // Use the actual commit SHAs so the server resolves them via real git.
    const res = await request(app).post('/api/v1/sessions').send({
      title: 'E2E — auth feature review',
      baseRef: baseCommit,
      headRef: headCommit,
    });

    expect(res.status).toBe(201);

    const { session: reviewData } = res.body as {
      session: {
        version: number;
        session: {
          title: string;
          baseRef: string;
          headRef: string;
          baseCommit: string;
          headCommit: string;
          status: string;
        };
        comments: unknown[];
      };
    };

    expect(reviewData.version).toBe(1);
    expect(reviewData.session.title).toBe('E2E — auth feature review');
    expect(reviewData.session.baseRef).toBe(baseCommit);
    expect(reviewData.session.headRef).toBe(headCommit);
    expect(reviewData.session.status).toBe('pending');
    expect(reviewData.session.headCommit).toBe(headCommit);
    expect(reviewData.session.baseCommit).toBe(baseCommit);
    expect(reviewData.comments).toEqual([]);

    sessionHeadCommit = reviewData.session.headCommit;
  });

  // -------------------------------------------------------------------------
  // Step 3 — Retrieve the session
  // -------------------------------------------------------------------------
  it('step 3 — GET /api/v1/sessions/:commitSha returns the created session', async () => {
    const res = await request(app).get(`/api/v1/sessions/${sessionHeadCommit}`);

    expect(res.status).toBe(200);
    expect(res.body.session.session.title).toBe('E2E — auth feature review');
    expect(res.body.session.session.status).toBe('pending');
    expect(res.body.session.comments).toEqual([]);
  });

  // -------------------------------------------------------------------------
  // Step 4 — Get the real diff
  // -------------------------------------------------------------------------
  it('step 4 — GET /api/v1/diff returns the real diff between the two commits', async () => {
    const res = await request(app)
      .get('/api/v1/diff')
      .query({ base: baseCommit, head: headCommit });

    expect(res.status).toBe(200);
    expect(typeof res.body.diff).toBe('string');
    // The diff must contain the added function (real git output)
    expect(res.body.diff).toContain('authenticate');
    expect(res.body.diff).toContain('auth.ts');
  });

  // -------------------------------------------------------------------------
  // Step 5 — Get changed files
  // -------------------------------------------------------------------------
  it('step 5 — GET /api/v1/files returns the files changed between the commits', async () => {
    const res = await request(app)
      .get('/api/v1/files')
      .query({ base: baseCommit, head: headCommit });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.files)).toBe(true);
    expect(res.body.files.length).toBeGreaterThan(0);

    const authFile = (res.body.files as Array<{ path: string }>).find((f) =>
      f.path.includes('auth.ts'),
    );
    expect(authFile).toBeDefined();
  });

  // -------------------------------------------------------------------------
  // Step 6 — Add a comment
  // -------------------------------------------------------------------------
  it('step 6 — POST /api/v1/sessions/:commitSha/comments adds a comment', async () => {
    const res = await request(app).post(`/api/v1/sessions/${sessionHeadCommit}/comments`).send({
      file: 'auth.ts',
      line: 2,
      side: 'right',
      body: 'Token length check is not sufficient — consider verifying format',
      author: 'e2e-reviewer',
    });

    expect(res.status).toBe(201);
    expect(res.body.file).toBe('auth.ts');
    expect(res.body.line).toBe(2);
    expect(res.body.side).toBe('right');
    expect(res.body.body).toBe('Token length check is not sufficient — consider verifying format');
    expect(res.body.author).toBe('e2e-reviewer');
    expect(res.body.resolved).toBe(false);
    expect(typeof res.body.id).toBe('string');
    expect(typeof res.body.createdAt).toBe('string');

    commentId = res.body.id as string;
  });

  // -------------------------------------------------------------------------
  // Step 7 — Verify the comment is persisted (GET session includes it)
  // -------------------------------------------------------------------------
  it('step 7 — GET /api/v1/sessions/:commitSha returns the session with the comment', async () => {
    const res = await request(app).get(`/api/v1/sessions/${sessionHeadCommit}`);

    expect(res.status).toBe(200);
    expect(res.body.session.comments).toHaveLength(1);

    const comment = res.body.session.comments[0] as {
      id: string;
      file: string;
      resolved: boolean;
    };
    expect(comment.id).toBe(commentId);
    expect(comment.file).toBe('auth.ts');
    expect(comment.resolved).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Step 8 — Resolve the comment
  // -------------------------------------------------------------------------
  it('step 8 — PATCH /api/v1/sessions/:commitSha/comments/:id resolves the comment', async () => {
    const res = await request(app)
      .patch(`/api/v1/sessions/${sessionHeadCommit}/comments/${commentId}`)
      .send({ resolved: true });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(commentId);
    expect(res.body.resolved).toBe(true);
  });

  // -------------------------------------------------------------------------
  // Step 9 — Change session status to approved
  // -------------------------------------------------------------------------
  it('step 9 — PATCH /api/v1/sessions/:commitSha updates status to approved', async () => {
    const res = await request(app)
      .patch(`/api/v1/sessions/${sessionHeadCommit}`)
      .send({ status: 'approved' });

    expect(res.status).toBe(200);
    expect(res.body.session.status).toBe('approved');
  });

  // -------------------------------------------------------------------------
  // Step 10 — Verify final state via GET
  // -------------------------------------------------------------------------
  it('step 10 — GET /api/v1/sessions/:commitSha returns the fully updated session', async () => {
    const res = await request(app).get(`/api/v1/sessions/${sessionHeadCommit}`);

    expect(res.status).toBe(200);

    const { session: reviewData } = res.body as {
      session: {
        session: { status: string; title: string };
        comments: Array<{ id: string; resolved: boolean; body: string }>;
      };
    };

    expect(reviewData.session.status).toBe('approved');
    expect(reviewData.session.title).toBe('E2E — auth feature review');

    expect(reviewData.comments).toHaveLength(1);
    const firstComment = reviewData.comments.at(0);
    expect(firstComment?.id).toBe(commentId);
    expect(firstComment?.resolved).toBe(true);
    expect(firstComment?.body).toBe(
      'Token length check is not sufficient — consider verifying format',
    );
  });

  // -------------------------------------------------------------------------
  // Step 11 — GET /sessions lists the session
  // -------------------------------------------------------------------------
  it('step 11 — GET /api/v1/sessions lists the session with approved status', async () => {
    const res = await request(app).get('/api/v1/sessions');

    expect(res.status).toBe(200);
    expect(res.body.total).toBeGreaterThanOrEqual(1);

    const sessions = res.body.sessions as Array<{
      session: { headCommit: string; status: string };
    }>;
    const ourSession = sessions.find((s) => s.session.headCommit === sessionHeadCommit);
    expect(ourSession).toBeDefined();
    expect(ourSession?.session.status).toBe('approved');
  });

  // -------------------------------------------------------------------------
  // Step 12 — Delete the session
  // -------------------------------------------------------------------------
  it('step 12 — DELETE /api/v1/sessions/:commitSha removes the session', async () => {
    const res = await request(app).delete(`/api/v1/sessions/${sessionHeadCommit}`);

    expect(res.status).toBe(204);
  });

  it('step 12b — GET /api/v1/sessions/:commitSha returns 404 after deletion', async () => {
    const res = await request(app).get(`/api/v1/sessions/${sessionHeadCommit}`);

    expect(res.status).toBe(404);
  });
});
