import { createApp } from './app.js';

const PORT = Number(process.env.PORT ?? 3847);
const REPO_PATH = process.env.REPO_PATH ?? process.cwd();

const app = createApp({ repoPath: REPO_PATH });

app.listen(PORT, () => {
  console.log(`git-reviewer server running at http://localhost:${PORT}`);
  console.log(`Reviewing repo: ${REPO_PATH}`);
});
