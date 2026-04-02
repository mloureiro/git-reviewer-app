import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimpleGit } from 'simple-git';
import { validateRefs, createAutoSession, resolveRefName } from './session.js';

// Mock writeReviewNote so createAutoSession doesn't need real git-notes
vi.mock('./notes.js', () => ({
  writeReviewNote: vi.fn().mockResolvedValue(undefined),
}));

const mockRevparse = vi.fn();
const mockStatus = vi.fn();

const mockGit = {
  revparse: mockRevparse,
  status: mockStatus,
} as unknown as SimpleGit;

const HEAD_SHA = 'deadbeef1234deadbeef1234deadbeef12345678';
const BASE_SHA = 'cafecafe5678cafecafe5678cafecafe56789012';

describe('validateRefs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ---------------------------------------------------------------------------
  // --uncommitted mode
  // ---------------------------------------------------------------------------
  describe('uncommitted mode', () => {
    it('resolves HEAD commit and returns it as both base and head when there are changes', async () => {
      mockStatus.mockResolvedValue({
        modified: ['src/foo.ts'],
        staged: [],
        created: [],
        deleted: [],
        renamed: [],
        conflicted: [],
      });
      mockRevparse.mockResolvedValue(`${HEAD_SHA}\n`);

      const result = await validateRefs(mockGit, { uncommitted: true });

      expect(result).toEqual({ baseCommit: HEAD_SHA, headCommit: HEAD_SHA });
      expect(mockRevparse).toHaveBeenCalledWith(['HEAD']);
    });

    it('throws when there are no uncommitted changes', async () => {
      mockStatus.mockResolvedValue({
        modified: [],
        staged: [],
        created: [],
        deleted: [],
        renamed: [],
        conflicted: [],
      });

      await expect(validateRefs(mockGit, { uncommitted: true })).rejects.toThrow(
        '--uncommitted was specified but there are no uncommitted changes',
      );
    });

    it('detects staged files as uncommitted changes', async () => {
      mockStatus.mockResolvedValue({
        modified: [],
        staged: ['src/bar.ts'],
        created: [],
        deleted: [],
        renamed: [],
        conflicted: [],
      });
      mockRevparse.mockResolvedValue(`${HEAD_SHA}\n`);

      const result = await validateRefs(mockGit, { uncommitted: true });
      expect(result.baseCommit).toBe(HEAD_SHA);
    });

    it('detects created files as uncommitted changes', async () => {
      mockStatus.mockResolvedValue({
        modified: [],
        staged: [],
        created: ['src/new.ts'],
        deleted: [],
        renamed: [],
        conflicted: [],
      });
      mockRevparse.mockResolvedValue(`${HEAD_SHA}\n`);

      const result = await validateRefs(mockGit, { uncommitted: true });
      expect(result.baseCommit).toBe(HEAD_SHA);
    });

    it('detects deleted files as uncommitted changes', async () => {
      mockStatus.mockResolvedValue({
        modified: [],
        staged: [],
        created: [],
        deleted: ['src/old.ts'],
        renamed: [],
        conflicted: [],
      });
      mockRevparse.mockResolvedValue(`${HEAD_SHA}\n`);

      const result = await validateRefs(mockGit, { uncommitted: true });
      expect(result.baseCommit).toBe(HEAD_SHA);
    });

    it('detects renamed files as uncommitted changes', async () => {
      mockStatus.mockResolvedValue({
        modified: [],
        staged: [],
        created: [],
        deleted: [],
        renamed: [{ from: 'a.ts', to: 'b.ts' }],
        conflicted: [],
      });
      mockRevparse.mockResolvedValue(`${HEAD_SHA}\n`);

      const result = await validateRefs(mockGit, { uncommitted: true });
      expect(result.baseCommit).toBe(HEAD_SHA);
    });

    it('detects conflicted files as uncommitted changes', async () => {
      mockStatus.mockResolvedValue({
        modified: [],
        staged: [],
        created: [],
        deleted: [],
        renamed: [],
        conflicted: ['src/conflict.ts'],
      });
      mockRevparse.mockResolvedValue(`${HEAD_SHA}\n`);

      const result = await validateRefs(mockGit, { uncommitted: true });
      expect(result.baseCommit).toBe(HEAD_SHA);
    });

    it('throws a descriptive error when HEAD cannot be resolved', async () => {
      mockStatus.mockResolvedValue({
        modified: ['src/foo.ts'],
        staged: [],
        created: [],
        deleted: [],
        renamed: [],
        conflicted: [],
      });
      mockRevparse.mockRejectedValue(new Error('fatal: not a git repository'));

      await expect(validateRefs(mockGit, { uncommitted: true })).rejects.toThrow(
        'Could not resolve HEAD',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // base / head ref mode
  // ---------------------------------------------------------------------------
  describe('base/head ref mode', () => {
    it('resolves both base and head refs and returns their commit SHAs', async () => {
      // Promise.all order: [revparse(base), revparse(head)]
      mockRevparse.mockResolvedValueOnce(`${BASE_SHA}\n`); // base = main
      mockRevparse.mockResolvedValueOnce(`${HEAD_SHA}\n`); // head = HEAD

      const result = await validateRefs(mockGit, { base: 'main', head: 'HEAD' });

      expect(result).toEqual({ baseCommit: BASE_SHA, headCommit: HEAD_SHA });
    });

    it('defaults head to HEAD when only base is provided', async () => {
      // Promise.all order: [revparse(base), revparse(head='HEAD')]
      mockRevparse.mockResolvedValueOnce(`${BASE_SHA}\n`); // main
      mockRevparse.mockResolvedValueOnce(`${HEAD_SHA}\n`); // HEAD

      const result = await validateRefs(mockGit, { base: 'main' });

      expect(result).toEqual({ baseCommit: BASE_SHA, headCommit: HEAD_SHA });
      expect(mockRevparse).toHaveBeenCalledWith(['HEAD']);
    });

    it('throws when --base is not provided and --uncommitted is not set', async () => {
      await expect(validateRefs(mockGit, {})).rejects.toThrow(
        '--base <ref> is required unless --uncommitted is used.',
      );
    });

    it('throws a descriptive error when base ref is invalid', async () => {
      // Promise.all order: [revparse(base), revparse(head)]
      // base fails, head succeeds — Promise.all rejects with base error
      mockRevparse.mockRejectedValueOnce(new Error('fatal: ambiguous argument')); // base fails
      mockRevparse.mockResolvedValueOnce(`${HEAD_SHA}\n`); // head succeeds

      await expect(validateRefs(mockGit, { base: 'nonexistent', head: 'HEAD' })).rejects.toThrow(
        "Invalid --base ref: 'nonexistent' does not exist",
      );
    });

    it('throws a descriptive error when head ref is invalid', async () => {
      // Promise.all order: [revparse(base), revparse(head)]
      // base succeeds, head fails
      mockRevparse.mockResolvedValueOnce(`${BASE_SHA}\n`); // base succeeds
      mockRevparse.mockRejectedValueOnce(new Error('fatal: ambiguous argument')); // head fails

      await expect(validateRefs(mockGit, { base: 'main', head: 'bad-ref' })).rejects.toThrow(
        "Invalid --head ref: 'bad-ref' does not exist",
      );
    });
  });
});

describe('resolveRefName', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns the ref as-is when it is not HEAD', async () => {
    const result = await resolveRefName(mockGit, 'my-branch', 'HEAD');
    expect(result).toBe('my-branch');
    expect(mockRevparse).not.toHaveBeenCalled();
  });

  it('uses fallback when ref is undefined', async () => {
    mockRevparse.mockResolvedValue('main\n');
    const result = await resolveRefName(mockGit, undefined, 'HEAD');
    expect(result).toBe('main');
  });

  it('returns fallback as-is when it is not HEAD', async () => {
    const result = await resolveRefName(mockGit, undefined, 'develop');
    expect(result).toBe('develop');
    expect(mockRevparse).not.toHaveBeenCalled();
  });

  it('resolves HEAD to branch name', async () => {
    mockRevparse.mockResolvedValue('feature-branch\n');
    const result = await resolveRefName(mockGit, 'HEAD', 'HEAD');
    expect(result).toBe('feature-branch');
    expect(mockRevparse).toHaveBeenCalledWith(['--abbrev-ref', 'HEAD']);
  });

  it('falls back to short hash on detached HEAD', async () => {
    mockRevparse
      .mockResolvedValueOnce('HEAD\n') // --abbrev-ref returns 'HEAD'
      .mockResolvedValueOnce('deadbeef12\n'); // --short=10

    const result = await resolveRefName(mockGit, undefined, 'HEAD');
    expect(result).toBe('deadbeef12');
    expect(mockRevparse).toHaveBeenCalledWith(['--short=10', 'HEAD']);
  });

  it('returns raw HEAD if all resolution fails', async () => {
    mockRevparse.mockResolvedValue('\n');
    const result = await resolveRefName(mockGit, undefined, 'HEAD');
    expect(result).toBe('HEAD');
  });
});

describe('createAutoSession', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('creates a session with correct refs for base/head mode', async () => {
    const result = await createAutoSession(mockGit, {
      base: 'main',
      head: 'feature',
      baseCommit: BASE_SHA,
      headCommit: HEAD_SHA,
    });

    expect(result.version).toBe(1);
    expect(result.session.baseRef).toBe('main');
    expect(result.session.headRef).toBe('feature');
    expect(result.session.baseCommit).toBe(BASE_SHA);
    expect(result.session.headCommit).toBe(HEAD_SHA);
    expect(result.session.status).toBe('pending');
    expect(result.session.title).toBe('Review main..feature');
    expect(result.comments).toEqual([]);
    expect(result.session.id).toBeTruthy();
    expect(result.session.createdAt).toBeTruthy();
  });

  it('creates a session with correct refs for uncommitted mode', async () => {
    const result = await createAutoSession(mockGit, {
      uncommitted: true,
      baseCommit: HEAD_SHA,
      headCommit: HEAD_SHA,
    });

    expect(result.session.baseRef).toBe(HEAD_SHA);
    expect(result.session.headRef).toBe('working tree');
    expect(result.session.title).toBe('Uncommitted changes');
  });

  it('resolves HEAD to branch name when neither base nor head is provided', async () => {
    mockRevparse.mockResolvedValue('my-branch\n');

    const result = await createAutoSession(mockGit, {
      baseCommit: BASE_SHA,
      headCommit: HEAD_SHA,
    });

    expect(result.session.baseRef).toBe('my-branch');
    expect(result.session.headRef).toBe('my-branch');
    expect(result.session.title).toBe('Review my-branch..my-branch');
  });

  it('resolves HEAD to short commit hash on detached HEAD', async () => {
    // First call: --abbrev-ref returns 'HEAD' (detached)
    // Second call: --short=10 returns short hash
    mockRevparse
      .mockResolvedValueOnce('HEAD\n') // base: --abbrev-ref
      .mockResolvedValueOnce('deadbeef12\n') // base: --short=10
      .mockResolvedValueOnce('HEAD\n') // head: --abbrev-ref
      .mockResolvedValueOnce('deadbeef12\n'); // head: --short=10

    const result = await createAutoSession(mockGit, {
      baseCommit: BASE_SHA,
      headCommit: HEAD_SHA,
    });

    expect(result.session.baseRef).toBe('deadbeef12');
    expect(result.session.headRef).toBe('deadbeef12');
  });

  it('writes the session to git-notes via writeReviewNote', async () => {
    const { writeReviewNote } = await import('./notes.js');
    const mockWriteReviewNote = vi.mocked(writeReviewNote);

    // head defaults to HEAD → resolveRefName calls revparse
    mockRevparse.mockResolvedValue('feature-branch\n');

    await createAutoSession(mockGit, {
      base: 'main',
      baseCommit: BASE_SHA,
      headCommit: HEAD_SHA,
    });

    expect(mockWriteReviewNote).toHaveBeenCalledWith(mockGit, HEAD_SHA, expect.any(Object));
  });
});
