import cors from 'cors';
import express, { type Express } from 'express';
import type { SimpleGit } from 'simple-git';
import { createReviewRouter } from './routes/review.js';

export function createApp(git: SimpleGit): Express {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use('/api', createReviewRouter(git));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
