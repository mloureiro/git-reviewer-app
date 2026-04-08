import { Router } from 'express';
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
  router.post('/repos', (req, res, next) => {
    const { path: repoPath } = req.body as { path: string };
    if (typeof repoPath !== 'string' || repoPath.trim().length === 0) {
      res.status(400).json({ error: 'Invalid body: path must be a non-empty string' });
      return;
    }
    try {
      registry.registerRepo(repoPath);
      res.status(201).json({ path: repoPath });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
