import { describe, it, expect } from 'vitest';
import {
  validateDiffFile,
  validateCommitInfo,
  validateReviewComment,
  validateReviewSession,
  validateViewedFile,
  validateReviewData,
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
  validateCommitDiffResponse,
  validateCommitFilesResponse,
} from './schemas.js';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VALID_DIFF_FILE = {
  path: 'src/foo.ts',
  status: 'modified',
  additions: 5,
  deletions: 2,
};

const VALID_DIFF_FILE_RENAMED = {
  path: 'src/bar.ts',
  status: 'renamed',
  additions: 0,
  deletions: 0,
  oldPath: 'src/foo.ts',
};

const VALID_COMMIT_INFO = {
  hash: 'abc123def456abc123def456abc123def456abc1',
  shortHash: 'abc123d',
  message: 'feat: add feature',
  author: 'Alice',
  date: '2026-01-01T00:00:00Z',
};

const VALID_REVIEW_COMMENT = {
  id: 'c1',
  file: 'src/foo.ts',
  line: 10,
  side: 'right',
  body: 'Looks good',
  author: 'alice',
  createdAt: '2026-01-01T00:00:00Z',
  resolved: false,
};

const VALID_REVIEW_SESSION = {
  id: 's1',
  title: 'Review feature branch',
  baseRef: 'main',
  headRef: 'feature/foo',
  baseCommit: 'abc123',
  headCommit: 'def456',
  status: 'pending',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

const VALID_VIEWED_FILE = {
  path: 'src/foo.ts',
  viewedAt: '2026-01-01T00:00:00Z',
  diffHash: 'hash123',
};

const VALID_REVIEWED_FILE_WITH_AUTO_MARK = {
  ...VALID_VIEWED_FILE,
  autoMarkedBy: 'lockfile',
};

const VALID_REVIEW_DATA = {
  version: 1 as number,
  session: VALID_REVIEW_SESSION as Record<string, unknown>,
  comments: [VALID_REVIEW_COMMENT] as unknown[],
};

// ---------------------------------------------------------------------------
// validateDiffFile
// ---------------------------------------------------------------------------

describe('validateDiffFile', () => {
  it('accepts a valid DiffFile', () => {
    expect(() => validateDiffFile(VALID_DIFF_FILE)).not.toThrow();
  });

  it('accepts a renamed DiffFile with oldPath', () => {
    expect(() => validateDiffFile(VALID_DIFF_FILE_RENAMED)).not.toThrow();
  });

  it('accepts a DiffFile without oldPath (optional field)', () => {
    const val = { ...VALID_DIFF_FILE, oldPath: undefined };
    expect(() => validateDiffFile(val)).not.toThrow();
  });

  it('accepts a DiffFile with null oldPath (treated as absent)', () => {
    const val = { ...VALID_DIFF_FILE, oldPath: null };
    expect(() => validateDiffFile(val)).not.toThrow();
  });

  it('accepts all valid status values', () => {
    for (const status of ['added', 'modified', 'deleted', 'renamed'] as const) {
      expect(() => validateDiffFile({ ...VALID_DIFF_FILE, status })).not.toThrow();
    }
  });

  it('uses "DiffFile" as the default label', () => {
    expect(() => validateDiffFile(null)).toThrow('DiffFile: expected object, got null');
  });

  it('uses provided label in error messages', () => {
    expect(() => validateDiffFile(null, 'MyLabel')).toThrow('MyLabel: expected object');
  });

  it('throws when path is missing', () => {
    const { additions, deletions, status } = VALID_DIFF_FILE;
    expect(() => validateDiffFile({ additions, deletions, status })).toThrow(
      'DiffFile.path: expected string, got undefined',
    );
  });

  it('throws when path is a number', () => {
    expect(() => validateDiffFile({ ...VALID_DIFF_FILE, path: 42 })).toThrow(
      'DiffFile.path: expected string, got number',
    );
  });

  it('throws when status is an invalid enum value', () => {
    expect(() => validateDiffFile({ ...VALID_DIFF_FILE, status: 'unknown' })).toThrow(
      'DiffFile.status: expected one of [added, modified, deleted, renamed], got "unknown"',
    );
  });

  it('throws when additions is a string', () => {
    expect(() => validateDiffFile({ ...VALID_DIFF_FILE, additions: '5' })).toThrow(
      'DiffFile.additions: expected number, got string',
    );
  });

  it('throws when deletions is boolean', () => {
    expect(() => validateDiffFile({ ...VALID_DIFF_FILE, deletions: true })).toThrow(
      'DiffFile.deletions: expected number, got boolean',
    );
  });

  it('throws when oldPath is present but not a string', () => {
    expect(() => validateDiffFile({ ...VALID_DIFF_FILE, oldPath: 123 })).toThrow(
      'DiffFile.oldPath: expected string, got number',
    );
  });

  it('throws when value is an array', () => {
    expect(() => validateDiffFile([])).toThrow('DiffFile: expected object');
  });

  it('throws when value is a primitive', () => {
    expect(() => validateDiffFile('string')).toThrow('DiffFile: expected object, got string');
  });
});

// ---------------------------------------------------------------------------
// validateCommitInfo
// ---------------------------------------------------------------------------

describe('validateCommitInfo', () => {
  it('accepts a valid CommitInfo', () => {
    expect(() => validateCommitInfo(VALID_COMMIT_INFO)).not.toThrow();
  });

  it('uses "CommitInfo" as the default label', () => {
    expect(() => validateCommitInfo(null)).toThrow('CommitInfo: expected object');
  });

  it('uses a custom label when provided', () => {
    expect(() => validateCommitInfo(null, 'TestLabel')).toThrow('TestLabel: expected object');
  });

  it('throws when hash is missing', () => {
    const { shortHash, message, author, date } = VALID_COMMIT_INFO;
    expect(() => validateCommitInfo({ shortHash, message, author, date })).toThrow(
      'CommitInfo.hash: expected string, got undefined',
    );
  });

  it('throws when shortHash is not a string', () => {
    expect(() => validateCommitInfo({ ...VALID_COMMIT_INFO, shortHash: 7 })).toThrow(
      'CommitInfo.shortHash: expected string, got number',
    );
  });

  it('throws when message is not a string', () => {
    expect(() => validateCommitInfo({ ...VALID_COMMIT_INFO, message: null })).toThrow(
      'CommitInfo.message: expected string, got object',
    );
  });

  it('throws when author is not a string', () => {
    expect(() => validateCommitInfo({ ...VALID_COMMIT_INFO, author: [] })).toThrow(
      'CommitInfo.author: expected string, got object',
    );
  });

  it('throws when date is not a string', () => {
    expect(() => validateCommitInfo({ ...VALID_COMMIT_INFO, date: false })).toThrow(
      'CommitInfo.date: expected string, got boolean',
    );
  });
});

// ---------------------------------------------------------------------------
// validateReviewComment
// ---------------------------------------------------------------------------

describe('validateReviewComment', () => {
  it('accepts a valid ReviewComment', () => {
    expect(() => validateReviewComment(VALID_REVIEW_COMMENT)).not.toThrow();
  });

  it('accepts side="left"', () => {
    expect(() => validateReviewComment({ ...VALID_REVIEW_COMMENT, side: 'left' })).not.toThrow();
  });

  it('accepts side="right"', () => {
    expect(() => validateReviewComment({ ...VALID_REVIEW_COMMENT, side: 'right' })).not.toThrow();
  });

  it('accepts resolved=true', () => {
    expect(() => validateReviewComment({ ...VALID_REVIEW_COMMENT, resolved: true })).not.toThrow();
  });

  it('uses "ReviewComment" as the default label', () => {
    expect(() => validateReviewComment(42)).toThrow('ReviewComment: expected object, got number');
  });

  it('throws when id is not a string', () => {
    expect(() => validateReviewComment({ ...VALID_REVIEW_COMMENT, id: 99 })).toThrow(
      'ReviewComment.id: expected string, got number',
    );
  });

  it('throws when file is not a string', () => {
    expect(() => validateReviewComment({ ...VALID_REVIEW_COMMENT, file: true })).toThrow(
      'ReviewComment.file: expected string, got boolean',
    );
  });

  it('throws when line is not a number', () => {
    expect(() => validateReviewComment({ ...VALID_REVIEW_COMMENT, line: '10' })).toThrow(
      'ReviewComment.line: expected number, got string',
    );
  });

  it('throws when side is an invalid value', () => {
    expect(() => validateReviewComment({ ...VALID_REVIEW_COMMENT, side: 'center' })).toThrow(
      'ReviewComment.side: expected one of [left, right], got "center"',
    );
  });

  it('throws when body is not a string', () => {
    expect(() => validateReviewComment({ ...VALID_REVIEW_COMMENT, body: null })).toThrow(
      'ReviewComment.body: expected string, got object',
    );
  });

  it('throws when author is not a string', () => {
    expect(() => validateReviewComment({ ...VALID_REVIEW_COMMENT, author: 0 })).toThrow(
      'ReviewComment.author: expected string, got number',
    );
  });

  it('throws when createdAt is not a string', () => {
    expect(() => validateReviewComment({ ...VALID_REVIEW_COMMENT, createdAt: {} })).toThrow(
      'ReviewComment.createdAt: expected string, got object',
    );
  });

  it('throws when resolved is not a boolean', () => {
    expect(() => validateReviewComment({ ...VALID_REVIEW_COMMENT, resolved: 0 })).toThrow(
      'ReviewComment.resolved: expected boolean, got number',
    );
  });
});

// ---------------------------------------------------------------------------
// validateReviewSession
// ---------------------------------------------------------------------------

describe('validateReviewSession', () => {
  it('accepts a valid ReviewSession', () => {
    expect(() => validateReviewSession(VALID_REVIEW_SESSION)).not.toThrow();
  });

  it('accepts all valid status values', () => {
    for (const status of ['pending', 'approved', 'changes_requested'] as const) {
      expect(() => validateReviewSession({ ...VALID_REVIEW_SESSION, status })).not.toThrow();
    }
  });

  it('uses "ReviewSession" as the default label', () => {
    expect(() => validateReviewSession(undefined)).toThrow(
      'ReviewSession: expected object, got undefined',
    );
  });

  it('throws when id is missing', () => {
    const { title, baseRef, headRef, baseCommit, headCommit, status, createdAt, updatedAt } =
      VALID_REVIEW_SESSION;
    expect(() =>
      validateReviewSession({
        title,
        baseRef,
        headRef,
        baseCommit,
        headCommit,
        status,
        createdAt,
        updatedAt,
      }),
    ).toThrow('ReviewSession.id: expected string, got undefined');
  });

  it('throws when title is not a string', () => {
    expect(() => validateReviewSession({ ...VALID_REVIEW_SESSION, title: 123 })).toThrow(
      'ReviewSession.title: expected string, got number',
    );
  });

  it('throws when baseRef is not a string', () => {
    expect(() => validateReviewSession({ ...VALID_REVIEW_SESSION, baseRef: null })).toThrow(
      'ReviewSession.baseRef: expected string, got object',
    );
  });

  it('throws when headRef is not a string', () => {
    expect(() => validateReviewSession({ ...VALID_REVIEW_SESSION, headRef: [] })).toThrow(
      'ReviewSession.headRef: expected string, got object',
    );
  });

  it('throws when baseCommit is not a string', () => {
    expect(() => validateReviewSession({ ...VALID_REVIEW_SESSION, baseCommit: false })).toThrow(
      'ReviewSession.baseCommit: expected string, got boolean',
    );
  });

  it('throws when headCommit is not a string', () => {
    expect(() => validateReviewSession({ ...VALID_REVIEW_SESSION, headCommit: 0 })).toThrow(
      'ReviewSession.headCommit: expected string, got number',
    );
  });

  it('throws when status is an invalid value', () => {
    expect(() => validateReviewSession({ ...VALID_REVIEW_SESSION, status: 'rejected' })).toThrow(
      'ReviewSession.status: expected one of [pending, approved, changes_requested], got "rejected"',
    );
  });

  it('throws when createdAt is not a string', () => {
    expect(() => validateReviewSession({ ...VALID_REVIEW_SESSION, createdAt: 0 })).toThrow(
      'ReviewSession.createdAt: expected string, got number',
    );
  });

  it('throws when updatedAt is not a string', () => {
    expect(() => validateReviewSession({ ...VALID_REVIEW_SESSION, updatedAt: true })).toThrow(
      'ReviewSession.updatedAt: expected string, got boolean',
    );
  });
});

// ---------------------------------------------------------------------------
// validateViewedFile
// ---------------------------------------------------------------------------

describe('validateViewedFile', () => {
  it('accepts a valid ViewedFile without autoMarkedBy', () => {
    expect(() => validateViewedFile(VALID_VIEWED_FILE)).not.toThrow();
  });

  it('accepts a valid ViewedFile with a valid autoMarkedBy', () => {
    expect(() => validateViewedFile(VALID_REVIEWED_FILE_WITH_AUTO_MARK)).not.toThrow();
  });

  it('accepts null autoMarkedBy (treated as absent)', () => {
    expect(() => validateViewedFile({ ...VALID_VIEWED_FILE, autoMarkedBy: null })).not.toThrow();
  });

  it('accepts all valid autoMarkedBy values', () => {
    const rules = ['rename-only', 'import-only', 'whitespace-only', 'lockfile', 'generated'];
    for (const rule of rules) {
      expect(() => validateViewedFile({ ...VALID_VIEWED_FILE, autoMarkedBy: rule })).not.toThrow();
    }
  });

  it('uses "ViewedFile" as the default label', () => {
    expect(() => validateViewedFile(null)).toThrow('ViewedFile: expected object, got null');
  });

  it('throws when path is not a string', () => {
    expect(() => validateViewedFile({ ...VALID_VIEWED_FILE, path: 42 })).toThrow(
      'ViewedFile.path: expected string, got number',
    );
  });

  it('throws when viewedAt is not a string', () => {
    expect(() => validateViewedFile({ ...VALID_VIEWED_FILE, viewedAt: {} })).toThrow(
      'ViewedFile.viewedAt: expected string, got object',
    );
  });

  it('throws when diffHash is not a string', () => {
    expect(() => validateViewedFile({ ...VALID_VIEWED_FILE, diffHash: true })).toThrow(
      'ViewedFile.diffHash: expected string, got boolean',
    );
  });

  it('throws when autoMarkedBy is an invalid rule', () => {
    expect(() =>
      validateViewedFile({ ...VALID_VIEWED_FILE, autoMarkedBy: 'unknown-rule' }),
    ).toThrow(
      'ViewedFile.autoMarkedBy: expected one of [rename-only, import-only, whitespace-only, lockfile, generated], got "unknown-rule"',
    );
  });
});

// ---------------------------------------------------------------------------
// validateReviewData
// ---------------------------------------------------------------------------

describe('validateReviewData', () => {
  it('accepts minimal valid ReviewData (no optional fields)', () => {
    expect(() => validateReviewData(VALID_REVIEW_DATA)).not.toThrow();
  });

  it('accepts ReviewData with empty comments array', () => {
    expect(() => validateReviewData({ ...VALID_REVIEW_DATA, comments: [] })).not.toThrow();
  });

  it('accepts ReviewData with viewedFiles', () => {
    expect(() =>
      validateReviewData({
        ...VALID_REVIEW_DATA,
        viewedFiles: [VALID_VIEWED_FILE],
      }),
    ).not.toThrow();
  });

  it('accepts ReviewData with null viewedFiles (treated as absent)', () => {
    expect(() => validateReviewData({ ...VALID_REVIEW_DATA, viewedFiles: null })).not.toThrow();
  });

  it('accepts ReviewData with autoMarkRules', () => {
    expect(() =>
      validateReviewData({
        ...VALID_REVIEW_DATA,
        autoMarkRules: ['lockfile', 'generated'],
      }),
    ).not.toThrow();
  });

  it('accepts ReviewData with all optional fields populated', () => {
    expect(() =>
      validateReviewData({
        ...VALID_REVIEW_DATA,
        viewedFiles: [VALID_REVIEWED_FILE_WITH_AUTO_MARK],
        autoMarkRules: ['lockfile'],
      }),
    ).not.toThrow();
  });

  it('uses "ReviewData" as the default label', () => {
    expect(() => validateReviewData(null)).toThrow('ReviewData: expected object, got null');
  });

  it('throws when version is not 1', () => {
    expect(() => validateReviewData({ ...VALID_REVIEW_DATA, version: 2 })).toThrow(
      'ReviewData.version: expected 1, got 2',
    );
  });

  it('throws when version is a string', () => {
    expect(() => validateReviewData({ ...VALID_REVIEW_DATA, version: '1' })).toThrow(
      'ReviewData.version: expected number, got string',
    );
  });

  it('throws when session is invalid', () => {
    expect(() =>
      validateReviewData({ ...VALID_REVIEW_DATA, session: { ...VALID_REVIEW_SESSION, id: 123 } }),
    ).toThrow('ReviewData.session.id: expected string, got number');
  });

  it('throws when comments is not an array', () => {
    expect(() => validateReviewData({ ...VALID_REVIEW_DATA, comments: {} })).toThrow(
      'ReviewData.comments: expected array, got object',
    );
  });

  it('throws when a comment in the array is invalid', () => {
    expect(() =>
      validateReviewData({
        ...VALID_REVIEW_DATA,
        comments: [{ ...VALID_REVIEW_COMMENT, line: 'bad' }],
      }),
    ).toThrow('ReviewData.comments[0].line: expected number, got string');
  });

  it('throws when a viewedFile in the array is invalid', () => {
    expect(() =>
      validateReviewData({
        ...VALID_REVIEW_DATA,
        viewedFiles: [{ ...VALID_VIEWED_FILE, path: 99 }],
      }),
    ).toThrow('ReviewData.viewedFiles[0].path: expected string, got number');
  });

  it('throws when viewedFiles is not an array', () => {
    expect(() => validateReviewData({ ...VALID_REVIEW_DATA, viewedFiles: 'bad' })).toThrow(
      'ReviewData.viewedFiles: expected array, got string',
    );
  });

  it('throws when autoMarkRules contains an invalid rule', () => {
    expect(() =>
      validateReviewData({ ...VALID_REVIEW_DATA, autoMarkRules: ['lockfile', 'bad-rule'] }),
    ).toThrow('ReviewData.autoMarkRules[1]: expected one of');
  });

  it('throws when autoMarkRules is not an array', () => {
    expect(() => validateReviewData({ ...VALID_REVIEW_DATA, autoMarkRules: 'lockfile' })).toThrow(
      'ReviewData.autoMarkRules: expected array, got string',
    );
  });
});

// ---------------------------------------------------------------------------
// validateFilesResponse
// ---------------------------------------------------------------------------

describe('validateFilesResponse', () => {
  it('accepts a valid FilesResponse without diffHashes', () => {
    expect(() => validateFilesResponse({ files: [VALID_DIFF_FILE] })).not.toThrow();
  });

  it('accepts a valid FilesResponse with empty files array', () => {
    expect(() => validateFilesResponse({ files: [] })).not.toThrow();
  });

  it('accepts a valid FilesResponse with diffHashes', () => {
    expect(() =>
      validateFilesResponse({
        files: [VALID_DIFF_FILE],
        diffHashes: { 'src/foo.ts': 'hash123' },
      }),
    ).not.toThrow();
  });

  it('accepts null diffHashes (treated as absent)', () => {
    expect(() =>
      validateFilesResponse({ files: [VALID_DIFF_FILE], diffHashes: null }),
    ).not.toThrow();
  });

  it('throws when files is not an array', () => {
    expect(() => validateFilesResponse({ files: null })).toThrow(
      'FilesResponse.files: expected array, got object',
    );
  });

  it('throws when a file entry is invalid', () => {
    expect(() =>
      validateFilesResponse({ files: [{ ...VALID_DIFF_FILE, additions: 'bad' }] }),
    ).toThrow('FilesResponse.files[0].additions: expected number, got string');
  });

  it('throws when diffHashes is not an object', () => {
    expect(() => validateFilesResponse({ files: [], diffHashes: 'not-an-object' })).toThrow(
      'FilesResponse.diffHashes: expected object',
    );
  });

  it('throws when diffHashes value is not a string', () => {
    expect(() => validateFilesResponse({ files: [], diffHashes: { 'src/foo.ts': 42 } })).toThrow(
      'FilesResponse.diffHashes["src/foo.ts"]: expected string, got number',
    );
  });

  it('throws when the response itself is not an object', () => {
    expect(() => validateFilesResponse('bad')).toThrow('FilesResponse: expected object');
  });
});

// ---------------------------------------------------------------------------
// validateDiffResponse
// ---------------------------------------------------------------------------

describe('validateDiffResponse', () => {
  it('accepts a valid DiffResponse', () => {
    expect(() => validateDiffResponse({ diff: 'diff --git a/foo' })).not.toThrow();
  });

  it('accepts an empty diff string', () => {
    expect(() => validateDiffResponse({ diff: '' })).not.toThrow();
  });

  it('throws when diff is not a string', () => {
    expect(() => validateDiffResponse({ diff: null })).toThrow(
      'DiffResponse.diff: expected string, got object',
    );
  });

  it('throws when diff field is missing', () => {
    expect(() => validateDiffResponse({})).toThrow(
      'DiffResponse.diff: expected string, got undefined',
    );
  });

  it('throws when the response is not an object', () => {
    expect(() => validateDiffResponse(42)).toThrow('DiffResponse: expected object, got number');
  });
});

// ---------------------------------------------------------------------------
// validateSessionListResponse
// ---------------------------------------------------------------------------

describe('validateSessionListResponse', () => {
  it('accepts a valid SessionListResponse with one session', () => {
    expect(() =>
      validateSessionListResponse({ sessions: [VALID_REVIEW_DATA], total: 1, page: 1, limit: 20 }),
    ).not.toThrow();
  });

  it('accepts an empty sessions array', () => {
    expect(() =>
      validateSessionListResponse({ sessions: [], total: 0, page: 1, limit: 20 }),
    ).not.toThrow();
  });

  it('throws when sessions is not an array', () => {
    expect(() =>
      validateSessionListResponse({ sessions: null, total: 0, page: 1, limit: 20 }),
    ).toThrow('SessionListResponse.sessions: expected array, got object');
  });

  it('throws when a session entry is invalid (nested label is correct)', () => {
    const badSession = { ...VALID_REVIEW_DATA, version: 2 };
    expect(() =>
      validateSessionListResponse({ sessions: [badSession], total: 1, page: 1, limit: 20 }),
    ).toThrow('SessionListResponse.sessions[0].version: expected 1, got 2');
  });
});

// ---------------------------------------------------------------------------
// validateSessionResponse
// ---------------------------------------------------------------------------

describe('validateSessionResponse', () => {
  it('accepts valid ReviewData as a SessionResponse', () => {
    expect(() => validateSessionResponse({ session: VALID_REVIEW_DATA })).not.toThrow();
  });

  it('throws when session is invalid', () => {
    expect(() =>
      validateSessionResponse({ session: { ...VALID_REVIEW_DATA, session: null } }),
    ).toThrow('SessionResponse.session.session: expected object');
  });
});

// ---------------------------------------------------------------------------
// validateCreateCommentResponse
// ---------------------------------------------------------------------------

describe('validateCreateCommentResponse', () => {
  it('accepts a valid comment as CreateCommentResponse', () => {
    expect(() => validateCreateCommentResponse(VALID_REVIEW_COMMENT)).not.toThrow();
  });

  it('throws when the response is invalid', () => {
    expect(() =>
      validateCreateCommentResponse({ ...VALID_REVIEW_COMMENT, resolved: 'yes' }),
    ).toThrow('CreateCommentResponse.resolved: expected boolean, got string');
  });
});

// ---------------------------------------------------------------------------
// validateUpdateCommentResponse
// ---------------------------------------------------------------------------

describe('validateUpdateCommentResponse', () => {
  it('accepts a valid comment as UpdateCommentResponse', () => {
    expect(() =>
      validateUpdateCommentResponse({ ...VALID_REVIEW_COMMENT, resolved: true }),
    ).not.toThrow();
  });

  it('throws when the response is not an object', () => {
    expect(() => validateUpdateCommentResponse(null)).toThrow(
      'UpdateCommentResponse: expected object, got null',
    );
  });
});

// ---------------------------------------------------------------------------
// validateUpdateSessionStatusResponse
// ---------------------------------------------------------------------------

describe('validateUpdateSessionStatusResponse', () => {
  it('accepts a valid session as UpdateSessionStatusResponse', () => {
    expect(() =>
      validateUpdateSessionStatusResponse({ session: VALID_REVIEW_SESSION }),
    ).not.toThrow();
  });

  it('accepts approved status', () => {
    expect(() =>
      validateUpdateSessionStatusResponse({
        session: { ...VALID_REVIEW_SESSION, status: 'approved' },
      }),
    ).not.toThrow();
  });

  it('throws when status is invalid', () => {
    expect(() =>
      validateUpdateSessionStatusResponse({
        session: { ...VALID_REVIEW_SESSION, status: 'open' as never },
      }),
    ).toThrow(
      'UpdateSessionStatusResponse.session.status: expected one of [pending, approved, changes_requested], got "open"',
    );
  });
});

// ---------------------------------------------------------------------------
// validateViewedFileResponse
// ---------------------------------------------------------------------------

describe('validateViewedFileResponse', () => {
  it('accepts a valid ViewedFile', () => {
    expect(() => validateViewedFileResponse(VALID_VIEWED_FILE)).not.toThrow();
  });

  it('throws when path is missing', () => {
    const { viewedAt, diffHash } = VALID_VIEWED_FILE;
    expect(() => validateViewedFileResponse({ viewedAt, diffHash })).toThrow(
      'ViewedFileResponse.path: expected string, got undefined',
    );
  });
});

// ---------------------------------------------------------------------------
// validateAutoMarkRulesResponse
// ---------------------------------------------------------------------------

describe('validateAutoMarkRulesResponse', () => {
  it('accepts a valid response with rules and autoMarked', () => {
    expect(() =>
      validateAutoMarkRulesResponse({
        rules: ['lockfile', 'generated'],
        autoMarked: [VALID_VIEWED_FILE],
      }),
    ).not.toThrow();
  });

  it('accepts empty rules and autoMarked arrays', () => {
    expect(() => validateAutoMarkRulesResponse({ rules: [], autoMarked: [] })).not.toThrow();
  });

  it('accepts all valid rule values', () => {
    const rules = ['rename-only', 'import-only', 'whitespace-only', 'lockfile', 'generated'];
    expect(() => validateAutoMarkRulesResponse({ rules, autoMarked: [] })).not.toThrow();
  });

  it('throws when rules is not an array', () => {
    expect(() => validateAutoMarkRulesResponse({ rules: 'lockfile', autoMarked: [] })).toThrow(
      'AutoMarkRulesResponse.rules: expected array',
    );
  });

  it('throws when a rule entry is invalid', () => {
    expect(() => validateAutoMarkRulesResponse({ rules: ['bad-rule'], autoMarked: [] })).toThrow(
      'AutoMarkRulesResponse.rules[0]: expected one of',
    );
  });

  it('throws when autoMarked is not an array', () => {
    expect(() => validateAutoMarkRulesResponse({ rules: [], autoMarked: null })).toThrow(
      'AutoMarkRulesResponse.autoMarked: expected array, got object',
    );
  });

  it('throws when an autoMarked entry is invalid', () => {
    expect(() =>
      validateAutoMarkRulesResponse({
        rules: [],
        autoMarked: [{ ...VALID_VIEWED_FILE, diffHash: 99 }],
      }),
    ).toThrow('AutoMarkRulesResponse.autoMarked[0].diffHash: expected string, got number');
  });
});

// ---------------------------------------------------------------------------
// validateAutoMarkApplyResponse
// ---------------------------------------------------------------------------

describe('validateAutoMarkApplyResponse', () => {
  it('accepts a valid response', () => {
    expect(() => validateAutoMarkApplyResponse({ autoMarked: [VALID_VIEWED_FILE] })).not.toThrow();
  });

  it('accepts empty autoMarked array', () => {
    expect(() => validateAutoMarkApplyResponse({ autoMarked: [] })).not.toThrow();
  });

  it('throws when autoMarked is not an array', () => {
    expect(() => validateAutoMarkApplyResponse({ autoMarked: {} })).toThrow(
      'AutoMarkApplyResponse.autoMarked: expected array, got object',
    );
  });

  it('throws when an autoMarked entry is invalid', () => {
    expect(() =>
      validateAutoMarkApplyResponse({
        autoMarked: [{ ...VALID_VIEWED_FILE, path: null }],
      }),
    ).toThrow('AutoMarkApplyResponse.autoMarked[0].path: expected string, got object');
  });

  it('throws when the response itself is not an object', () => {
    expect(() => validateAutoMarkApplyResponse([])).toThrow(
      'AutoMarkApplyResponse: expected object',
    );
  });
});

// ---------------------------------------------------------------------------
// validateCommitsResponse
// ---------------------------------------------------------------------------

describe('validateCommitsResponse', () => {
  it('accepts a valid CommitsResponse', () => {
    expect(() => validateCommitsResponse({ commits: [VALID_COMMIT_INFO] })).not.toThrow();
  });

  it('accepts empty commits array', () => {
    expect(() => validateCommitsResponse({ commits: [] })).not.toThrow();
  });

  it('throws when commits is not an array', () => {
    expect(() => validateCommitsResponse({ commits: null })).toThrow(
      'CommitsResponse.commits: expected array, got object',
    );
  });

  it('throws when a commit entry is invalid', () => {
    expect(() =>
      validateCommitsResponse({ commits: [{ ...VALID_COMMIT_INFO, hash: 42 }] }),
    ).toThrow('CommitsResponse.commits[0].hash: expected string, got number');
  });
});

// ---------------------------------------------------------------------------
// validateCommitDiffResponse (delegates to validateDiffResponse)
// ---------------------------------------------------------------------------

describe('validateCommitDiffResponse', () => {
  it('accepts a valid diff response', () => {
    expect(() => validateCommitDiffResponse({ diff: '--- a/foo\n+++ b/foo' })).not.toThrow();
  });

  it('throws when diff is missing', () => {
    expect(() => validateCommitDiffResponse({})).toThrow(
      'DiffResponse.diff: expected string, got undefined',
    );
  });
});

// ---------------------------------------------------------------------------
// validateCommitFilesResponse (delegates to validateFilesResponse)
// ---------------------------------------------------------------------------

describe('validateCommitFilesResponse', () => {
  it('accepts a valid files response', () => {
    expect(() => validateCommitFilesResponse({ files: [VALID_DIFF_FILE] })).not.toThrow();
  });

  it('throws when files is missing', () => {
    expect(() => validateCommitFilesResponse({})).toThrow(
      'FilesResponse.files: expected array, got undefined',
    );
  });
});
