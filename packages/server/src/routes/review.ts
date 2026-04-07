import { Router } from 'express';
import type { SimpleGit } from 'simple-git';
import {
  getDiffText,
  getUncommittedDiffText,
  getChangedFiles,
  getUncommittedChangedFiles,
  getFileDiffHashes,
} from '../git/diff.js';
import { getCommitList, getCommitDiffText, getCommitChangedFiles } from '../git/commits.js';
import { listReviewNotes, readReviewNote } from '../git/notes.js';
import type { RepoRegistry } from '../git/repo-registry.js';
import {
  validateCommitSha,
  validateCommitHash,
  resolveRepo,
  type ResolvedRepoLocals,
} from './middleware.js';
import {
  getSession,
  createSession,
  deleteSession,
  updateStatus,
  addComment,
  resolveComment,
  markFileViewed,
  unmarkFileViewed,
  setAutoMarkRules,
  applyAutoMarkRules,
} from '../services/session-service.js';
import type {
  AutoMarkRule,
  ReviewComment,
  ReviewData,
  ReviewStatus,
  SessionHealth,
  SessionStats,
} from '@git-reviewer/shared';

// Allowlist for git ref characters: letters, digits, hyphen, underscore, dot, slash
const VALID_REF_RE = /^[a-zA-Z0-9_\-./]+$/;

// Sentinel value used for uncommitted (working-tree) sessions — not a real git ref
const WORKING_TREE_SENTINEL = 'working tree';

const VALID_STATUSES: ReadonlyArray<ReviewStatus> = ['pending', 'approved', 'changes_requested'];

const VALID_AUTO_MARK_RULES: ReadonlyArray<AutoMarkRule> = [
  'rename-only',
  'import-only',
  'whitespace-only',
  'lockfile',
  'generated',
];

/**
 * Returns true when `value` is a string that is safe to pass to git as a ref.
 *
 * Uses an allowlist of characters permitted in git ref names (letters, digits,
 * hyphen, underscore, dot, slash) and additionally blocks `..` sequences to
 * prevent path traversal. The literal string 'working tree' is also accepted
 * because it is the sentinel value used for uncommitted sessions — it is never
 * passed to git commands, but must survive the validation gate so that the
 * endpoint can return an appropriate response.
 */
export function isValidRef(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value === WORKING_TREE_SENTINEL) return true;
  if (value.includes('..')) return false;
  return VALID_REF_RE.test(value);
}

function isUncommittedSession(headRef: string): boolean {
  return headRef === WORKING_TREE_SENTINEL;
}

/**
 * @deprecated Use createMultiRepoReviewRouter instead.
 * @TODO remove after 07-05-2026 @mloureiro
 */
export function createReviewRouter(git: SimpleGit): Router {
  // Wrap single git instance in a lightweight adapter matching the registry interface
  const singleRepoRegistry = {
    resolve: (): [SimpleGit, string] => [git, ''],
    listPaths: () => [''],
    registerRepo: () => git,
    has: () => true,
  } as unknown as RepoRegistry;
  return createMultiRepoReviewRouter(singleRepoRegistry);
}

export function createMultiRepoReviewRouter(registry: RepoRegistry): Router {
  const router = Router();

  const sessionMiddleware = [validateCommitSha, resolveRepo(registry)] as const;

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
  router.post('/repos', (req, res) => {
    const { path: repoPath } = req.body as { path: string };
    if (typeof repoPath !== 'string' || repoPath.trim().length === 0) {
      res.status(400).json({ error: 'Invalid body: path must be a non-empty string' });
      return;
    }
    try {
      registry.registerRepo(repoPath);
      res.status(201).json({ path: repoPath });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

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

  // Create a new review session
  router.post('/sessions', async (req, res) => {
    try {
      const [git, repoPath] = registry.resolve(req.query.repo);
      const { title, baseRef, headRef } = req.body as {
        title: string;
        baseRef: string;
        headRef: string;
      };

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

      const data = await createSession(git, { title, baseRef, headRef, repoPath });
      res.status(201).json(data);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Add a comment to a session
  router.post('/sessions/:commitSha/comments', ...sessionMiddleware, async (req, res) => {
    try {
      const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
      const commitSha = req.params.commitSha ?? '';

      const { file, line, side, body, author } = req.body as Omit<
        ReviewComment,
        'id' | 'createdAt' | 'resolved'
      >;

      if (typeof file !== 'string' || file.trim().length === 0) {
        res.status(400).json({ error: 'Invalid body: file must be a non-empty string' });
        return;
      }
      if (!Number.isInteger(line) || line < 1) {
        res.status(400).json({ error: 'Invalid body: line must be a positive integer' });
        return;
      }
      if (typeof body !== 'string' || body.trim().length === 0) {
        res.status(400).json({ error: 'Invalid body: body must be a non-empty string' });
        return;
      }
      if (side !== undefined && side !== 'left' && side !== 'right') {
        res.status(400).json({ error: "Invalid body: side must be 'left' or 'right'" });
        return;
      }
      if (author !== undefined && (typeof author !== 'string' || author.trim().length === 0)) {
        res.status(400).json({ error: 'Invalid body: author must be a non-empty string' });
        return;
      }

      const comment = await addComment(git, commitSha, {
        file,
        line,
        side: side ?? 'right',
        body,
        author: author ?? 'reviewer',
      });
      if (!comment) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Resolve/unresolve a comment
  router.patch(
    '/sessions/:commitSha/comments/:commentId',
    ...sessionMiddleware,
    async (req, res) => {
      try {
        const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
        const commitSha = req.params.commitSha ?? '';

        const { resolved } = req.body as { resolved: boolean };
        if (typeof resolved !== 'boolean') {
          res.status(400).json({ error: 'Invalid body: resolved must be a boolean' });
          return;
        }

        const result = await resolveComment(git, commitSha, req.params.commentId ?? '', resolved);
        if (result === null) {
          res.status(404).json({ error: 'Review session not found' });
          return;
        }
        if (result === 'comment-not-found') {
          res.status(404).json({ error: 'Comment not found' });
          return;
        }

        res.json(result);
      } catch (error) {
        res.status(500).json({ error: String(error) });
      }
    },
  );

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

      const { rules } = req.body as { rules: AutoMarkRule[] };
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

      const { status } = req.body as { status: ReviewData['session']['status'] };
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
