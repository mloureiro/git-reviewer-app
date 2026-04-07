import { Router } from 'express';
import type { RepoRegistry } from '../git/repo-registry.js';
import { isValidRef } from './ref-validation.js';

export function createRefsRouter(registry: RepoRegistry): Router {
  const router = Router();

  // List branches and tags for the repo
  router.get('/refs', async (req, res) => {
    try {
      const [git] = registry.resolve(req.query.repo);
      const [branchResult, tagResult] = await Promise.all([git.branchLocal(), git.tag()]);

      const branches = branchResult.all;
      const currentBranch = branchResult.current;
      const tags = tagResult
        .split('\n')
        .map((t) => t.trim())
        .filter(Boolean);

      res.json({ branches, tags, currentBranch });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Resolve ref names to commit hashes (lightweight poll endpoint)
  router.get('/resolve-refs', async (req, res) => {
    try {
      const [git] = registry.resolve(req.query.repo);
      const refsParam = req.query.refs;
      if (typeof refsParam !== 'string' || refsParam.trim().length === 0) {
        res.status(400).json({ error: 'Missing required query param: refs (comma-separated)' });
        return;
      }

      const refNames = refsParam
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean);
      const refs: Record<string, string> = {};

      for (const refName of refNames) {
        if (!isValidRef(refName)) continue;
        try {
          const resolved = await git.revparse([refName]);
          refs[refName] = resolved.trim();
        } catch {
          // Skip unresolvable refs
        }
      }

      res.json({ refs });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  return router;
}
