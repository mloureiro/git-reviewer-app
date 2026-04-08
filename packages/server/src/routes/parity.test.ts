/**
 * Parity snapshot tests — define canonical sample data for every response type
 * and snapshot the expected JSON output. This serves as the contract that both
 * the Node.js and Rust backends must match. If someone changes a type, the
 * snapshot will fail, signaling that both backends need updating.
 */
import { describe, it, expect } from 'vitest';
import type {
  ReviewData,
  ReviewComment,
  ReviewSession,
  DiffFile,
  ViewedFile,
  CommitInfo,
} from '@git-reviewer/shared';
import {
  validateFilesResponse,
  validateDiffResponse,
  validateSessionListResponse,
  validateSessionResponse,
  validateCreateCommentResponse,
  validateUpdateCommentResponse,
  validateUpdateSessionStatusResponse,
  validateViewedFileResponse,
  validateAutoMarkRulesResponse,
  validateAutoMarkApplyResponse,
  validateCommitsResponse,
} from '@git-reviewer/shared';

// ---------------------------------------------------------------------------
// Canonical sample data — these are the "golden" fixtures both backends must
// produce for equivalent inputs.
// ---------------------------------------------------------------------------

const canonicalSession: ReviewSession = {
  id: 'session-uuid-1',
  title: 'Test Review',
  baseRef: 'main',
  headRef: 'feature-branch',
  baseCommit: 'aaaa1111bbbb2222cccc3333dddd4444eeee5555',
  headCommit: 'ffff6666aaaa7777bbbb8888cccc9999dddd0000',
  status: 'pending',
  createdAt: '2026-03-19T10:00:00.000Z',
  updatedAt: '2026-03-19T10:00:00.000Z',
};

const canonicalComment: ReviewComment = {
  id: 'comment-uuid-1',
  file: 'src/foo.ts',
  line: 42,
  side: 'right',
  body: 'This needs fixing',
  author: 'reviewer',
  createdAt: '2026-03-19T10:05:00.000Z',
  resolved: false,
};

const canonicalViewedFile: ViewedFile = {
  path: 'src/bar.ts',
  viewedAt: '2026-03-19T10:10:00.000Z',
  diffHash: 'abc123hash',
};

const canonicalViewedFileAutoMarked: ViewedFile = {
  path: 'package-lock.json',
  viewedAt: '2026-03-19T10:10:00.000Z',
  diffHash: 'lock-hash-456',
  autoMarkedBy: 'lockfile',
};

const canonicalDiffFile: DiffFile = {
  path: 'src/foo.ts',
  status: 'modified',
  additions: 5,
  deletions: 2,
};

const canonicalDiffFileRenamed: DiffFile = {
  path: 'src/new-name.ts',
  status: 'renamed',
  additions: 1,
  deletions: 1,
  oldPath: 'src/old-name.ts',
};

const canonicalCommitInfo: CommitInfo = {
  hash: 'aaa111bbb222ccc333ddd444eee555fff666aaa1',
  shortHash: 'aaa111b',
  message: 'feat: add new feature',
  author: 'Dev',
  date: '2026-03-18T09:00:00.000Z',
};

const canonicalReviewData: ReviewData = {
  version: 1,
  session: canonicalSession,
  comments: [canonicalComment],
  viewedFiles: [canonicalViewedFile, canonicalViewedFileAutoMarked],
  autoMarkRules: ['lockfile', 'rename-only'],
};

const canonicalReviewDataMinimal: ReviewData = {
  version: 1,
  session: { ...canonicalSession, status: 'approved' },
  comments: [],
};

// ---------------------------------------------------------------------------
// Snapshot tests
// ---------------------------------------------------------------------------

