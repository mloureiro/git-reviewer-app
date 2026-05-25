import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimpleGit } from 'simple-git';
import {
  getDiffText,
  getUncommittedDiffText,
  getChangedFiles,
  getUncommittedChangedFiles,
  smartMergeBase,
} from './diff.js';

const mockDiff = vi.fn();
const mockRaw = vi.fn();

const mockGit = {
  diff: mockDiff,
  raw: mockRaw,
} as unknown as SimpleGit;

const MERGE_BASE_SHA = 'abc1234def5678';

/**
 * Configure `mockRaw` so smart-merge-base resolution succeeds: no remotes, the
 * local base resolves to MERGE_BASE_SHA, the remote counterpart errors. Tests
 * that need extra `raw` calls (e.g. `diff --name-status`) should set those up
 * with mockResolvedValueOnce *after* calling this — those are dispatched first
 * by argument matching, with everything else falling through to the queue.
 */
function setupMergeBaseMock(sha = MERGE_BASE_SHA) {
  mockRaw.mockImplementation((args: string[]) => {
    if (args[0] === 'remote') return Promise.resolve('');
    if (args[0] === 'config') return Promise.reject(new Error('no config'));
    if (args[0] === 'merge-base') {
      // First candidate (local) resolves; counterpart (origin/<base>) errors.
      if (args[1]?.startsWith('origin/')) return Promise.reject(new Error('no such ref'));
      return Promise.resolve(`${sha}\n`);
    }
    return Promise.resolve('');
  });
}

