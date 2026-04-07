import { Router } from 'express';
import {
  getDiffText,
  getUncommittedDiffText,
  getChangedFiles,
  getUncommittedChangedFiles,
  getFileDiffHashes,
} from '../git/diff.js';
import { getCommitDiffText, getCommitChangedFiles } from '../git/commits.js';
import type { RepoRegistry } from '../git/repo-registry.js';
import { validateCommitHash } from './middleware.js';
import { isValidRef } from './ref-validation.js';

export function createDiffsRouter(registry: RepoRegistry): Router {
  const router = Router();

  // Get diff between base and head
  router.get('/diff', async (req, res) => {
    try {
      const { base, head, uncommitted, repo } = req.query;
      const [git] = registry.resolve(repo);

      if (uncommitted !== 'true') {
        const resolvedBase = base ?? 'main';
        const resolvedHead = head ?? 'HEAD';
        if (!isValidRef(resolvedBase)) {
          res.status(400).json({ error: 'Invalid base ref: contains unsafe characters' });
          return;
        }
        if (!isValidRef(resolvedHead)) {
          res.status(400).json({ error: 'Invalid head ref: contains unsafe characters' });
          return;
        }
      }

      const diffText =
        uncommitted === 'true'
          ? await getUncommittedDiffText(git)
          : await getDiffText(git, String(base ?? 'main'), String(head ?? 'HEAD'));

      res.json({ diff: diffText });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Get changed files between base and head
  router.get('/files', async (req, res) => {
    try {
      const { base, head, uncommitted, repo } = req.query;
      const [git] = registry.resolve(repo);

      if (uncommitted !== 'true') {
        const resolvedBase = base ?? 'main';
        const resolvedHead = head ?? 'HEAD';
        if (!isValidRef(resolvedBase)) {
          res.status(400).json({ error: 'Invalid base ref: contains unsafe characters' });
          return;
        }
        if (!isValidRef(resolvedHead)) {
          res.status(400).json({ error: 'Invalid head ref: contains unsafe characters' });
          return;
        }
      }

      const isUncommitted = uncommitted === 'true';
      const files = isUncommitted
        ? await getUncommittedChangedFiles(git)
        : await getChangedFiles(git, String(base ?? 'main'), String(head ?? 'HEAD'));

      const diffText = isUncommitted
        ? await getUncommittedDiffText(git)
        : await getDiffText(git, String(base ?? 'main'), String(head ?? 'HEAD'));

      const diffHashes = getFileDiffHashes(diffText);

      res.json({ files, diffHashes });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Get diff for a single commit
  router.get('/commits/:commitHash/diff', validateCommitHash, async (req, res) => {
    try {
      const [git] = registry.resolve(req.query.repo);
      const commitHash = req.params.commitHash ?? '';
      const diff = await getCommitDiffText(git, commitHash);
      res.json({ diff });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Get changed files for a single commit
  router.get('/commits/:commitHash/files', validateCommitHash, async (req, res) => {
    try {
      const [git] = registry.resolve(req.query.repo);
      const commitHash = req.params.commitHash ?? '';
      const files = await getCommitChangedFiles(git, commitHash);
      const diffText = await getCommitDiffText(git, commitHash);
      const diffHashes = getFileDiffHashes(diffText);

      res.json({ files, diffHashes });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  return router;
}
