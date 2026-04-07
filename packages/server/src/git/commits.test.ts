import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimpleGit } from 'simple-git';
import type { CommitInfo, DiffFile } from '@git-reviewer/shared';
import { getCommitList, getCommitDiffText, getCommitChangedFiles } from './commits.js';

const EMPTY_TREE = '4b825dc642cb6eb9a060e54bf899d15f13a88e28';

const mockLog = vi.fn();
const mockDiff = vi.fn();
const mockRaw = vi.fn();

const mockGit = {
  log: mockLog,
  diff: mockDiff,
  raw: mockRaw,
} as unknown as SimpleGit;

describe('git/commits.ts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------------------
  // getCommitList
  // ---------------------------------------------------------------------------
  describe('getCommitList', () => {
    it('returns commits in oldest-first order', async () => {
      // simple-git returns newest-first — the function must reverse
      mockLog.mockResolvedValueOnce({
        all: [
          {
            hash: 'abc123def456abc123def456abc123def456abc1',
            message: 'Second commit',
            author_name: 'Alice',
            date: '2026-03-20T12:00:00Z',
          },
          {
            hash: '111aaabbbccc111aaabbbccc111aaabbbccc111a',
            message: 'First commit',
            author_name: 'Bob',
            date: '2026-03-19T10:00:00Z',
          },
        ],
      });

      const result = await getCommitList(mockGit, 'main', 'HEAD');

      expect(mockLog).toHaveBeenCalledWith({ from: 'main', to: 'HEAD' });

      const expected: CommitInfo[] = [
        {
          hash: '111aaabbbccc111aaabbbccc111aaabbbccc111a',
          shortHash: '111aaab',
          message: 'First commit',
          author: 'Bob',
          date: '2026-03-19T10:00:00Z',
        },
        {
          hash: 'abc123def456abc123def456abc123def456abc1',
          shortHash: 'abc123d',
          message: 'Second commit',
          author: 'Alice',
          date: '2026-03-20T12:00:00Z',
        },
      ];

      expect(result).toEqual(expected);
    });

    it('returns an empty array when there are no commits in the range', async () => {
      mockLog.mockResolvedValueOnce({ all: [] });

      const result = await getCommitList(mockGit, 'main', 'HEAD');

      expect(result).toEqual([]);
    });

    it('returns a single-element array when there is exactly one commit', async () => {
      mockLog.mockResolvedValueOnce({
        all: [
          {
            hash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
            message: 'Only commit',
            author_name: 'Charlie',
            date: '2026-04-01T08:00:00Z',
          },
        ],
      });

      const result = await getCommitList(mockGit, 'main', 'feature');

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        hash: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
        shortHash: 'deadbee',
        message: 'Only commit',
        author: 'Charlie',
        date: '2026-04-01T08:00:00Z',
      });
    });

    it('derives shortHash as the first 7 characters of the full hash', async () => {
      const fullHash = 'abcdefgh12345678abcdefgh12345678abcdef12';
      mockLog.mockResolvedValueOnce({
        all: [
          {
            hash: fullHash,
            message: 'Any commit',
            author_name: 'Dev',
            date: '2026-03-19T10:00:00Z',
          },
        ],
      });

      const [commit] = await getCommitList(mockGit, 'main', 'HEAD');

      expect(commit?.shortHash).toBe('abcdefg');
    });

    it('passes the base and head refs through to git.log', async () => {
      mockLog.mockResolvedValueOnce({ all: [] });

      await getCommitList(mockGit, 'abc123', 'def456');

      expect(mockLog).toHaveBeenCalledWith({ from: 'abc123', to: 'def456' });
    });
  });

  // ---------------------------------------------------------------------------
  // getCommitDiffText
  // ---------------------------------------------------------------------------
  describe('getCommitDiffText', () => {
    it('returns the diff text for a normal commit (with parent)', async () => {
      const diffText = 'diff --git a/src/foo.ts b/src/foo.ts\n+added line\n';
      mockDiff.mockResolvedValueOnce(diffText);

      const result = await getCommitDiffText(mockGit, 'abc123');

      expect(mockDiff).toHaveBeenCalledWith(['abc123^', 'abc123']);
      expect(result).toBe(diffText);
    });

    it('falls back to the empty-tree SHA when the commit has no parent (root commit)', async () => {
      // First call (parent diff) throws — simulates "unknown revision abc123^"
      mockDiff.mockRejectedValueOnce(new Error('unknown revision: abc123^'));
      const rootDiffText = 'diff --git a/src/init.ts b/src/init.ts\n+initial file\n';
      mockDiff.mockResolvedValueOnce(rootDiffText);

      const result = await getCommitDiffText(mockGit, 'abc123');

      expect(mockDiff).toHaveBeenCalledTimes(2);
      expect(mockDiff).toHaveBeenNthCalledWith(1, ['abc123^', 'abc123']);
      expect(mockDiff).toHaveBeenNthCalledWith(2, [EMPTY_TREE, 'abc123']);
      expect(result).toBe(rootDiffText);
    });

    it('returns an empty string when the commit has no changed files (normal commit)', async () => {
      mockDiff.mockResolvedValueOnce('');

      const result = await getCommitDiffText(mockGit, 'abc123');

      expect(result).toBe('');
    });

    it('returns an empty string when the root commit has no changed files', async () => {
      mockDiff.mockRejectedValueOnce(new Error('unknown revision'));
      mockDiff.mockResolvedValueOnce('');

      const result = await getCommitDiffText(mockGit, 'abc123');

      expect(result).toBe('');
    });

    it('propagates errors from the fallback diff call', async () => {
      mockDiff.mockRejectedValueOnce(new Error('no parent'));
      mockDiff.mockRejectedValueOnce(new Error('fatal: ambiguous argument'));

      await expect(getCommitDiffText(mockGit, 'abc123')).rejects.toThrow(
        'fatal: ambiguous argument',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // getCommitChangedFiles
  // ---------------------------------------------------------------------------
  describe('getCommitChangedFiles', () => {
    it('returns parsed changed files for a normal commit', async () => {
      const nameStatus = 'M\tsrc/foo.ts\nA\tsrc/bar.ts\nD\tsrc/old.ts\n';
      const numstat = '5\t2\tsrc/foo.ts\n10\t0\tsrc/bar.ts\n0\t8\tsrc/old.ts\n';

      mockRaw.mockResolvedValueOnce(nameStatus).mockResolvedValueOnce(numstat);

      const result = await getCommitChangedFiles(mockGit, 'abc123');

      expect(mockRaw).toHaveBeenCalledWith(['diff', '--name-status', '-M', 'abc123^', 'abc123']);
      expect(mockRaw).toHaveBeenCalledWith(['diff', '--numstat', '-M', 'abc123^', 'abc123']);

      const expected: DiffFile[] = [
        { path: 'src/foo.ts', status: 'modified', additions: 5, deletions: 2 },
        { path: 'src/bar.ts', status: 'added', additions: 10, deletions: 0 },
        { path: 'src/old.ts', status: 'deleted', additions: 0, deletions: 8 },
      ];

      expect(result).toEqual(expected);
    });

    it('falls back to empty-tree SHA for a root commit (Promise.all rejects)', async () => {
      // Promise.all fires both raw calls concurrently; both must have mock values.
      // The first rejects, causing Promise.all to reject and enter the catch block.
      // The second resolves (ignored by the failed Promise.all, but the mock is consumed).
      mockRaw
        .mockRejectedValueOnce(new Error('unknown revision: abc123^')) // call 1 (name-status) — fails
        .mockResolvedValueOnce('') // call 2 (numstat) — resolved but discarded
        // fallback Promise.all
        .mockResolvedValueOnce('A\tsrc/init.ts\n') // fallback name-status
        .mockResolvedValueOnce('20\t0\tsrc/init.ts\n'); // fallback numstat

      const result = await getCommitChangedFiles(mockGit, 'abc123');

      expect(mockRaw).toHaveBeenCalledWith(['diff', '--name-status', '-M', EMPTY_TREE, 'abc123']);
      expect(mockRaw).toHaveBeenCalledWith(['diff', '--numstat', '-M', EMPTY_TREE, 'abc123']);

      const expected: DiffFile[] = [
        { path: 'src/init.ts', status: 'added', additions: 20, deletions: 0 },
      ];

      expect(result).toEqual(expected);
    });

    it('includes renamed files with oldPath for a normal commit', async () => {
      const nameStatus = 'R90\tsrc/original.ts\tsrc/renamed.ts\n';
      const numstat = '3\t1\tsrc/renamed.ts\n';

      mockRaw.mockResolvedValueOnce(nameStatus).mockResolvedValueOnce(numstat);

      const result = await getCommitChangedFiles(mockGit, 'abc123');

      expect(result).toEqual([
        {
          path: 'src/renamed.ts',
          status: 'renamed',
          additions: 3,
          deletions: 1,
          oldPath: 'src/original.ts',
        },
      ]);
    });

    it('returns an empty array when the commit has no changed files', async () => {
      mockRaw.mockResolvedValueOnce('').mockResolvedValueOnce('');

      const result = await getCommitChangedFiles(mockGit, 'abc123');

      expect(result).toEqual([]);
    });

    it('returns an empty array when a root commit has no changed files', async () => {
      // Same Promise.all concurrency: first call rejects, second resolves (discarded),
      // then fallback returns empty strings for both.
      mockRaw
        .mockRejectedValueOnce(new Error('unknown revision')) // name-status fails
        .mockResolvedValueOnce('') // numstat resolves but is discarded
        .mockResolvedValueOnce('') // fallback name-status
        .mockResolvedValueOnce(''); // fallback numstat

      const result = await getCommitChangedFiles(mockGit, 'abc123');

      expect(result).toEqual([]);
    });

    it('propagates errors from the fallback raw calls', async () => {
      // First Promise.all: name-status rejects, numstat resolves (discarded)
      // Fallback Promise.all: name-status rejects → propagates
      mockRaw
        .mockRejectedValueOnce(new Error('no parent')) // name-status: triggers catch
        .mockResolvedValueOnce('') // numstat: discarded by Promise.all
        .mockRejectedValueOnce(new Error('fatal: bad object')); // fallback name-status

      await expect(getCommitChangedFiles(mockGit, 'abc123')).rejects.toThrow('fatal: bad object');
    });
  });
});
