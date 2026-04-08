import cors from 'cors';
import express, {
  type ErrorRequestHandler,
  type Express,
  type Request,
  type Response,
} from 'express';
import helmet from 'helmet';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createMultiRepoReviewRouter } from './routes/review.js';
import { RepoRegistry } from './git/repo-registry.js';

export { createGitClient } from './git/diff.js';
export { validateRefs, createAutoSession, resolveRefName } from './git/session.js';
export { RepoRegistry } from './git/repo-registry.js';
export { createReviewRouter, createMultiRepoReviewRouter } from './routes/review.js';
export type {
  ValidateRefsOptions,
  ValidateRefsResult,
  CreateAutoSessionOptions,
} from './git/session.js';

export interface CreateAppOptions {
  repoPath: string;
  staticDir?: string;
}

/**
 * Resolve the directory to serve static client assets from.
 *
 * Priority:
 * 1. Explicitly provided `staticDir` option (callers such as the CLI).
 * 2. Auto-detected `public/` directory adjacent to the compiled server
 *    bundle (i.e. `packages/server/public/` after a production build).
 *
 * Returns `undefined` when neither location exists, which disables static
 * serving and the SPA fallback so dev mode is not affected.
 */
function resolveStaticDir(staticDir: string | undefined): string | undefined {
  if (staticDir) {
    return path.resolve(staticDir);
  }

  // Auto-detect: look for a `public/` directory next to the compiled output.
  // In production the compiled file lives at packages/server/dist/app.js, so
  // the public dir is one level up at packages/server/public/.
  const serverDir = path.dirname(fileURLToPath(import.meta.url));
  const candidate = path.resolve(serverDir, '..', 'public');

  return existsSync(candidate) ? candidate : undefined;
}

/**
 * Global Express error-handling middleware.
 *
 * Must have exactly 4 parameters so Express recognises it as an error handler.
 * Registered last in the middleware chain so it catches errors forwarded by any
 * route or middleware above it (e.g. malformed JSON from `express.json()`).
 *
 * In development (`NODE_ENV !== 'production'`) the original error message is
 * included in the response to aid debugging.  In production only a generic
 * message is returned to avoid leaking implementation details.
 */
const globalErrorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  console.error('Unhandled server error:', err);

  const isDev = process.env['NODE_ENV'] !== 'production';
  const message = isDev && err instanceof Error ? err.message : 'Internal server error';

  const status = typeof err.status === 'number' ? err.status : 500;
  res.status(status).json({ error: message });
};

export function createApp({ repoPath, staticDir }: CreateAppOptions): Express {
  const registry = new RepoRegistry();
  registry.registerRepo(repoPath);

  const app = express();

  const resolvedStaticDir = resolveStaticDir(staticDir);

  // Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
  app.use(helmet());

  // In development the client runs on a separate Vite dev server (different
  // origin), so CORS headers are required.  In production the server serves
  // the built client directly (same origin), so CORS is unnecessary.
  if (!resolvedStaticDir) {
    app.use(cors());
  }

  app.use(express.json());

  app.use('/api/v1', createMultiRepoReviewRouter(registry));

  app.get('/api/v1/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Backward-compatibility redirects: forward old /api/* requests to /api/v1/*.
  // The regex excludes /api/v1/* paths so they are not double-redirected.
  app.use(/^\/api(?!\/v\d)/, (req: Request, res: Response) => {
    res.redirect(308, `/api/v1${req.url}`);
  });

  if (resolvedStaticDir) {
    app.use(express.static(resolvedStaticDir));

    // Catch-all SPA fallback: serve index.html for any non-API GET request so
    // that client-side routing (react-router) works on direct URL access or
    // page refresh.  API routes are already handled above and will never reach
    // this handler.
    app.get('*path', (req: Request, res: Response) => {
      if (req.path.startsWith('/api/')) {
        res.status(404).json({ error: 'Not found' });
        return;
      }
      res.sendFile(path.join(resolvedStaticDir, 'index.html'));
    });
  }

  // Global error handler — must be registered last, after all routes and
  // middleware, so that errors forwarded via next(err) reach it.
  app.use(globalErrorHandler);

  return app;
}
