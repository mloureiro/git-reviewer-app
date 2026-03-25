import cors from 'cors';
import express, { type Express, type Request, type Response } from 'express';
import { existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createGitClient } from './git/diff.js';
import { createReviewRouter } from './routes/review.js';

export { createGitClient } from './git/diff.js';
export { validateRefs, createAutoSession } from './git/session.js';
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

export function createApp({ repoPath, staticDir }: CreateAppOptions): Express {
  const git = createGitClient(repoPath);
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api', createReviewRouter(git));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const resolvedStaticDir = resolveStaticDir(staticDir);

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

  return app;
}
