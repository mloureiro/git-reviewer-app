import { spawn } from 'node:child_process';
import type { SimpleGit } from 'simple-git';
import type { ReviewData } from '@git-reviewer/shared';
import { validateReviewData } from '@git-reviewer/shared';

const NOTES_REF = 'git-reviewer';

export async function readReviewNote(
  git: SimpleGit,
  commitSha: string,
): Promise<ReviewData | null> {
  try {
    const raw = await git.raw(['notes', '--ref', NOTES_REF, 'show', commitSha]);
    const parsed: unknown = JSON.parse(raw);
    return validateReviewData(parsed);
  } catch {
    return null;
  }
}

function gitNotesAddFromStdin(repoPath: string, args: string[], input: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd: repoPath, stdio: ['pipe', 'ignore', 'pipe'] });

    let stderrOutput = '';
    child.stderr.on('data', (chunk: Buffer) => {
      stderrOutput += chunk.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`git notes failed (exit ${String(code)}): ${stderrOutput.trim()}`));
      }
    });

    child.on('error', reject);
    child.stdin.end(input, 'utf8');
  });
}

export async function writeReviewNote(
  git: SimpleGit,
  commitSha: string,
  data: ReviewData,
): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const [existing, repoPath] = await Promise.all([
    readReviewNote(git, commitSha),
    git.revparse(['--show-toplevel']),
  ]);

  const args = existing
    ? ['notes', '--ref', NOTES_REF, 'add', '-f', '-F', '-', commitSha]
    : ['notes', '--ref', NOTES_REF, 'add', '-F', '-', commitSha];

  await gitNotesAddFromStdin(repoPath.trim(), args, json);
}

export async function listReviewNotes(
  git: SimpleGit,
): Promise<{ noteHash: string; commitHash: string }[]> {
  try {
    const raw = await git.raw(['notes', '--ref', NOTES_REF, 'list']);
    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [noteHash = '', commitHash = ''] = line.split(' ');
        return { noteHash, commitHash };
      });
  } catch {
    return [];
  }
}

export async function removeReviewNote(git: SimpleGit, commitSha: string): Promise<void> {
  try {
    await git.raw(['notes', '--ref', NOTES_REF, 'remove', commitSha]);
  } catch {
    // Note might not exist, that's fine
  }
}
