import type { RequestHandler } from 'express';
import type { SimpleGit } from 'simple-git';
import { readReviewNote } from '../git/notes.js';
import type { RepoRegistry } from '../git/repo-registry.js';

// Matches a valid git commit SHA (4–40 lowercase hex characters)
const COMMIT_SHA_RE = /^[a-f0-9]{4,40}$/;

// Named route params produced by Express are always plain strings (not string[]).
// This type makes the param type explicit so handlers can access params without
// widening to `string | string[]`.
type RouteParams = Record<string, string>;

/**
 * Typed locals attached to the response by the `resolveRepo` middleware.
 * Downstream handlers can access `res.locals.resolvedGit` and
 * `res.locals.resolvedRepoPath` without casting.
 */
export interface ResolvedRepoLocals {
  resolvedGit: SimpleGit;
  resolvedRepoPath: string;
}

/**
 * Look up which registered repository owns the session identified by
 * `commitSha`. Returns `[git, repoPath]` on success, or `null` when:
 *
 * - `repoParam` names a repo that is not registered, or
 * - no registered repo has a note for `commitSha` (multi-repo search exhausted).
 *
 * In single-repo mode the search is skipped — the default repo is returned
 * directly, keeping the common path fast.
 */
async function resolveRepoForSession(
  registry: RepoRegistry,
  repoParam: unknown,
  commitSha: string,
): Promise<[SimpleGit, string] | null> {
  // If repo is explicitly provided, use it directly
  if (typeof repoParam === 'string' && repoParam.length > 0) {
    try {
      return registry.resolve(repoParam);
    } catch {
      return null;
    }
  }

  const paths = registry.listPaths();

  // Single repo: use the default directly (no search needed)
  if (paths.length <= 1) {
    try {
      return registry.resolve(undefined);
    } catch {
      return null;
    }
  }

  // Multiple repos: search for the session across all repos
  for (const repoPath of paths) {
    const git = registry.getRepo(repoPath);
    const data = await readReviewNote(git, commitSha);
    if (data) return [git, repoPath];
  }
  return null;
}

/**
 * Middleware that validates the `:commitSha` route parameter.
 *
 * Responds with 400 if the value is not a valid git commit SHA (4–40 lowercase
 * hex characters). Otherwise calls `next()` to pass control to the next handler.
 */
export const validateCommitSha: RequestHandler<RouteParams> = (req, res, next) => {
  if (!COMMIT_SHA_RE.test(req.params['commitSha'] ?? '')) {
    res.status(400).json({ error: 'Invalid commitSha: must be 4–40 lowercase hex characters' });
    return;
  }
  next();
};

/**
 * Middleware that validates the `:commitHash` route parameter.
 *
 * Responds with 400 if the value is not a valid git commit SHA (4–40 lowercase
 * hex characters). Otherwise calls `next()` to pass control to the next handler.
 */
export const validateCommitHash: RequestHandler<RouteParams> = (req, res, next) => {
  if (!COMMIT_SHA_RE.test(req.params['commitHash'] ?? '')) {
    res.status(400).json({ error: 'Invalid commitHash: must be 4–40 lowercase hex characters' });
    return;
  }
  next();
};

/**
 * Middleware factory that resolves the repository for a session-scoped route.
 *
 * Looks up which registered repo owns the session identified by
 * `req.params.commitSha`, then attaches the resolved `SimpleGit` instance and
 * repo path to `res.locals` as `resolvedGit` and `resolvedRepoPath`.
 *
 * Responds with 404 when no matching session is found. Must be used after
 * `validateCommitSha` so that `req.params.commitSha` is guaranteed to be a
 * valid SHA string.
 */
export function resolveRepo(registry: RepoRegistry): RequestHandler<RouteParams> {
  return async (req, res, next) => {
    const commitSha = req.params['commitSha'] ?? '';
    const resolved = await resolveRepoForSession(registry, req.query['repo'], commitSha);
    if (!resolved) {
      res.status(404).json({ error: 'Review session not found' });
      return;
    }
    const [git, repoPath] = resolved;
    const locals = res.locals as ResolvedRepoLocals;
    locals.resolvedGit = git;
    locals.resolvedRepoPath = repoPath;
    next();
  };
}
