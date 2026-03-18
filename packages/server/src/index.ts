import cors from 'cors';
import express from 'express';
import { createGitClient } from './git/diff.js';
import { createReviewRouter } from './routes/review.js';

const PORT = Number(process.env.PORT ?? 3847);
const REPO_PATH = process.env.REPO_PATH ?? process.cwd();

const app = express();
app.use(cors());
app.use(express.json());

const git = createGitClient(REPO_PATH);

app.use('/api', createReviewRouter(git));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', repoPath: REPO_PATH });
});

app.listen(PORT, () => {
  console.log(`git-reviewer server running at http://localhost:${PORT}`);
  console.log(`Reviewing repo: ${REPO_PATH}`);
});
