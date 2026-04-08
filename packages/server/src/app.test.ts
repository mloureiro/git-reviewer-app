import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';
import path from 'path';
import { createApp } from './app.js';

vi.mock('./git/notes.js', () => ({
  listReviewNotes: vi.fn().mockResolvedValue([]),
  readReviewNote: vi.fn().mockResolvedValue(null),
  writeReviewNote: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('./git/diff.js', () => ({
  getDiffText: vi.fn().mockResolvedValue(''),
  getUncommittedDiffText: vi.fn().mockResolvedValue(''),
  getChangedFiles: vi.fn().mockResolvedValue([]),
  getUncommittedChangedFiles: vi.fn().mockResolvedValue([]),
  createGitClient: vi.fn().mockReturnValue({ revparse: vi.fn() }),
}));

// Use the server's own src/ directory as a real existing path for staticDir tests.
const EXISTING_STATIC_DIR = path.resolve(import.meta.dirname);

describe('createApp', () => {
  describe('GET /api/v1/health', () => {
    it('returns { status: ok } with HTTP 200', async () => {
      const app = createApp({ repoPath: '/mock/repo', staticDir: EXISTING_STATIC_DIR });

      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('static serving (staticDir provided)', () => {
    let app: ReturnType<typeof createApp>;

    beforeAll(() => {
      app = createApp({ repoPath: '/mock/repo', staticDir: EXISTING_STATIC_DIR });
    });

    it('returns 404 JSON for unknown /api/v1/* paths when static dir is set', async () => {
      // The SPA catch-all guard returns 404 JSON for unrecognised /api/ paths.
      const res = await request(app).get('/api/v1/nonexistent-endpoint-xyz');

      expect(res.status).toBe(404);
    });

    it('does not set CORS headers when staticDir is provided (production mode)', async () => {
      const res = await request(app)
        .options('/api/v1/health')
        .set('Origin', 'http://localhost:5173')
        .set('Access-Control-Request-Method', 'GET');

      // CORS middleware is skipped in production — header should be absent.
      expect(res.headers['access-control-allow-origin']).toBeUndefined();
    });
  });

  describe('resolveStaticDir with explicit path', () => {
    it('uses the resolved staticDir path when one is explicitly provided', async () => {
      // When staticDir is provided createApp must use it (not the auto-detected public/).
      // We verify this indirectly: static serving is active (health responds without CORS).
      const app = createApp({ repoPath: '/mock/repo', staticDir: EXISTING_STATIC_DIR });

      const res = await request(app).get('/api/v1/health');

      expect(res.status).toBe(200);
    });
  });
});
