/**
 * Tests that verify per-session write-lock behaviour in session-service.ts.
 *
 * Strategy: mock `readReviewNote` / `writeReviewNote` at the git/notes layer so
 * we can control timing precisely. We launch two concurrent service calls and
 * check that the second call sees the state written by the first call (i.e. the
 * read-modify-write is serialised, not interleaved).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimpleGit } from 'simple-git';
import type { ReviewData, ReviewComment } from '@git-reviewer/shared';
import {
  addComment,
  updateComment,
  updateStatus,
  markFileViewed,
  unmarkFileViewed,
  setAutoMarkRules,
  applyAutoMarkRules,
} from './session-service.js';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../git/notes.js', () => ({
  readReviewNote: vi.fn(),
  writeReviewNote: vi.fn(),
  listReviewNotes: vi.fn(),
  removeReviewNote: vi.fn(),
}));

vi.mock('../git/diff.js', () => ({
  getDiffText: vi.fn().mockResolvedValue(''),
  getUncommittedDiffText: vi.fn().mockResolvedValue(''),
  getChangedFiles: vi.fn().mockResolvedValue([]),
  getUncommittedChangedFiles: vi.fn().mockResolvedValue([]),
  getFileDiffHashes: vi.fn().mockReturnValue({}),
  createGitClient: vi.fn(),
}));

vi.mock('../git/auto-mark.js', () => ({
  evaluateAutoMarkRules: vi.fn().mockReturnValue([]),
}));

import { readReviewNote, writeReviewNote } from '../git/notes.js';
import { getFileDiffHashes } from '../git/diff.js';
import { evaluateAutoMarkRules } from '../git/auto-mark.js';

const mockReadReviewNote = vi.mocked(readReviewNote);
const mockWriteReviewNote = vi.mocked(writeReviewNote);
const mockGetFileDiffHashes = vi.mocked(getFileDiffHashes);
const mockEvaluateAutoMarkRules = vi.mocked(evaluateAutoMarkRules);

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const COMMIT_SHA = 'deadbeef1234deadbeef1234deadbeef12345678';

const mockGit = {} as unknown as SimpleGit;

function makeSessionData(overrides?: Partial<ReviewData>): ReviewData {
  return {
    version: 1,
    session: {
      id: 'session-uuid',
      title: 'Test Review',
      baseRef: 'main',
      headRef: 'HEAD',
      baseCommit: 'base123',
      headCommit: COMMIT_SHA,
      status: 'pending',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
      repoPath: '/repo',
    },
    comments: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Creates a deferred promise whose resolution can be externally controlled.
 * Used to freeze `readReviewNote` mid-flight so a second call can be queued.
 */
