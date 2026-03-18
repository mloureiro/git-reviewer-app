import simpleGit, { type SimpleGit } from 'simple-git';

export function createGitClient(repoPath: string): SimpleGit {
  return simpleGit(repoPath);
}

export async function getDiffText(git: SimpleGit, base: string, head: string): Promise<string> {
  return git.diff([`${base}...${head}`]);
}

export async function getUncommittedDiffText(git: SimpleGit): Promise<string> {
  const staged = await git.diff(['--cached']);
  const unstaged = await git.diff();
  return [staged, unstaged].filter(Boolean).join('\n');
}

export async function getChangedFiles(
  git: SimpleGit,
  base: string,
  head: string,
): Promise<{ path: string; status: string }[]> {
  const summary = await git.diffSummary([`${base}...${head}`]);
  return summary.files.map(({ file, binary }) => ({
    path: file,
    status: binary ? 'modified' : 'modified', // TODO: detect add/delete/rename from diff summary
  }));
}