describe('parity snapshots — canonical response shapes', () => {
  it('FilesResponse — with files, diffHashes, and renamed file', () => {
    const response = {
      files: [canonicalDiffFile, canonicalDiffFileRenamed],
      diffHashes: {
        'src/foo.ts': 'hash-foo-123',
        'src/new-name.ts': 'hash-new-456',
      },
    };

    expect(() => validateFilesResponse(response)).not.toThrow();
    expect(response).toMatchSnapshot();
  });

  it('FilesResponse — empty', () => {
    const response = {
      files: [],
    };

    expect(() => validateFilesResponse(response)).not.toThrow();
    expect(response).toMatchSnapshot();
  });

  it('DiffResponse', () => {
    const response = {
      diff: 'diff --git a/src/foo.ts b/src/foo.ts\n--- a/src/foo.ts\n+++ b/src/foo.ts\n@@ -1,3 +1,4 @@\n line1\n+added line\n line2\n line3\n',
    };

    expect(() => validateDiffResponse(response)).not.toThrow();
    expect(response).toMatchSnapshot();
  });

  it('SessionListResponse — with sessions', () => {
    const response = {
      sessions: [canonicalReviewData, canonicalReviewDataMinimal],
      total: 2,
      page: 1,
      limit: 20,
    };

    expect(() => validateSessionListResponse(response)).not.toThrow();
    expect(response).toMatchSnapshot();
  });

  it('SessionListResponse — empty', () => {
    const response = {
      sessions: [],
      total: 0,
      page: 1,
      limit: 20,
    };

    expect(() => validateSessionListResponse(response)).not.toThrow();
    expect(response).toMatchSnapshot();
  });

  it('SessionResponse — full ReviewData with all optional fields', () => {
    const response = { session: canonicalReviewData };
    expect(() => validateSessionResponse(response)).not.toThrow();
    expect(response).toMatchSnapshot();
  });

  it('SessionResponse — minimal ReviewData without optional fields', () => {
    const response = { session: canonicalReviewDataMinimal };
    expect(() => validateSessionResponse(response)).not.toThrow();
    expect(response).toMatchSnapshot();
  });

  it('CreateCommentResponse', () => {
    expect(() => validateCreateCommentResponse(canonicalComment)).not.toThrow();
    expect(canonicalComment).toMatchSnapshot();
  });

  it('UpdateCommentResponse — resolved comment', () => {
    const resolved = { ...canonicalComment, resolved: true };

    expect(() => validateUpdateCommentResponse(resolved)).not.toThrow();
    expect(resolved).toMatchSnapshot();
  });

  it('UpdateSessionStatusResponse — approved session', () => {
    const approved = {
      session: {
        ...canonicalSession,
        status: 'approved' as const,
        updatedAt: '2026-03-19T11:00:00.000Z',
      },
    };

    expect(() => validateUpdateSessionStatusResponse(approved)).not.toThrow();
    expect(approved).toMatchSnapshot();
  });

  it('UpdateSessionStatusResponse — changes_requested', () => {
    const changesRequested = {
      session: {
        ...canonicalSession,
        status: 'changes_requested' as const,
        updatedAt: '2026-03-19T11:00:00.000Z',
      },
    };

    expect(() => validateUpdateSessionStatusResponse(changesRequested)).not.toThrow();
    expect(changesRequested).toMatchSnapshot();
  });

  it('ViewedFile — manually viewed (no autoMarkedBy)', () => {
    expect(() => validateViewedFileResponse(canonicalViewedFile)).not.toThrow();
    expect(canonicalViewedFile).toMatchSnapshot();
  });

  it('ViewedFile — auto-marked', () => {
    expect(() => validateViewedFileResponse(canonicalViewedFileAutoMarked)).not.toThrow();
    expect(canonicalViewedFileAutoMarked).toMatchSnapshot();
  });

  it('AutoMarkRulesResponse', () => {
    const response = {
      rules: ['lockfile', 'rename-only'] as const,
      autoMarked: [canonicalViewedFileAutoMarked],
    };

    expect(() => validateAutoMarkRulesResponse(response)).not.toThrow();
    expect(response).toMatchSnapshot();
  });

  it('AutoMarkApplyResponse', () => {
    const response = {
      autoMarked: [canonicalViewedFileAutoMarked],
    };

    expect(() => validateAutoMarkApplyResponse(response)).not.toThrow();
    expect(response).toMatchSnapshot();
  });

  it('CommitsResponse', () => {
    const response = {
      commits: [canonicalCommitInfo],
    };

    expect(() => validateCommitsResponse(response)).not.toThrow();
    expect(response).toMatchSnapshot();
  });

  it('CommitsResponse — empty', () => {
    const response = {
      commits: [],
    };

    expect(() => validateCommitsResponse(response)).not.toThrow();
    expect(response).toMatchSnapshot();
  });
});

// ---------------------------------------------------------------------------
// Validator rejection tests — ensure validators catch structural mismatches
// ---------------------------------------------------------------------------

describe('schema validators — reject invalid shapes', () => {
  it('rejects FilesResponse missing files key', () => {
    expect(() => validateFilesResponse({ diffHashes: {} })).toThrow();
  });

  it('rejects FilesResponse with wrong file status', () => {
    expect(() =>
      validateFilesResponse({
        files: [{ path: 'f', status: 'unknown', additions: 0, deletions: 0 }],
      }),
    ).toThrow();
  });

  it('rejects DiffResponse missing diff key', () => {
    expect(() => validateDiffResponse({})).toThrow();
  });

  it('rejects DiffResponse with non-string diff', () => {
    expect(() => validateDiffResponse({ diff: 123 })).toThrow();
  });

  it('rejects SessionListResponse with non-array sessions', () => {
    expect(() =>
      validateSessionListResponse({ sessions: 'nope', total: 0, page: 1, limit: 20 }),
    ).toThrow();
  });

  it('rejects ReviewData with wrong version', () => {
    expect(() =>
      validateSessionResponse({
        session: {
          ...canonicalReviewData,
          version: 2,
        },
      }),
    ).toThrow();
  });

  it('rejects ReviewData with invalid status', () => {
    expect(() =>
      validateSessionResponse({
        session: {
          ...canonicalReviewData,
          session: { ...canonicalSession, status: 'merged' },
        },
      }),
    ).toThrow();
  });

  it('rejects ReviewComment missing required fields', () => {
    expect(() =>
      validateCreateCommentResponse({
        id: 'x',
        file: 'f',
        // line missing
        side: 'right',
        body: 'text',
        author: 'dev',
        createdAt: 'now',
        resolved: false,
      }),
    ).toThrow();
  });

  it('rejects ViewedFile with invalid autoMarkedBy', () => {
    expect(() =>
      validateViewedFileResponse({
        path: 'f',
        viewedAt: 'now',
        diffHash: 'h',
        autoMarkedBy: 'invalid-rule',
      }),
    ).toThrow();
  });

  it('rejects AutoMarkRulesResponse with invalid rule', () => {
    expect(() =>
      validateAutoMarkRulesResponse({
        rules: ['not-a-rule'],
        autoMarked: [],
      }),
    ).toThrow();
  });

  it('rejects CommitsResponse with missing commit fields', () => {
    expect(() =>
      validateCommitsResponse({
        commits: [{ hash: 'abc' }],
      }),
    ).toThrow();
  });
});
