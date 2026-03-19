import { createApp } from './app.js';
import { createGitClient } from './git/diff.js';

const PORT = Number(process.env.PORT ?? 3847);
const REPO_PATH = process.env.REPO_PATH ?? process.cwd();

const git = createGitClient(REPO_PATH);
const app = createApp(git);

app.listen(PORT, () => {
  console.log(`git-reviewer server running at http://localhost:${PORT}`);
  console.log(`Reviewing repo: ${REPO_PATH}`);
});
