import { Router } from 'express';
import type { RepoRegistry } from '../git/repo-registry.js';
import { validateCommitSha, resolveRepo, type ResolvedRepoLocals } from './middleware.js';
import { addComment, resolveComment, deleteComment } from '../services/session-service.js';
import type { CreateCommentRequest, UpdateCommentRequest } from '@git-reviewer/shared';
import { MAX_COMMENT_BODY_LENGTH } from '@git-reviewer/shared';

export function createCommentsRouter(registry: RepoRegistry): Router {
  const router = Router();

  const sessionMiddleware = [validateCommitSha, resolveRepo(registry)] as const;

  // Add a comment to a session
  router.post('/sessions/:commitSha/comments', ...sessionMiddleware, async (req, res, next) => {
    try {
      const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
      const commitSha = req.params.commitSha ?? '';

      const { file, line, side, body, author } = req.body as CreateCommentRequest;

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
      if (body.length > MAX_COMMENT_BODY_LENGTH) {
        res
          .status(400)
          .json({
            error: `Invalid body: body must not exceed ${MAX_COMMENT_BODY_LENGTH} characters`,
          });
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
      next(error);
    }
  });

  // Resolve/unresolve a comment
  router.patch(
    '/sessions/:commitSha/comments/:commentId',
    ...sessionMiddleware,
    async (req, res, next) => {
      try {
        const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
        const commitSha = req.params.commitSha ?? '';

        const { resolved } = req.body as UpdateCommentRequest;
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
        next(error);
      }
    },
  );

  // Delete a comment from a session
  router.delete(
    '/sessions/:commitSha/comments/:commentId',
    ...sessionMiddleware,
    async (req, res, next) => {
      try {
        const { resolvedGit: git } = res.locals as ResolvedRepoLocals;
        const commitSha = req.params.commitSha ?? '';
        const commentId = req.params.commentId ?? '';

        const result = await deleteComment(git, commitSha, commentId);
        if (result === null) {
          res.status(404).json({ error: 'Review session not found' });
          return;
        }
        if (result === 'comment-not-found') {
          res.status(404).json({ error: 'Comment not found' });
          return;
        }

        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  return router;
}
