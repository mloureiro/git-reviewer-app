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
    const existing = this.repos.get(repoPath);
    if (existing) {
      return existing;
    }

    const git = createGitClient(repoPath);
    this.repos.set(repoPath, git);

    if (this.defaultPath == null) {
      this.defaultPath = repoPath;
    }

    return git;
  }

  getRepo(repoPath: string): SimpleGit {
    const git = this.repos.get(repoPath);
    if (!git) {
      throw new Error(`Repository not registered: ${repoPath}`);
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
      return [this.getRepo(repoParam), repoParam];
    }
    const defaultPath = this.getDefaultPath();
    return [this.getDefaultRepo(), defaultPath];
  }

  listPaths(): string[] {
    return [...this.repos.keys()];
  }

  has(repoPath: string): boolean {
    return this.repos.has(repoPath);
  }
}
