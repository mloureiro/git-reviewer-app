import cors from 'cors';
import express, { type Express } from 'express';
import { createGitClient } from './git/diff.js';
import { createReviewRouter } from './routes/review.js';

export interface CreateAppOptions {
  repoPath: string;
  staticDir?: string;
}

export function createApp({ repoPath, staticDir: _staticDir }: CreateAppOptions): Express {
  const git = createGitClient(repoPath);
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use('/api', createReviewRouter(git));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
