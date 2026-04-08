import { Router } from 'express';
import type { SimpleGit } from 'simple-git';
import { getCommitList } from '../git/commits.js';
import { getUncommittedChangedFiles } from '../git/diff.js';
import { listReviewNotes, readReviewNote } from '../git/notes.js';
import type { RepoRegistry } from '../git/repo-registry.js';
import { validateCommitSha, resolveRepo, type ResolvedRepoLocals } from './middleware.js';
import { isUncommittedSession, isValidRef } from './ref-validation.js';
import {
  getSession,
  createSession,
  deleteSession,
  updateStatus,
  markFileViewed,
  unmarkFileViewed,
  setAutoMarkRules,
  applyAutoMarkRules,
} from '../services/session-service.js';
import type {
  AutoMarkRule,
  ReviewStatus,
  SessionHealth,
  SessionStats,
  CreateSessionRequest,
  UpdateSessionStatusRequest,
  AutoMarkRulesRequest,
} from '@git-reviewer/shared';

const VALID_STATUSES: ReadonlyArray<ReviewStatus> = ['pending', 'approved', 'changes_requested'];

const VALID_AUTO_MARK_RULES: ReadonlyArray<AutoMarkRule> = [
  'rename-only',
  'import-only',
  'whitespace-only',
  'lockfile',
  'generated',
];

