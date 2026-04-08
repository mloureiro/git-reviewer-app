import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  fetchFiles,
  fetchDiff,
  fetchSessions,
  fetchSession,
  createSession,
  fetchComments,
  postComment,
  patchComment,
  updateSessionStatus,
} from './reviews';
import * as client from './client';
import type { ReviewData, DiffFile } from '../types/review';

vi.mock('./client', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
}));

const mockApiGet = vi.mocked(client.apiGet);
const mockApiPost = vi.mocked(client.apiPost);
const mockApiPatch = vi.mocked(client.apiPatch);

const SESSION_SHA = 'deadbeef1234';

const sampleSession: ReviewData = {
  version: 1,
  session: {
    id: 'session-1',
    title: 'Test Review',
    baseRef: 'main',
    headRef: 'HEAD',
    baseCommit: 'base123',
    headCommit: SESSION_SHA,
    status: 'pending',
    createdAt: '2026-03-19T00:00:00Z',
    updatedAt: '2026-03-19T00:00:00Z',
  },
  comments: [],
};

const sampleFiles: DiffFile[] = [
  { path: 'src/foo.ts', status: 'modified', additions: 5, deletions: 2 },
  { path: 'src/bar.ts', status: 'added', additions: 10, deletions: 0 },
];

describe('fetchFiles', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calls apiGet with base and head query params', async () => {
    mockApiGet.mockResolvedValue({ files: sampleFiles });

    const result = await fetchFiles({ base: 'main', head: 'HEAD' });

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/files?base=main&head=HEAD');
    expect(result).toEqual({ files: sampleFiles });
  });

  it('calls apiGet with uncommitted param', async () => {
    mockApiGet.mockResolvedValue({ files: sampleFiles });

    await fetchFiles({ uncommitted: 'true' });

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/files?uncommitted=true');
  });

  it('calls apiGet with no query string when params are empty', async () => {
    mockApiGet.mockResolvedValue({ files: [] });

    await fetchFiles({});

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/files');
  });
});

describe('fetchDiff', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calls apiGet with base and head query params', async () => {
    mockApiGet.mockResolvedValue({ diff: 'some diff' });

    const result = await fetchDiff({ base: 'main', head: 'HEAD' });

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/diff?base=main&head=HEAD');
    expect(result).toEqual({ diff: 'some diff' });
  });

  it('calls apiGet with uncommitted param', async () => {
    mockApiGet.mockResolvedValue({ diff: '' });

    await fetchDiff({ uncommitted: 'true' });

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/diff?uncommitted=true');
  });

  it('calls apiGet with no query string when params are empty', async () => {
    mockApiGet.mockResolvedValue({ diff: '' });

    await fetchDiff({});

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/diff');
  });
});

describe('fetchSessions', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calls apiGet for /api/sessions and returns the response', async () => {
    mockApiGet.mockResolvedValue({ sessions: [sampleSession] });

    const result = await fetchSessions();

    expect(mockApiGet).toHaveBeenCalledWith('/api/v1/sessions');
    expect(result).toEqual({ sessions: [sampleSession] });
  });
});

describe('fetchSession', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calls apiGet for /api/sessions/:sha and returns the session', async () => {
    mockApiGet.mockResolvedValue({ session: sampleSession });

    const result = await fetchSession(SESSION_SHA);

    expect(mockApiGet).toHaveBeenCalledWith(`/api/v1/sessions/${SESSION_SHA}`);
    expect(result).toEqual({ session: sampleSession });
  });
});

describe('createSession', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calls apiPost for /api/sessions with the request body', async () => {
    mockApiPost.mockResolvedValue({ session: sampleSession });

    const result = await createSession({ title: 'Test', baseRef: 'main', headRef: 'HEAD' });

    expect(mockApiPost).toHaveBeenCalledWith('/api/v1/sessions', {
      title: 'Test',
      baseRef: 'main',
      headRef: 'HEAD',
    });
    expect(result).toEqual({ session: sampleSession });
  });
});

describe('fetchComments', () => {
  beforeEach(() => vi.resetAllMocks());

  it('fetches the session and extracts comments', async () => {
    const sessionWithComments: ReviewData = {
      ...sampleSession,
      comments: [
        {
          id: 'c1',
          file: 'src/foo.ts',
          line: 1,
          side: 'right',
          body: 'Nice',
          author: 'reviewer',
          createdAt: '2026-03-19T01:00:00Z',
          resolved: false,
        },
      ],
    };
    mockApiGet.mockResolvedValue({ session: sessionWithComments });

    const result = await fetchComments(SESSION_SHA);

    expect(result).toEqual({ comments: sessionWithComments.comments });
    expect(mockApiGet).toHaveBeenCalledWith(`/api/v1/sessions/${SESSION_SHA}`);
  });

  it('returns empty comments array when session has none', async () => {
    mockApiGet.mockResolvedValue({ session: sampleSession });

    const result = await fetchComments(SESSION_SHA);

    expect(result).toEqual({ comments: [] });
  });
});

describe('postComment', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calls apiPost for /api/sessions/:sha/comments with the comment data', async () => {
    const newComment = {
      id: 'c2',
      file: 'src/bar.ts',
      line: 5,
      side: 'right' as const,
      body: 'Fix this',
      author: 'reviewer',
      createdAt: '2026-03-19T02:00:00Z',
      resolved: false,
    };
    mockApiPost.mockResolvedValue(newComment);

    const result = await postComment(SESSION_SHA, {
      file: 'src/bar.ts',
      line: 5,
      side: 'right',
      body: 'Fix this',
      author: 'reviewer',
    });

    expect(mockApiPost).toHaveBeenCalledWith(`/api/v1/sessions/${SESSION_SHA}/comments`, {
      file: 'src/bar.ts',
      line: 5,
      side: 'right',
      body: 'Fix this',
      author: 'reviewer',
    });
    expect(result).toEqual(newComment);
  });
});

describe('patchComment', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calls apiPatch for /api/sessions/:sha/comments/:id with resolved flag', async () => {
    const updated = {
      id: 'c1',
      file: 'src/foo.ts',
      line: 1,
      side: 'right' as const,
      body: 'Nice',
      author: 'reviewer',
      createdAt: '2026-03-19T01:00:00Z',
      resolved: true,
    };
    mockApiPatch.mockResolvedValue(updated);

    const result = await patchComment(SESSION_SHA, 'c1', { resolved: true });

    expect(mockApiPatch).toHaveBeenCalledWith(`/api/v1/sessions/${SESSION_SHA}/comments/c1`, {
      resolved: true,
    });
    expect(result).toEqual(updated);
  });
});

describe('updateSessionStatus', () => {
  beforeEach(() => vi.resetAllMocks());

  it('calls apiPatch for /api/sessions/:sha with status update', async () => {
    const updatedSession = {
      ...sampleSession,
      session: { ...sampleSession.session, status: 'approved' as const },
    };
    mockApiPatch.mockResolvedValue({ session: updatedSession });

    const result = await updateSessionStatus(SESSION_SHA, { status: 'approved' });

    expect(mockApiPatch).toHaveBeenCalledWith(`/api/v1/sessions/${SESSION_SHA}`, {
      status: 'approved',
    });
    expect(result).toEqual({ session: updatedSession });
  });
});
