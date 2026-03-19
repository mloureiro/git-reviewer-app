import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimpleGit } from 'simple-git';
import {
  getDiffText,
  getUncommittedDiffText,
  getChangedFiles,
  getUncommittedChangedFiles,
} from './diff.js';

const mockDiff = vi.fn();
const mockRaw = vi.fn();

const mockGit = {
  diff: mockDiff,
  raw: mockRaw,
} as unknown as SimpleGit;

describe('git/diff.ts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getDiffText', () => {
    it('returns diff text between two refs', async () => {
      const expectedDiff =
        'diff --git a/src/foo.ts b/src/foo.ts\n--- a/src/foo.ts\n+++ b/src/foo.ts\n';
      mockDiff.mockResolvedValueOnce(expectedDiff);

      const result = await getDiffText(mockGit, 'main', 'HEAD');

      expect(mockDiff).toHaveBeenCalledWith(['main...HEAD']);
      expect(result).toBe(expectedDiff);
    });

    it('returns an empty string when there is no diff between the two refs', async () => {
      mockDiff.mockResolvedValueOnce('');

      const result = await getDiffText(mockGit, 'main', 'HEAD');

      expect(mockDiff).toHaveBeenCalledWith(['main...HEAD']);
      expect(result).toBe('');
    });
  });

  describe('getUncommittedDiffText', () => {
    it('returns combined staged and unstaged diff text', async () => {
      const stagedDiff = 'diff --git a/staged.ts b/staged.ts\n+staged change\n';
      const unstagedDiff = 'diff --git a/unstaged.ts b/unstaged.ts\n+unstaged change\n';
      mockDiff.mockResolvedValueOnce(stagedDiff).mockResolvedValueOnce(unstagedDiff);

      const result = await getUncommittedDiffText(mockGit);

      expect(mockDiff).toHaveBeenCalledTimes(2);
      expect(mockDiff).toHaveBeenNthCalledWith(1, ['--cached']);
      expect(mockDiff).toHaveBeenNthCalledWith(2);
      expect(result).toBe(`${stagedDiff}\n${unstagedDiff}`);
    });
  });

  describe('getChangedFiles', () => {
    it('returns a parsed list of changed files with accurate status and stats', async () => {
      // --name-status output
      const nameStatus =
        'M\tsrc/foo.ts\nA\tsrc/bar.ts\nD\tsrc/old.ts\nR90\tsrc/orig.ts\tsrc/renamed.ts\n';
      // --numstat output (same order)
      const numstat =
        '5\t2\tsrc/foo.ts\n10\t0\tsrc/bar.ts\n0\t8\tsrc/old.ts\n3\t1\tsrc/renamed.ts\n';

      mockRaw.mockResolvedValueOnce(nameStatus).mockResolvedValueOnce(numstat);

      const result = await getChangedFiles(mockGit, 'main', 'HEAD');

      expect(mockRaw).toHaveBeenCalledTimes(2);
      expect(mockRaw).toHaveBeenCalledWith(['diff', '--name-status', '-M', 'main...HEAD']);
      expect(mockRaw).toHaveBeenCalledWith(['diff', '--numstat', '-M', 'main...HEAD']);
      expect(result).toEqual([
        { path: 'src/foo.ts', status: 'modified', additions: 5, deletions: 2 },
        { path: 'src/bar.ts', status: 'added', additions: 10, deletions: 0 },
        { path: 'src/old.ts', status: 'deleted', additions: 0, deletions: 8 },
        {
          path: 'src/renamed.ts',
          status: 'renamed',
          additions: 3,
          deletions: 1,
          oldPath: 'src/orig.ts',
        },
      ]);
    });

    it('returns an empty array when there are no changed files', async () => {
      mockRaw.mockResolvedValueOnce('').mockResolvedValueOnce('');

      const result = await getChangedFiles(mockGit, 'main', 'HEAD');

      expect(result).toEqual([]);
    });
  });

  describe('getUncommittedChangedFiles', () => {
    it('returns merged staged and unstaged changed files, staged taking precedence', async () => {
      const stagedNameStatus = 'M\tsrc/staged.ts\n';
      const stagedNumstat = '3\t1\tsrc/staged.ts\n';
      const unstagedNameStatus = 'A\tsrc/unstaged.ts\nM\tsrc/staged.ts\n';
      const unstagedNumstat = '7\t0\tsrc/unstaged.ts\n1\t1\tsrc/staged.ts\n';

      mockRaw
        .mockResolvedValueOnce(stagedNameStatus)
        .mockResolvedValueOnce(stagedNumstat)
        .mockResolvedValueOnce(unstagedNameStatus)
        .mockResolvedValueOnce(unstagedNumstat);

      const result = await getUncommittedChangedFiles(mockGit);

      expect(mockRaw).toHaveBeenCalledTimes(4);
      expect(mockRaw).toHaveBeenCalledWith(['diff', '--name-status', '--cached', '-M']);
      expect(mockRaw).toHaveBeenCalledWith(['diff', '--numstat', '--cached', '-M']);
      expect(mockRaw).toHaveBeenCalledWith(['diff', '--name-status', '-M']);
      expect(mockRaw).toHaveBeenCalledWith(['diff', '--numstat', '-M']);
      // staged.ts from staged (precedence), unstaged.ts from unstaged
      expect(result).toEqual([
        { path: 'src/staged.ts', status: 'modified', additions: 3, deletions: 1 },
        { path: 'src/unstaged.ts', status: 'added', additions: 7, deletions: 0 },
      ]);
    });

    it('returns an empty array when there are no uncommitted changes', async () => {
      mockRaw
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('')
        .mockResolvedValueOnce('');

      const result = await getUncommittedChangedFiles(mockGit);

      expect(result).toEqual([]);
    });
  });
});