export function createSessionsRouter(registry: RepoRegistry): Router {
  const router = Router();

  const sessionMiddleware = [validateCommitSha, resolveRepo(registry)] as const;

  // List all review sessions (aggregated across all registered repos)
  router.get('/sessions', async (req, res, next) => {
    try {
      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 20));

      const repoPaths = registry.listPaths();

      // Fetch notes for all repos in parallel, then read each note in parallel.
      // readReviewNote returns null on error so Promise.all is safe here.
      const perRepoSessions = await Promise.all(
        repoPaths.map(async (repoPath) => {
          const [git] = registry.resolve(repoPath);
          const notes = await listReviewNotes(git);

          const dataList = await Promise.all(
            notes.map(({ commitHash }) => readReviewNote(git, commitHash)),
          );

          return dataList.flatMap((data) => {
            if (!data) return [];
            // Ensure repoPath is set on the session for grouping
            if (data.session.repoPath == null) {
              data.session.repoPath = repoPath;
            }
            return [data];
          });
        }),
      );

      const allSessions = perRepoSessions.flat();
      const total = allSessions.length;
      const offset = (page - 1) * limit;
      const sessions = allSessions.slice(offset, offset + limit);

      res.json({ sessions, total, page, limit });
    } catch (error) {
      next(error);
    }
  });

  // Validate all review sessions (check if refs still exist, detect empty diffs)
  // Also returns diff stats (files, additions, deletions) for healthy sessions.
  router.get('/sessions/validate', async (_req, res, next) => {
    try {
      const health: Record<string, SessionHealth> = {};
      const stats: Record<string, SessionStats> = {};
      const repoPaths = registry.listPaths();

      type NoteValidationResult = {
        commitHash: string;
        health: SessionHealth;
        stats?: SessionStats;
      };

      /**
       * Validate a single note and return its health + optional stats.
       * All git errors are caught internally so Promise.all stays stable.
       */
      async function validateNote(
        git: SimpleGit,
        commitHash: string,
      ): Promise<NoteValidationResult | null> {
        const data = await readReviewNote(git, commitHash);
        if (!data) return null;

        const { baseRef, headRef } = data.session;

        if (isUncommittedSession(headRef)) {
          // For uncommitted sessions, 'working tree' is not a git ref.
          // Validate by checking if the base ref resolves and whether
          // there are any uncommitted changes in the working tree.
          let baseResolved: string | null = null;
          try {
            baseResolved = await git.revparse([baseRef]);
          } catch {
            // baseRef no longer exists
          }

          if (baseResolved == null) {
            return { commitHash, health: { status: 'stale', reason: 'base-ref-missing' } };
          }

          // Check whether there are uncommitted changes to review
          try {
            const files = await getUncommittedChangedFiles(git);
            if (files.length === 0) {
              return { commitHash, health: { status: 'stale', reason: 'no-changes' } };
            }
            return {
              commitHash,
              health: { status: 'ok' },
              stats: {
                files: files.length,
                additions: files.reduce((sum, f) => sum + f.additions, 0),
                deletions: files.reduce((sum, f) => sum + f.deletions, 0),
              },
            };
          } catch {
            // If we can't determine changes, treat as ok to avoid false stale warnings
            return { commitHash, health: { status: 'ok' } };
          }
        }

        // Committed session: resolve both refs in parallel
        const [baseResult, headResult] = await Promise.all([
          git
            .revparse([baseRef])
            .then((v) => v)
            .catch(() => null),
          git
            .revparse([headRef])
            .then((v) => v)
            .catch(() => null),
        ]);

        if (baseResult == null && headResult == null) {
          return { commitHash, health: { status: 'stale', reason: 'both-refs-missing' } };
        }
        if (baseResult == null) {
          return { commitHash, health: { status: 'stale', reason: 'base-ref-missing' } };
        }
        if (headResult == null) {
          return { commitHash, health: { status: 'stale', reason: 'head-ref-missing' } };
        }
        if (baseResult.trim() === headResult.trim()) {
          return { commitHash, health: { status: 'stale', reason: 'no-changes' } };
        }

        // Compute lightweight diff stats for healthy sessions
        let noteStats: SessionStats | undefined;
        try {
          const summary = await git.diffSummary([`${baseResult.trim()}...${headResult.trim()}`]);
          noteStats = {
            files: summary.changed,
            additions: summary.insertions,
            deletions: summary.deletions,
          };
        } catch {
          // Stats are best-effort
        }

        return { commitHash, health: { status: 'ok' }, stats: noteStats };
      }

      // Fetch notes for all repos in parallel, then validate each note in parallel.
      await Promise.all(
        repoPaths.map(async (repoPath) => {
          const [git] = registry.resolve(repoPath);
          const notes = await listReviewNotes(git);

          const results = await Promise.all(
            notes.map(({ commitHash }) => validateNote(git, commitHash)),
          );

          for (const result of results) {
            if (!result) continue;
            health[result.commitHash] = result.health;
            if (result.stats != null) {
              stats[result.commitHash] = result.stats;
            }
          }
        }),
      );

      res.json({ health, stats });
    } catch (error) {
      next(error);
    }
  });

  // Get a specific review session
  router.get('/sessions/:commitSha', ...sessionMiddleware, async (req, res, next) => {
    try {
      const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
      const commitSha = req.params.commitSha ?? '';

      const data = await getSession(git, commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }
      res.json({ session: data });
    } catch (error) {
      next(error);
    }
  });

  // Get commits for a session's base..head range
  router.get('/sessions/:commitSha/commits', ...sessionMiddleware, async (req, res, next) => {
    try {
      const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
      const commitSha = req.params.commitSha ?? '';

      const data = await getSession(git, commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      const commits = await getCommitList(git, data.session.baseCommit, data.session.headCommit);
      res.json({ commits });
    } catch (error) {
      next(error);
    }
  });

  // Create a new review session
  router.post('/sessions', async (req, res, next) => {
    try {
      const [git, repoPath] = registry.resolve(req.query.repo);
      const { title, baseRef, headRef } = req.body as CreateSessionRequest;

      if (typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({ error: 'Invalid body: title must be a non-empty string' });
        return;
      }
      if (typeof baseRef !== 'string' || baseRef.trim().length === 0) {
        res.status(400).json({ error: 'Invalid body: baseRef must be a non-empty string' });
        return;
      }
      if (typeof headRef !== 'string' || headRef.trim().length === 0) {
        res.status(400).json({ error: 'Invalid body: headRef must be a non-empty string' });
        return;
      }
      if (!isValidRef(baseRef)) {
        res.status(400).json({ error: 'Invalid baseRef: contains unsafe characters' });
        return;
      }
      if (!isValidRef(headRef)) {
        res.status(400).json({ error: 'Invalid headRef: contains unsafe characters' });
        return;
      }

      const data = await createSession(git, { title, baseRef, headRef, repoPath });
      res.status(201).json({ session: data });
    } catch (error) {
      next(error);
    }
  });

  // Mark a file as viewed
  router.post('/sessions/:commitSha/viewed-files', ...sessionMiddleware, async (req, res, next) => {
    try {
      const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
      const commitSha = req.params.commitSha ?? '';

      const { path } = req.body as { path: string };
      if (typeof path !== 'string' || path.trim().length === 0) {
        res.status(400).json({ error: 'Invalid body: path must be a non-empty string' });
        return;
      }

      const viewedFile = await markFileViewed(git, commitSha, path);
      if (!viewedFile) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      res.status(201).json(viewedFile);
    } catch (error) {
      next(error);
    }
  });

  // Unmark a file as viewed
  router.delete(
    '/sessions/:commitSha/viewed-files/:filePath',
    ...sessionMiddleware,
    async (req, res, next) => {
      try {
        const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
        const commitSha = req.params.commitSha ?? '';

        const filePath = decodeURIComponent(req.params.filePath ?? '');

        const found = await unmarkFileViewed(git, commitSha, filePath);
        if (!found) {
          res.status(404).json({ error: 'Review session not found' });
          return;
        }

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  // Update auto-mark rules and immediately apply them
  router.put(
    '/sessions/:commitSha/auto-mark-rules',
    ...sessionMiddleware,
    async (req, res, next) => {
      try {
        const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
        const commitSha = req.params.commitSha ?? '';

        const { rules } = req.body as AutoMarkRulesRequest;
        if (!Array.isArray(rules) || !rules.every((r) => VALID_AUTO_MARK_RULES.includes(r))) {
          res.status(400).json({
            error: `Invalid body: rules must be an array of valid rule types (${VALID_AUTO_MARK_RULES.join(', ')})`,
          });
          return;
        }

        const result = await setAutoMarkRules(git, commitSha, rules);
        if (!result) {
          res.status(404).json({ error: 'Review session not found' });
          return;
        }

        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  // Re-apply existing auto-mark rules against current files
  router.post(
    '/sessions/:commitSha/auto-mark-apply',
    ...sessionMiddleware,
    async (req, res, next) => {
      try {
        const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
        const commitSha = req.params.commitSha ?? '';

        const result = await applyAutoMarkRules(git, commitSha);
        if (!result) {
          res.status(404).json({ error: 'Review session not found' });
          return;
        }

        res.json(result);
      } catch (error) {
        next(error);
      }
    },
  );

  // Delete a review session
  router.delete('/sessions/:commitSha', ...sessionMiddleware, async (req, res, next) => {
    try {
      const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
      const commitSha = req.params.commitSha ?? '';

      const found = await deleteSession(git, commitSha);
      if (!found) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Update session status (approve / request changes)
  router.patch('/sessions/:commitSha', ...sessionMiddleware, async (req, res, next) => {
    try {
      const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
      const commitSha = req.params.commitSha ?? '';

      const { status } = req.body as UpdateSessionStatusRequest;
      if (!VALID_STATUSES.includes(status as ReviewStatus)) {
        res
          .status(400)
          .json({ error: `Invalid body: status must be one of ${VALID_STATUSES.join(', ')}` });
        return;
      }

      const session = await updateStatus(git, commitSha, status as ReviewStatus);
      if (!session) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      res.json({ session });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
