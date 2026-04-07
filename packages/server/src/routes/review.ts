import { Router } from 'express';
import type { SimpleGit } from 'simple-git';
import type { RepoRegistry } from '../git/repo-registry.js';
import { createReposRouter } from './repos.js';
import { createRefsRouter } from './refs.js';
import { createDiffsRouter } from './diffs.js';
import { createSessionsRouter } from './sessions.js';
import { createCommentsRouter } from './comments.js';

export { isValidRef } from './ref-validation.js';

/**
 * @deprecated Use createMultiRepoReviewRouter instead.
 * @TODO remove after 2026-07-05 @mloureiro
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

  router.use(createReposRouter(registry));
  router.use(createRefsRouter(registry));
  router.use(createDiffsRouter(registry));
  router.use(createSessionsRouter(registry));
  router.use(createCommentsRouter(registry));

  return router;
}