function deferred<T = void>(): { promise: Promise<T>; resolve: (v: T) => void } {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('session-service write-lock', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mockWriteReviewNote.mockResolvedValue(undefined);
    // Pure/sync helpers reset by resetAllMocks — restore sensible defaults.
    mockGetFileDiffHashes.mockReturnValue({});
    mockEvaluateAutoMarkRules.mockReturnValue([]);
  });

  // -------------------------------------------------------------------------
  // addComment — two concurrent calls must not interleave
  // -------------------------------------------------------------------------

  describe('addComment', () => {
    it('serialises two concurrent addComment calls on the same session', async () => {
      const writeOrder: string[] = [];

      // Both calls will read the same base fixture (simulates the race)
      // but write is captured in order.
      const gate = deferred<ReviewData>();

      // First read is blocked until gate resolves; second read resolves immediately.
      mockReadReviewNote
        .mockImplementationOnce(() => gate.promise)
        .mockImplementation(() => Promise.resolve(makeSessionData()));

      mockWriteReviewNote.mockImplementation(async (_git, _sha, data: ReviewData) => {
        writeOrder.push(data.comments.map((c) => c.body).join(','));
      });

      const input1 = {
        file: 'a.ts',
        line: 1,
        side: 'right' as const,
        body: 'comment-1',
        author: 'alice',
      };
      const input2 = {
        file: 'b.ts',
        line: 2,
        side: 'right' as const,
        body: 'comment-2',
        author: 'bob',
      };

      const p1 = addComment(mockGit, COMMIT_SHA, input1);
      const p2 = addComment(mockGit, COMMIT_SHA, input2);

      // Unblock op1's read
      gate.resolve(makeSessionData());

      const [c1, c2] = await Promise.all([p1, p2]);

      // Both must succeed and return their respective comments
      expect((c1 as ReviewComment).body).toBe('comment-1');
      expect((c2 as ReviewComment).body).toBe('comment-2');

      // Writes happened in arrival order
      expect(writeOrder[0]).toBe('comment-1');
      expect(writeOrder[1]).toBe('comment-2');

      // Two separate writes were performed — not one merged write
      expect(mockWriteReviewNote).toHaveBeenCalledTimes(2);
    });

    it('returns null when session does not exist', async () => {
      mockReadReviewNote.mockResolvedValue(null);

      const result = await addComment(mockGit, COMMIT_SHA, {
        file: 'a.ts',
        line: 1,
        side: 'right',
        body: 'x',
        author: 'alice',
      });

      expect(result).toBeNull();
      expect(mockWriteReviewNote).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // updateComment
  // -------------------------------------------------------------------------

  describe('updateComment', () => {
    it('serialises two concurrent updateComment calls on the same session', async () => {
      const commentA: ReviewComment = {
        id: 'cmt-a',
        file: 'a.ts',
        line: 1,
        side: 'right',
        body: 'comment A',
        author: 'alice',
        createdAt: '2026-01-01T00:00:00Z',
        resolved: false,
      };
      const commentB: ReviewComment = {
        id: 'cmt-b',
        file: 'b.ts',
        line: 2,
        side: 'right',
        body: 'comment B',
        author: 'bob',
        createdAt: '2026-01-01T00:00:00Z',
        resolved: false,
      };
      const sessionWithBoth = makeSessionData({ comments: [commentA, commentB] });

      const gate = deferred<ReviewData>();

      mockReadReviewNote
        .mockImplementationOnce(() => gate.promise)
        .mockImplementation(() =>
          Promise.resolve(makeSessionData({ comments: [{ ...commentA }, { ...commentB }] })),
        );

      const p1 = updateComment(mockGit, COMMIT_SHA, 'cmt-a', { resolved: true });
      const p2 = updateComment(mockGit, COMMIT_SHA, 'cmt-b', { resolved: true });

      gate.resolve({ ...sessionWithBoth, comments: [{ ...commentA }, { ...commentB }] });

      const [r1, r2] = await Promise.all([p1, p2]);

      expect((r1 as ReviewComment).id).toBe('cmt-a');
      expect((r1 as ReviewComment).resolved).toBe(true);
      expect((r2 as ReviewComment).id).toBe('cmt-b');
      expect((r2 as ReviewComment).resolved).toBe(true);

      // Two sequential writes — never interleaved
      expect(mockWriteReviewNote).toHaveBeenCalledTimes(2);
    });

    it('returns comment-not-found when the comment id is missing', async () => {
      mockReadReviewNote.mockResolvedValue(makeSessionData());

      const result = await updateComment(mockGit, COMMIT_SHA, 'nonexistent', { resolved: true });

      expect(result).toBe('comment-not-found');
    });
  });

  // -------------------------------------------------------------------------
  // updateStatus
  // -------------------------------------------------------------------------

  describe('updateStatus', () => {
    it('serialises two concurrent status updates', async () => {
      const writtenStatuses: string[] = [];
      const gate = deferred<ReviewData>();

      mockReadReviewNote
        .mockImplementationOnce(() => gate.promise)
        .mockImplementation(() => Promise.resolve(makeSessionData()));

      mockWriteReviewNote.mockImplementation(async (_git, _sha, data: ReviewData) => {
        writtenStatuses.push(data.session.status);
      });

      const p1 = updateStatus(mockGit, COMMIT_SHA, 'approved');
      const p2 = updateStatus(mockGit, COMMIT_SHA, 'changes_requested');

      gate.resolve(makeSessionData());

      await Promise.all([p1, p2]);

      expect(writtenStatuses).toEqual(['approved', 'changes_requested']);
      expect(mockWriteReviewNote).toHaveBeenCalledTimes(2);
    });

    it('returns null when session does not exist', async () => {
      mockReadReviewNote.mockResolvedValue(null);
      expect(await updateStatus(mockGit, COMMIT_SHA, 'approved')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // markFileViewed
  // -------------------------------------------------------------------------

  describe('markFileViewed', () => {
    it('serialises two concurrent markFileViewed calls', async () => {
      const writtenViewedPaths: string[] = [];
      const gate = deferred<ReviewData>();

      mockReadReviewNote
        .mockImplementationOnce(() => gate.promise)
        .mockImplementation(() => Promise.resolve(makeSessionData()));

      mockWriteReviewNote.mockImplementation(async (_git, _sha, data: ReviewData) => {
        writtenViewedPaths.push((data.viewedFiles ?? []).map((vf) => vf.path).join(','));
      });

      const p1 = markFileViewed(mockGit, COMMIT_SHA, 'src/a.ts');
      const p2 = markFileViewed(mockGit, COMMIT_SHA, 'src/b.ts');

      gate.resolve(makeSessionData());

      await Promise.all([p1, p2]);

      // Each write contains exactly the file marked in that operation
      expect(writtenViewedPaths[0]).toBe('src/a.ts');
      expect(writtenViewedPaths[1]).toBe('src/b.ts');
      expect(mockWriteReviewNote).toHaveBeenCalledTimes(2);
    });

    it('returns null when session does not exist', async () => {
      mockReadReviewNote.mockResolvedValue(null);
      expect(await markFileViewed(mockGit, COMMIT_SHA, 'src/a.ts')).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // unmarkFileViewed
  // -------------------------------------------------------------------------

  describe('unmarkFileViewed', () => {
    it('serialises two concurrent unmarkFileViewed calls', async () => {
      const gate = deferred<ReviewData>();
      const sessionWithFiles = makeSessionData({
        viewedFiles: [
          { path: 'src/a.ts', viewedAt: '2026-01-01T00:00:00Z', diffHash: 'h1' },
          { path: 'src/b.ts', viewedAt: '2026-01-01T00:00:00Z', diffHash: 'h2' },
        ],
      });

      mockReadReviewNote
        .mockImplementationOnce(() => gate.promise)
        .mockImplementation(() =>
          Promise.resolve(
            makeSessionData({
              viewedFiles: [
                { path: 'src/a.ts', viewedAt: '2026-01-01T00:00:00Z', diffHash: 'h1' },
                { path: 'src/b.ts', viewedAt: '2026-01-01T00:00:00Z', diffHash: 'h2' },
              ],
            }),
          ),
        );

      const p1 = unmarkFileViewed(mockGit, COMMIT_SHA, 'src/a.ts');
      const p2 = unmarkFileViewed(mockGit, COMMIT_SHA, 'src/b.ts');

      gate.resolve(sessionWithFiles);

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).toBe(true);
      expect(r2).toBe(true);
      expect(mockWriteReviewNote).toHaveBeenCalledTimes(2);
    });

    it('returns false when session does not exist', async () => {
      mockReadReviewNote.mockResolvedValue(null);
      expect(await unmarkFileViewed(mockGit, COMMIT_SHA, 'src/a.ts')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // setAutoMarkRules
  // -------------------------------------------------------------------------

  describe('setAutoMarkRules', () => {
    it('serialises two concurrent setAutoMarkRules calls', async () => {
      const gate = deferred<ReviewData>();

      mockReadReviewNote
        .mockImplementationOnce(() => gate.promise)
        .mockImplementation(() => Promise.resolve(makeSessionData()));

      const p1 = setAutoMarkRules(mockGit, COMMIT_SHA, ['generated']);
      const p2 = setAutoMarkRules(mockGit, COMMIT_SHA, ['import-only']);

      gate.resolve(makeSessionData());

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1?.rules).toEqual(['generated']);
      expect(r2?.rules).toEqual(['import-only']);
      expect(mockWriteReviewNote).toHaveBeenCalledTimes(2);
    });

    it('returns null when session does not exist', async () => {
      mockReadReviewNote.mockResolvedValue(null);
      expect(await setAutoMarkRules(mockGit, COMMIT_SHA, [])).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // applyAutoMarkRules
  // -------------------------------------------------------------------------

  describe('applyAutoMarkRules', () => {
    it('serialises two concurrent applyAutoMarkRules calls', async () => {
      const gate = deferred<ReviewData>();

      mockReadReviewNote
        .mockImplementationOnce(() => gate.promise)
        .mockImplementation(() => Promise.resolve(makeSessionData()));

      const p1 = applyAutoMarkRules(mockGit, COMMIT_SHA);
      const p2 = applyAutoMarkRules(mockGit, COMMIT_SHA);

      gate.resolve(makeSessionData());

      const [r1, r2] = await Promise.all([p1, p2]);

      expect(r1).not.toBeNull();
      expect(r2).not.toBeNull();
      expect(mockWriteReviewNote).toHaveBeenCalledTimes(2);
    });

    it('returns null when session does not exist', async () => {
      mockReadReviewNote.mockResolvedValue(null);
      expect(await applyAutoMarkRules(mockGit, COMMIT_SHA)).toBeNull();
    });
  });

  // -------------------------------------------------------------------------
  // Cross-session independence — operations on different SHAs must not block
  // -------------------------------------------------------------------------

  describe('cross-session independence', () => {
    it('does not serialize operations on different session keys', async () => {
      const SHA_A = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const SHA_B = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
      const order: string[] = [];

      const gateA = deferred<ReviewData>();
      const gateB = deferred<ReviewData>();

      // Session A read is blocked; session B read resolves immediately.
      mockReadReviewNote.mockImplementation((_, sha: string) => {
        if (sha === SHA_A) return gateA.promise;
        return gateB.promise;
      });

      mockWriteReviewNote.mockImplementation(async (_, sha: string) => {
        order.push(sha === SHA_A ? 'A' : 'B');
      });

      const pA = updateStatus(mockGit, SHA_A, 'approved');
      const pB = updateStatus(mockGit, SHA_B, 'changes_requested');

      // Resolve B first — it must not wait for A
      gateB.resolve(makeSessionData());
      await pB;
      expect(order).toEqual(['B']);

      // Now resolve A
      gateA.resolve(makeSessionData());
      await pA;
      expect(order).toEqual(['B', 'A']);
    });
  });
});
