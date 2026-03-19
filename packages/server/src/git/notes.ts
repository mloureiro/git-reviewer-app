import type { SimpleGit } from 'simple-git';
import type { ReviewData } from '@git-reviewer/shared';

const NOTES_REF = 'git-reviewer';

export async function readReviewNote(
  git: SimpleGit,
  commitSha: string,
): Promise<ReviewData | null> {
  try {
    const raw = await git.raw(['notes', '--ref', NOTES_REF, 'show', commitSha]);
    return JSON.parse(raw) as ReviewData;
  } catch {
    return null;
  }
}

export async function writeReviewNote(
  git: SimpleGit,
  commitSha: string,
  data: ReviewData,
): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const existing = await readReviewNote(git, commitSha);

  if (existing) {
    await git.raw(['notes', '--ref', NOTES_REF, 'add', '-f', '-m', json, commitSha]);
  } else {
    await git.raw(['notes', '--ref', NOTES_REF, 'add', '-m', json, commitSha]);
  }
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
