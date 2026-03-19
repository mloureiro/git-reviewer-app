import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimpleGit } from 'simple-git';
import type { ReviewData } from '@git-reviewer/shared';
import { readReviewNote, writeReviewNote, listReviewNotes, removeReviewNote } from './notes.js';

const mockRaw = vi.fn();

const mockGit = {
  raw: mockRaw,
} as unknown as SimpleGit;

const COMMIT_SHA = 'abc123def456';

const sampleReviewData: ReviewData = {
  version: 1,
  session: {
    id: 'session-uuid-1',
    title: 'Test Review',
    baseRef: 'main',
    headRef: 'HEAD',
    baseCommit: 'base123',
    headCommit: COMMIT_SHA,
    status: 'pending',
    createdAt: '2026-03-19T10:00:00Z',
    updatedAt: '2026-03-19T10:00:00Z',
  },
  comments: [],
};

describe('git/notes.ts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('readReviewNote', () => {
    it('returns parsed ReviewData when a note exists for the commit', async () => {
      mockRaw.mockResolvedValueOnce(JSON.stringify(sampleReviewData));

      const result = await readReviewNote(mockGit, COMMIT_SHA);

      expect(mockRaw).toHaveBeenCalledWith(['notes', '--ref', 'git-reviewer', 'show', COMMIT_SHA]);
      expect(result).toEqual(sampleReviewData);
    });

    it('returns null when no note exists for the commit', async () => {
      mockRaw.mockRejectedValueOnce(new Error('error: no note found for object abc123def456.'));

      const result = await readReviewNote(mockGit, COMMIT_SHA);

      expect(result).toBeNull();
    });
  });

  describe('writeReviewNote', () => {
    it('uses add without -f flag when no existing note is present', async () => {
      // First call: readReviewNote internally → no note
      mockRaw.mockRejectedValueOnce(new Error('error: no note found'));
      // Second call: the actual write
      mockRaw.mockResolvedValueOnce('');

      await writeReviewNote(mockGit, COMMIT_SHA, sampleReviewData);

      expect(mockRaw).toHaveBeenCalledTimes(2);
      expect(mockRaw).toHaveBeenNthCalledWith(2, [
        'notes',
        '--ref',
        'git-reviewer',
        'add',
        '-m',
        JSON.stringify(sampleReviewData, null, 2),
        COMMIT_SHA,
      ]);
    });

    it('uses add with -f flag when an existing note is present', async () => {
      // First call: readReviewNote internally → returns existing data
      mockRaw.mockResolvedValueOnce(JSON.stringify(sampleReviewData));
      // Second call: the actual write
      mockRaw.mockResolvedValueOnce('');

      await writeReviewNote(mockGit, COMMIT_SHA, sampleReviewData);

      expect(mockRaw).toHaveBeenCalledTimes(2);
      expect(mockRaw).toHaveBeenNthCalledWith(2, [
        'notes',
        '--ref',
        'git-reviewer',
        'add',
        '-f',
        '-m',
        JSON.stringify(sampleReviewData, null, 2),
        COMMIT_SHA,
      ]);
    });
  });

  describe('listReviewNotes', () => {
    it('returns parsed note/commit hash pairs when notes exist', async () => {
      mockRaw.mockResolvedValueOnce(
        'noteHash1 commitHash1\nnoteHash2 commitHash2\nnoteHash3 commitHash3\n',
      );

      const result = await listReviewNotes(mockGit);

      expect(mockRaw).toHaveBeenCalledWith(['notes', '--ref', 'git-reviewer', 'list']);
      expect(result).toEqual([
        { noteHash: 'noteHash1', commitHash: 'commitHash1' },
        { noteHash: 'noteHash2', commitHash: 'commitHash2' },
        { noteHash: 'noteHash3', commitHash: 'commitHash3' },
      ]);
    });

    it('returns an empty array when no notes exist', async () => {
      mockRaw.mockRejectedValueOnce(new Error('error: No note found'));

      const result = await listReviewNotes(mockGit);

      expect(result).toEqual([]);
    });
  });

  describe('removeReviewNote', () => {
    it('calls git notes remove with the correct commit sha', async () => {
      mockRaw.mockResolvedValueOnce('');

      await removeReviewNote(mockGit, COMMIT_SHA);

      expect(mockRaw).toHaveBeenCalledWith([
        'notes',
        '--ref',
        'git-reviewer',
        'remove',
        COMMIT_SHA,
      ]);
    });
  });

  describe('error handling', () => {
    it('does not throw when git raw fails during removeReviewNote', async () => {
      mockRaw.mockRejectedValueOnce(new Error('fatal: git command failed'));

      await expect(removeReviewNote(mockGit, COMMIT_SHA)).resolves.toBeUndefined();
    });
  });
});
