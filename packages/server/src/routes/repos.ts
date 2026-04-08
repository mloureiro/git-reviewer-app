import { Router } from 'express';
import { createGitClient } from '../git/diff.js';
import { cleanupOrphanedNotes } from '../git/notes.js';
import type { RepoRegistry } from '../git/repo-registry.js';

export function createReposRouter(registry: RepoRegistry): Router {
  const router = Router();

  // List registered repos
  router.get('/repos', (_req, res) => {
    res.json({ repos: registry.listPaths() });
  });

  // Unregister a repo
  router.delete('/repos', (req, res) => {
    const repoPath =
      (typeof req.query.path === 'string' && req.query.path) ||
      (req.body as { path?: string })?.path;
    if (typeof repoPath !== 'string' || repoPath.trim().length === 0) {
      res.status(400).json({ error: 'path is required (query param or body)' });
      return;
    }
    const removed = registry.unregisterRepo(repoPath);
    if (!removed) {
      res.status(404).json({ error: 'Repository not registered' });
      return;
    }
    res.json({ path: repoPath });
  });

  // Register a new repo
  router.post('/repos', async (req, res, next) => {
    const { path: repoPath } = req.body as { path: string };
    if (typeof repoPath !== 'string' || repoPath.trim().length === 0) {
      res.status(400).json({ error: 'Invalid body: path must be a non-empty string' });
      return;
    }
    try {
      // Verify the path is an actual git repository before registering
      const git = createGitClient(repoPath);
      await git.revparse(['--git-dir']);
    } catch {
      res.status(400).json({ error: 'Invalid path: not a git repository' });
      return;
    }
    try {
      registry.registerRepo(repoPath);
      res.status(201).json({ path: repoPath });
    } catch (error) {
      next(error);
    }
  });

  // Trigger orphaned notes cleanup for a specific registered repo.
  // A note is considered orphaned when the commit it references no longer exists
  // (e.g. after a force-push, rebase, or garbage collection).
  router.post('/repos/cleanup', async (req, res, next) => {
    try {
      const repoPath =
        (typeof req.query.path === 'string' && req.query.path) ||
        (req.body as { path?: string })?.path;

      const [git] = registry.resolve(typeof repoPath === 'string' ? repoPath : undefined);
      const result = await cleanupOrphanedNotes(git);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
