import { EventEmitter } from 'node:events';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimpleGit } from 'simple-git';
import type { ReviewData } from '@git-reviewer/shared';
import { readReviewNote, writeReviewNote, listReviewNotes, removeReviewNote } from './notes.js';

vi.mock('node:child_process', () => ({ spawn: vi.fn() }));

import { spawn } from 'node:child_process';

const mockSpawn = vi.mocked(spawn);

/** Creates a fake ChildProcess-like EventEmitter that resolves with exit code 0. */
function makeFakeChild(exitCode = 0) {
  const child = new EventEmitter() as ReturnType<typeof spawn>;
  const stdinMock = { end: vi.fn() };
  const stderrMock = new EventEmitter();
  Object.assign(child, { stdin: stdinMock, stderr: stderrMock, stdout: new EventEmitter() });
  setTimeout(() => child.emit('close', exitCode), 0);
  return child;
}

const mockRaw = vi.fn();
const mockRevparse = vi.fn();

const mockGit = {
  raw: mockRaw,
  revparse: mockRevparse,
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
      // readReviewNote internally → no note
      mockRaw.mockRejectedValueOnce(new Error('error: no note found'));
      mockRevparse.mockResolvedValueOnce('/repo/path\n');
      mockSpawn.mockReturnValueOnce(makeFakeChild(0));

      await writeReviewNote(mockGit, COMMIT_SHA, sampleReviewData);

      expect(mockSpawn).toHaveBeenCalledOnce();
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['notes', '--ref', 'git-reviewer', 'add', '-F', '-', COMMIT_SHA],
        { cwd: '/repo/path', stdio: ['pipe', 'ignore', 'pipe'] },
      );
    });

    it('uses add with -f flag when an existing note is present', async () => {
      // readReviewNote internally → returns existing data
      mockRaw.mockResolvedValueOnce(JSON.stringify(sampleReviewData));
      mockRevparse.mockResolvedValueOnce('/repo/path\n');
      mockSpawn.mockReturnValueOnce(makeFakeChild(0));

      await writeReviewNote(mockGit, COMMIT_SHA, sampleReviewData);

      expect(mockSpawn).toHaveBeenCalledOnce();
      expect(mockSpawn).toHaveBeenCalledWith(
        'git',
        ['notes', '--ref', 'git-reviewer', 'add', '-f', '-F', '-', COMMIT_SHA],
        { cwd: '/repo/path', stdio: ['pipe', 'ignore', 'pipe'] },
      );
    });

    it('writes the JSON content to stdin', async () => {
      mockRaw.mockRejectedValueOnce(new Error('error: no note found'));
      mockRevparse.mockResolvedValueOnce('/repo/path\n');
      const fakeChild = makeFakeChild(0);
      mockSpawn.mockReturnValueOnce(fakeChild);

      await writeReviewNote(mockGit, COMMIT_SHA, sampleReviewData);

      expect(fakeChild.stdin.end).toHaveBeenCalledWith(
        JSON.stringify(sampleReviewData, null, 2),
        'utf8',
      );
    });

    it('rejects when git exits with a non-zero code', async () => {
      mockRaw.mockRejectedValueOnce(new Error('error: no note found'));
      mockRevparse.mockResolvedValueOnce('/repo/path\n');
      mockSpawn.mockReturnValueOnce(makeFakeChild(1));

      await expect(writeReviewNote(mockGit, COMMIT_SHA, sampleReviewData)).rejects.toThrow(
        'git notes failed',
      );
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
