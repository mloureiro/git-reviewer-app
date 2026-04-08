import { resolve } from 'node:path';
import type { SimpleGit } from 'simple-git';
import { createGitClient } from './diff.js';

/**
 * Manages multiple git repositories. Each repo is identified by its absolute path.
 * The first registered repo is the default.
 */
export class RepoRegistry {
  private repos = new Map<string, SimpleGit>();
  private defaultPath: string | null = null;

  registerRepo(repoPath: string): SimpleGit {
    const normalizedPath = resolve(repoPath);
    const existing = this.repos.get(normalizedPath);
    if (existing) {
      return existing;
    }

    const git = createGitClient(normalizedPath);
    this.repos.set(normalizedPath, git);

    if (this.defaultPath == null) {
      this.defaultPath = normalizedPath;
    }

    return git;
  }

  getRepo(repoPath: string): SimpleGit {
    const normalizedPath = resolve(repoPath);
    const git = this.repos.get(normalizedPath);
    if (!git) {
      throw new Error(`Repository not registered: ${normalizedPath}`);
    }
    return git;
  }

  getDefaultRepo(): SimpleGit {
    if (this.defaultPath == null) {
      throw new Error('No repositories registered');
    }
    // defaultPath is guaranteed to be in the map after registerRepo
    return this.repos.get(this.defaultPath) as SimpleGit;
  }

  getDefaultPath(): string {
    if (this.defaultPath == null) {
      throw new Error('No repositories registered');
    }
    return this.defaultPath;
  }

  /**
   * Resolve a repo path from a query param, falling back to the default.
   * Returns [git, repoPath] tuple.
   */
  resolve(repoParam: unknown): [SimpleGit, string] {
    if (typeof repoParam === 'string' && repoParam.length > 0) {
      const normalizedPath = resolve(repoParam);
      return [this.getRepo(normalizedPath), normalizedPath];
    }
    const defaultPath = this.getDefaultPath();
    return [this.getDefaultRepo(), defaultPath];
  }

  listPaths(): string[] {
    return [...this.repos.keys()];
  }

  has(repoPath: string): boolean {
    return this.repos.has(resolve(repoPath));
  }

  unregisterRepo(repoPath: string): boolean {
    const normalizedPath = resolve(repoPath);
    const deleted = this.repos.delete(normalizedPath);
    if (deleted && this.defaultPath === normalizedPath) {
      const firstKey = this.repos.keys().next();
      this.defaultPath = firstKey.done ? null : firstKey.value;
    }
    return deleted;
  }
}
