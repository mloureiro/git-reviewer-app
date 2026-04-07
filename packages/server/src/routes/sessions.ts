import { Router } from 'express';
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
  ReviewData,
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
  router.get('/sessions', async (_req, res) => {
    try {
      const sessions: ReviewData[] = [];
      const repoPaths = registry.listPaths();

      for (const repoPath of repoPaths) {
        const [git] = registry.resolve(repoPath);
        const notes = await listReviewNotes(git);

        for (const { commitHash } of notes) {
          const data = await readReviewNote(git, commitHash);
          if (data) {
            // Ensure repoPath is set on the session for grouping
            if (data.session.repoPath == null) {
              data.session.repoPath = repoPath;
            }
            sessions.push(data);
          }
        }
      }

      res.json({ sessions });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Validate all review sessions (check if refs still exist, detect empty diffs)
  // Also returns diff stats (files, additions, deletions) for healthy sessions.
  router.get('/sessions/validate', async (_req, res) => {
    try {
      const health: Record<string, SessionHealth> = {};
      const stats: Record<string, SessionStats> = {};
      const repoPaths = registry.listPaths();

      for (const repoPath of repoPaths) {
        const [git] = registry.resolve(repoPath);
        const notes = await listReviewNotes(git);

        for (const { commitHash } of notes) {
          const data = await readReviewNote(git, commitHash);
          if (!data) continue;

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
              health[commitHash] = { status: 'stale', reason: 'base-ref-missing' };
            } else {
              // Check whether there are uncommitted changes to review
              try {
                const files = await getUncommittedChangedFiles(git);
                if (files.length === 0) {
                  health[commitHash] = { status: 'stale', reason: 'no-changes' };
                } else {
                  health[commitHash] = { status: 'ok' };
                  stats[commitHash] = {
                    files: files.length,
                    additions: files.reduce((sum, f) => sum + f.additions, 0),
                    deletions: files.reduce((sum, f) => sum + f.deletions, 0),
                  };
                }
              } catch {
                // If we can't determine changes, treat as ok to avoid false stale warnings
                health[commitHash] = { status: 'ok' };
              }
            }
          } else {
            let baseResolved: string | null = null;
            let headResolved: string | null = null;

            try {
              baseResolved = await git.revparse([baseRef]);
            } catch {
              // baseRef no longer exists
            }

            try {
              headResolved = await git.revparse([headRef]);
            } catch {
              // headRef no longer exists
            }

            if (baseResolved == null && headResolved == null) {
              health[commitHash] = { status: 'stale', reason: 'both-refs-missing' };
            } else if (baseResolved == null) {
              health[commitHash] = { status: 'stale', reason: 'base-ref-missing' };
            } else if (headResolved == null) {
              health[commitHash] = { status: 'stale', reason: 'head-ref-missing' };
            } else if (baseResolved.trim() === headResolved.trim()) {
              health[commitHash] = { status: 'stale', reason: 'no-changes' };
            } else {
              health[commitHash] = { status: 'ok' };

              // Compute lightweight diff stats for healthy sessions
              try {
                const summary = await git.diffSummary([
                  `${baseResolved.trim()}...${headResolved.trim()}`,
                ]);
                stats[commitHash] = {
                  files: summary.changed,
                  additions: summary.insertions,
                  deletions: summary.deletions,
                };
              } catch {
                // Stats are best-effort
              }
            }
          }
        }
      }

      res.json({ health, stats });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Get a specific review session
  router.get('/sessions/:commitSha', ...sessionMiddleware, async (req, res) => {
    try {
      const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
      const commitSha = req.params.commitSha ?? '';

      const data = await getSession(git, commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Get commits for a session's base..head range
  router.get('/sessions/:commitSha/commits', ...sessionMiddleware, async (req, res) => {
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
      res.status(500).json({ error: String(error) });
    }
  });

  // Create a new review session
  router.post('/sessions', async (req, res) => {
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
      res.status(201).json(data);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Mark a file as viewed
  router.post('/sessions/:commitSha/viewed-files', ...sessionMiddleware, async (req, res) => {
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
      res.status(500).json({ error: String(error) });
    }
  });

  // Unmark a file as viewed
  router.delete(
    '/sessions/:commitSha/viewed-files/:filePath',
    ...sessionMiddleware,
    async (req, res) => {
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
        res.status(500).json({ error: String(error) });
      }
    },
  );

  // Update auto-mark rules and immediately apply them
  router.put('/sessions/:commitSha/auto-mark-rules', ...sessionMiddleware, async (req, res) => {
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
      res.status(500).json({ error: String(error) });
    }
  });

  // Re-apply existing auto-mark rules against current files
  router.post('/sessions/:commitSha/auto-mark-apply', ...sessionMiddleware, async (req, res) => {
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
      res.status(500).json({ error: String(error) });
    }
  });

  // Delete a review session
  router.delete('/sessions/:commitSha', ...sessionMiddleware, async (req, res) => {
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
      res.status(500).json({ error: String(error) });
    }
  });

  // Update session status (approve / request changes)
  router.patch('/sessions/:commitSha', ...sessionMiddleware, async (req, res) => {
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

      res.json(session);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  return router;
}
