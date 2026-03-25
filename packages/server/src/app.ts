import cors from 'cors';
import express, { type Express } from 'express';
import path from 'path';
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

export function createApp({ repoPath, staticDir }: CreateAppOptions): Express {
  const git = createGitClient(repoPath);
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api', createReviewRouter(git));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  if (staticDir) {
    const resolvedStaticDir = path.resolve(staticDir);
    app.use(express.static(resolvedStaticDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(resolvedStaticDir, 'index.html'));
    });
  }

  return app;
}
