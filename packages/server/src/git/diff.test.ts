import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimpleGit } from 'simple-git';
import { getDiffText, getUncommittedDiffText, getChangedFiles } from './diff.js';

const mockDiff = vi.fn();
const mockDiffSummary = vi.fn();

const mockGit = {
  diff: mockDiff,
  diffSummary: mockDiffSummary,
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
    it('returns a parsed list of changed files with their status', async () => {
      mockDiffSummary.mockResolvedValueOnce({
        files: [
          { file: 'src/foo.ts', binary: false },
          { file: 'assets/image.png', binary: true },
        ],
      });

      const result = await getChangedFiles(mockGit, 'main', 'HEAD');

      expect(mockDiffSummary).toHaveBeenCalledWith(['main...HEAD']);
      expect(result).toEqual([
        { path: 'src/foo.ts', status: 'modified' },
        { path: 'assets/image.png', status: 'modified' },
      ]);
    });

    it('returns an empty array when there are no changed files', async () => {
      mockDiffSummary.mockResolvedValueOnce({ files: [] });

      const result = await getChangedFiles(mockGit, 'main', 'HEAD');

      expect(mockDiffSummary).toHaveBeenCalledWith(['main...HEAD']);
      expect(result).toEqual([]);
    });
  });
});
