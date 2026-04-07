import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SimpleGit } from 'simple-git';
import { RepoRegistry } from './repo-registry.js';

// ---------------------------------------------------------------------------
// Mock createGitClient so tests never touch the filesystem
// ---------------------------------------------------------------------------

vi.mock('./diff.js', () => ({
  createGitClient: vi.fn((path: string) => ({ baseDir: path }) as unknown as SimpleGit),
}));

import { createGitClient } from './diff.js';

const mockCreateGitClient = vi.mocked(createGitClient);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGit(label: string): SimpleGit {
  return { baseDir: label } as unknown as SimpleGit;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('RepoRegistry', () => {
  let registry: RepoRegistry;

  beforeEach(() => {
    vi.resetAllMocks();
    registry = new RepoRegistry();

    // Default mock: each call returns a unique SimpleGit-shaped object
    mockCreateGitClient.mockImplementation((p: string) => makeGit(p));
  });

  // -------------------------------------------------------------------------
  // registerRepo
  // -------------------------------------------------------------------------

  describe('registerRepo', () => {
    it('creates a git client for the given path and returns it', () => {
      const git = registry.registerRepo('/repo/a');

      expect(mockCreateGitClient).toHaveBeenCalledOnce();
      expect(mockCreateGitClient).toHaveBeenCalledWith('/repo/a');
      expect(git).toEqual(makeGit('/repo/a'));
    });

    it('returns the cached instance on a second call with the same path', () => {
      const first = registry.registerRepo('/repo/a');
      const second = registry.registerRepo('/repo/a');

      // createGitClient must only be called once
      expect(mockCreateGitClient).toHaveBeenCalledOnce();
      expect(second).toBe(first);
    });

    it('creates distinct clients for different paths', () => {
      registry.registerRepo('/repo/a');
      registry.registerRepo('/repo/b');

      expect(mockCreateGitClient).toHaveBeenCalledTimes(2);
    });
  });

  // -------------------------------------------------------------------------
  // Default election — first registration wins
  // -------------------------------------------------------------------------

  describe('default election', () => {
    it('sets the first registered path as the default', () => {
      registry.registerRepo('/repo/a');
      registry.registerRepo('/repo/b');

      expect(registry.getDefaultPath()).toBe('/repo/a');
    });

    it('re-registering the same path does not change the default', () => {
      registry.registerRepo('/repo/a');
      registry.registerRepo('/repo/b');
      registry.registerRepo('/repo/a'); // duplicate — should be no-op

      expect(registry.getDefaultPath()).toBe('/repo/a');
    });

    it('getDefaultRepo returns the git client for the default path', () => {
      const git = registry.registerRepo('/repo/a');
      registry.registerRepo('/repo/b');

      expect(registry.getDefaultRepo()).toBe(git);
    });
  });

  // -------------------------------------------------------------------------
  // getRepo
  // -------------------------------------------------------------------------

  describe('getRepo', () => {
    it('returns the registered client for a known path', () => {
      const git = registry.registerRepo('/repo/a');

      expect(registry.getRepo('/repo/a')).toBe(git);
    });

    it('throws for an unknown path', () => {
      expect(() => registry.getRepo('/repo/unknown')).toThrow(
        'Repository not registered: /repo/unknown',
      );
    });
  });

  // -------------------------------------------------------------------------
  // getDefaultRepo / getDefaultPath — empty registry
  // -------------------------------------------------------------------------

  describe('getDefaultRepo / getDefaultPath when empty', () => {
    it('getDefaultRepo throws when no repositories are registered', () => {
      expect(() => registry.getDefaultRepo()).toThrow('No repositories registered');
    });

    it('getDefaultPath throws when no repositories are registered', () => {
      expect(() => registry.getDefaultPath()).toThrow('No repositories registered');
    });
  });

  // -------------------------------------------------------------------------
  // resolve
  // -------------------------------------------------------------------------

  describe('resolve', () => {
    it('returns [git, path] for an explicit repo param that is registered', () => {
      registry.registerRepo('/repo/a');
      const gitB = registry.registerRepo('/repo/b');

      const [git, path] = registry.resolve('/repo/b');

      expect(git).toBe(gitB);
      expect(path).toBe('/repo/b');
    });

    it('falls back to the default repo when param is undefined', () => {
      const gitA = registry.registerRepo('/repo/a');
      registry.registerRepo('/repo/b');

      const [git, path] = registry.resolve(undefined);

      expect(git).toBe(gitA);
      expect(path).toBe('/repo/a');
    });

    it('falls back to the default repo when param is an empty string', () => {
      const gitA = registry.registerRepo('/repo/a');

      const [git, path] = registry.resolve('');

      expect(git).toBe(gitA);
      expect(path).toBe('/repo/a');
    });

    it('falls back to the default repo when param is null', () => {
      const gitA = registry.registerRepo('/repo/a');

      const [git, path] = registry.resolve(null);

      expect(git).toBe(gitA);
      expect(path).toBe('/repo/a');
    });

    it('falls back to the default repo when param is a number', () => {
      const gitA = registry.registerRepo('/repo/a');

      const [git, path] = registry.resolve(42);

      expect(git).toBe(gitA);
      expect(path).toBe('/repo/a');
    });

    it('throws when the explicit param is not registered', () => {
      registry.registerRepo('/repo/a');

      expect(() => registry.resolve('/repo/unknown')).toThrow(
        'Repository not registered: /repo/unknown',
      );
    });

    it('throws when param is undefined and no repos are registered', () => {
      expect(() => registry.resolve(undefined)).toThrow('No repositories registered');
    });
  });

  // -------------------------------------------------------------------------
  // listPaths
  // -------------------------------------------------------------------------

  describe('listPaths', () => {
    it('returns an empty array when no repos are registered', () => {
      expect(registry.listPaths()).toEqual([]);
    });

    it('returns all registered paths in insertion order', () => {
      registry.registerRepo('/repo/a');
      registry.registerRepo('/repo/b');
      registry.registerRepo('/repo/c');

      expect(registry.listPaths()).toEqual(['/repo/a', '/repo/b', '/repo/c']);
    });
  });

  // -------------------------------------------------------------------------
  // has
  // -------------------------------------------------------------------------

  describe('has', () => {
    it('returns false for an unregistered path', () => {
      expect(registry.has('/repo/a')).toBe(false);
    });

    it('returns true after a path is registered', () => {
      registry.registerRepo('/repo/a');

      expect(registry.has('/repo/a')).toBe(true);
    });

    it('returns false after the path is unregistered', () => {
      registry.registerRepo('/repo/a');
      registry.unregisterRepo('/repo/a');

      expect(registry.has('/repo/a')).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // unregisterRepo
  // -------------------------------------------------------------------------

  describe('unregisterRepo', () => {
    it('returns true when the path was registered', () => {
      registry.registerRepo('/repo/a');

      expect(registry.unregisterRepo('/repo/a')).toBe(true);
    });

    it('returns false when the path was not registered', () => {
      expect(registry.unregisterRepo('/repo/unknown')).toBe(false);
    });

    it('removes the path from the registry', () => {
      registry.registerRepo('/repo/a');
      registry.unregisterRepo('/repo/a');

      expect(registry.has('/repo/a')).toBe(false);
      expect(registry.listPaths()).toEqual([]);
    });

    // Default re-election after unregistering the default

    it('elects the next remaining path as default when the default is removed', () => {
      registry.registerRepo('/repo/a');
      registry.registerRepo('/repo/b');
      registry.registerRepo('/repo/c');

      registry.unregisterRepo('/repo/a');

      expect(registry.getDefaultPath()).toBe('/repo/b');
    });

    it('getDefaultRepo returns the newly elected default after the old default is removed', () => {
      registry.registerRepo('/repo/a');
      const gitB = registry.registerRepo('/repo/b');

      registry.unregisterRepo('/repo/a');

      expect(registry.getDefaultRepo()).toBe(gitB);
    });

    it('sets default to null when all repos are unregistered', () => {
      registry.registerRepo('/repo/a');
      registry.unregisterRepo('/repo/a');

      expect(() => registry.getDefaultPath()).toThrow('No repositories registered');
    });

    it('unregistering a non-default path does not change the default', () => {
      registry.registerRepo('/repo/a');
      registry.registerRepo('/repo/b');

      registry.unregisterRepo('/repo/b');

      expect(registry.getDefaultPath()).toBe('/repo/a');
    });

    it('unregistering an already-removed path a second time returns false', () => {
      registry.registerRepo('/repo/a');
      registry.unregisterRepo('/repo/a');

      expect(registry.unregisterRepo('/repo/a')).toBe(false);
    });
  });
});