describe('git/diff.ts', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('getDiffText', () => {
    it('returns diff text between merge-base and head', async () => {
      const expectedDiff =
        'diff --git a/src/foo.ts b/src/foo.ts\n--- a/src/foo.ts\n+++ b/src/foo.ts\n';
      setupMergeBaseMock();
      mockDiff.mockResolvedValueOnce(expectedDiff);

      const result = await getDiffText(mockGit, 'main', 'HEAD');

      expect(mockDiff).toHaveBeenCalledWith([`${MERGE_BASE_SHA}..HEAD`]);
      expect(result).toBe(expectedDiff);
    });

    it('returns an empty string when there is no diff between merge-base and head', async () => {
      setupMergeBaseMock();
      mockDiff.mockResolvedValueOnce('');

      const result = await getDiffText(mockGit, 'main', 'HEAD');

      expect(mockDiff).toHaveBeenCalledWith([`${MERGE_BASE_SHA}..HEAD`]);
      expect(result).toBe('');
    });
  });

  describe('getUncommittedDiffText', () => {
    it('returns diff against HEAD in a single pass', async () => {
      const headDiff = 'diff --git a/file.ts b/file.ts\n--- a/file.ts\n+++ b/file.ts\n+changed\n';
      mockDiff.mockResolvedValueOnce(headDiff);

      const result = await getUncommittedDiffText(mockGit);

      expect(mockDiff).toHaveBeenCalledOnce();
      expect(mockDiff).toHaveBeenCalledWith(['HEAD']);
      expect(result).toBe(headDiff);
    });

    it('returns empty string when there are no uncommitted changes', async () => {
      mockDiff.mockResolvedValueOnce('');

      const result = await getUncommittedDiffText(mockGit);

      expect(mockDiff).toHaveBeenCalledOnce();
      expect(mockDiff).toHaveBeenCalledWith(['HEAD']);
      expect(result).toBe('');
    });
  });

  describe('getChangedFiles', () => {
    it('returns a parsed list of changed files with accurate status and stats', async () => {
      const nameStatus =
        'M\tsrc/foo.ts\nA\tsrc/bar.ts\nD\tsrc/old.ts\nR90\tsrc/orig.ts\tsrc/renamed.ts\n';
      const numstat =
        '5\t2\tsrc/foo.ts\n10\t0\tsrc/bar.ts\n0\t8\tsrc/old.ts\n3\t1\tsrc/renamed.ts\n';

      mockRaw.mockImplementation((args: string[]) => {
        if (args[0] === 'remote') return Promise.resolve('');
        if (args[0] === 'config') return Promise.reject(new Error('no config'));
        if (args[0] === 'merge-base') {
          if (args[1]?.startsWith('origin/')) return Promise.reject(new Error('no such ref'));
          return Promise.resolve(`${MERGE_BASE_SHA}\n`);
        }
        if (args[0] === 'diff' && args[1] === '--name-status') return Promise.resolve(nameStatus);
        if (args[0] === 'diff' && args[1] === '--numstat') return Promise.resolve(numstat);
        return Promise.resolve('');
      });

      const result = await getChangedFiles(mockGit, 'main', 'HEAD');

      const range = `${MERGE_BASE_SHA}..HEAD`;
      expect(mockRaw).toHaveBeenCalledWith(['diff', '--name-status', '-M', range]);
      expect(mockRaw).toHaveBeenCalledWith(['diff', '--numstat', '-M', range]);
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
      mockRaw.mockImplementation((args: string[]) => {
        if (args[0] === 'remote') return Promise.resolve('');
        if (args[0] === 'config') return Promise.reject(new Error('no config'));
        if (args[0] === 'merge-base') {
          if (args[1]?.startsWith('origin/')) return Promise.reject(new Error('no such ref'));
          return Promise.resolve(`${MERGE_BASE_SHA}\n`);
        }
        return Promise.resolve('');
      });

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

  describe('smartMergeBase', () => {
    it('returns the merge-base of the only candidate when remote counterpart is missing', async () => {
      setupMergeBaseMock('local-mb-sha');

      const result = await smartMergeBase(mockGit, 'main', 'HEAD');

      expect(result).toBe('local-mb-sha');
    });

    it('picks the merge-base closer to head when local base is behind its remote counterpart', async () => {
      // local "main" merge-base lands on stale-mb, but origin/main is ahead and
      // its merge-base with head lands on fresh-mb — which descends from stale-mb.
      const STALE = 'stale-mb-sha';
      const FRESH = 'fresh-mb-sha';

      mockRaw.mockImplementation((args: string[]) => {
        if (args[0] === 'remote') return Promise.resolve('origin\n');
        if (args[0] === 'config') return Promise.reject(new Error('no upstream config'));
        if (args[0] === 'merge-base') {
          // merge-base(<base>, HEAD)
          if (args[1] === 'main' && args[2] === 'HEAD') return Promise.resolve(`${STALE}\n`);
          if (args[1] === 'origin/main' && args[2] === 'HEAD') return Promise.resolve(`${FRESH}\n`);
          // Reduce step: merge-base(STALE, FRESH) — STALE is ancestor of FRESH
          if ((args[1] === STALE && args[2] === FRESH) || (args[1] === FRESH && args[2] === STALE))
            return Promise.resolve(`${STALE}\n`);
        }
        return Promise.reject(new Error(`unexpected raw call: ${args.join(' ')}`));
      });

      const result = await smartMergeBase(mockGit, 'main', 'HEAD');

      expect(result).toBe(FRESH);
    });

    it('strips the remote prefix when base is already a remote-tracking ref', async () => {
      const STALE = 'stale-mb';
      const FRESH = 'fresh-mb';

      mockRaw.mockImplementation((args: string[]) => {
        if (args[0] === 'remote') return Promise.resolve('origin\n');
        if (args[0] === 'config') return Promise.reject(new Error('no upstream'));
        if (args[0] === 'merge-base') {
          // Base is "origin/main"; counterpart should be "main"
          if (args[1] === 'origin/main' && args[2] === 'HEAD') return Promise.resolve(`${FRESH}\n`);
          if (args[1] === 'main' && args[2] === 'HEAD') return Promise.resolve(`${STALE}\n`);
          if ((args[1] === STALE && args[2] === FRESH) || (args[1] === FRESH && args[2] === STALE))
            return Promise.resolve(`${STALE}\n`);
        }
        return Promise.reject(new Error(`unexpected raw call: ${args.join(' ')}`));
      });

      const result = await smartMergeBase(mockGit, 'origin/main', 'HEAD');

      expect(result).toBe(FRESH);
    });

    it('uses the configured upstream remote for the counterpart when available', async () => {
      mockRaw.mockImplementation((args: string[]) => {
        if (args[0] === 'remote') return Promise.resolve('origin\nupstream\n');
        if (args[0] === 'config' && args[1] === 'branch.main.remote')
          return Promise.resolve('upstream\n');
        if (args[0] === 'merge-base' && args[1] === 'upstream/main')
          return Promise.resolve('upstream-mb\n');
        if (args[0] === 'merge-base' && args[1] === 'main') return Promise.resolve('local-mb\n');
        if (args[0] === 'merge-base') return Promise.resolve('local-mb\n');
        return Promise.reject(new Error(`unexpected: ${args.join(' ')}`));
      });

      await smartMergeBase(mockGit, 'main', 'HEAD');

      // The upstream counterpart should be queried
      expect(mockRaw).toHaveBeenCalledWith(['merge-base', 'upstream/main', 'HEAD']);
    });

    it('throws when no candidate has a merge-base with head', async () => {
      mockRaw.mockImplementation((args: string[]) => {
        if (args[0] === 'remote') return Promise.resolve('');
        if (args[0] === 'config') return Promise.reject(new Error('no'));
        if (args[0] === 'merge-base') return Promise.reject(new Error('no merge-base'));
        return Promise.resolve('');
      });

      await expect(smartMergeBase(mockGit, 'main', 'HEAD')).rejects.toThrow(/Failed to find/);
    });
  });
});
