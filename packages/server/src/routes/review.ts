import { Router } from 'express';
import type { SimpleGit } from 'simple-git';
import { v4 as uuid } from 'uuid';
import {
  getDiffText,
  getUncommittedDiffText,
  getChangedFiles,
  getUncommittedChangedFiles,
} from '../git/diff.js';
import {
  listReviewNotes,
  readReviewNote,
  removeReviewNote,
  writeReviewNote,
} from '../git/notes.js';
import type { ReviewComment, ReviewData, ReviewStatus } from '@git-reviewer/shared';

// Matches a valid git commit SHA (4–40 lowercase hex characters)
const COMMIT_SHA_RE = /^[a-f0-9]{4,40}$/;

// Characters that are dangerous in shell contexts
const SHELL_DANGEROUS_RE = /[;&|`$()<>\r\n\0 ]|\.\./;

const VALID_STATUSES: ReadonlyArray<ReviewStatus> = ['pending', 'approved', 'changes_requested'];

function isValidRef(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !SHELL_DANGEROUS_RE.test(value);
}

export function createReviewRouter(git: SimpleGit): Router {
  const router = Router();

  // Get diff between base and head
  router.get('/diff', async (req, res) => {
    try {
      const { base, head, uncommitted } = req.query;

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
      const { base, head, uncommitted } = req.query;

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

      const files =
        uncommitted === 'true'
          ? await getUncommittedChangedFiles(git)
          : await getChangedFiles(git, String(base ?? 'main'), String(head ?? 'HEAD'));

      res.json({ files });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // List all review sessions
  router.get('/sessions', async (_req, res) => {
    try {
      const notes = await listReviewNotes(git);
      const sessions: ReviewData[] = [];

      for (const { commitHash } of notes) {
        const data = await readReviewNote(git, commitHash);
        if (data) {
          sessions.push(data);
        }
      }

      res.json({ sessions });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Get a specific review session
  router.get('/sessions/:commitSha', async (req, res) => {
    try {
      if (!COMMIT_SHA_RE.test(req.params.commitSha)) {
        res.status(400).json({ error: 'Invalid commitSha: must be 4–40 lowercase hex characters' });
        return;
      }

      const data = await readReviewNote(git, req.params.commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }
      res.json(data);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Create a new review session
  router.post('/sessions', async (req, res) => {
    try {
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

      const headCommit = await git.revparse([headRef]);
      const baseCommit = await git.revparse([baseRef]);
      const now = new Date().toISOString();

      const data: ReviewData = {
        version: 1,
        session: {
          id: uuid(),
          title,
          baseRef,
          headRef,
          baseCommit: baseCommit.trim(),
          headCommit: headCommit.trim(),
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        },
        comments: [],
      };

      await writeReviewNote(git, headCommit.trim(), data);
      res.status(201).json(data);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Add a comment to a session
  router.post('/sessions/:commitSha/comments', async (req, res) => {
    try {
      if (!COMMIT_SHA_RE.test(req.params.commitSha)) {
        res.status(400).json({ error: 'Invalid commitSha: must be 4–40 lowercase hex characters' });
        return;
      }

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

      const data = await readReviewNote(git, req.params.commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      const comment: ReviewComment = {
        id: uuid(),
        file,
        line,
        side: side ?? 'right',
        body,
        author: author ?? 'reviewer',
        createdAt: new Date().toISOString(),
        resolved: false,
      };

      data.comments.push(comment);
      data.session.updatedAt = new Date().toISOString();
      await writeReviewNote(git, req.params.commitSha, data);

      res.status(201).json(comment);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Resolve/unresolve a comment
  router.patch('/sessions/:commitSha/comments/:commentId', async (req, res) => {
    try {
      if (!COMMIT_SHA_RE.test(req.params.commitSha)) {
        res.status(400).json({ error: 'Invalid commitSha: must be 4–40 lowercase hex characters' });
        return;
      }

      const { resolved } = req.body as { resolved: boolean };
      if (typeof resolved !== 'boolean') {
        res.status(400).json({ error: 'Invalid body: resolved must be a boolean' });
        return;
      }

      const data = await readReviewNote(git, req.params.commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      const comment = data.comments.find(({ id }) => id === req.params.commentId);
      if (!comment) {
        res.status(404).json({ error: 'Comment not found' });
        return;
      }

      comment.resolved = resolved;
      data.session.updatedAt = new Date().toISOString();
      await writeReviewNote(git, req.params.commitSha, data);

      res.json(comment);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Delete a review session
  router.delete('/sessions/:commitSha', async (req, res) => {
    try {
      if (!COMMIT_SHA_RE.test(req.params.commitSha)) {
        res.status(400).json({ error: 'Invalid commitSha: must be 4–40 lowercase hex characters' });
        return;
      }

      const data = await readReviewNote(git, req.params.commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      await removeReviewNote(git, req.params.commitSha);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Update session status (approve / request changes)
  router.patch('/sessions/:commitSha', async (req, res) => {
    try {
      if (!COMMIT_SHA_RE.test(req.params.commitSha)) {
        res.status(400).json({ error: 'Invalid commitSha: must be 4–40 lowercase hex characters' });
        return;
      }

      const { status } = req.body as { status: ReviewData['session']['status'] };
      if (!VALID_STATUSES.includes(status as ReviewStatus)) {
        res
          .status(400)
          .json({ error: `Invalid body: status must be one of ${VALID_STATUSES.join(', ')}` });
        return;
      }

      const data = await readReviewNote(git, req.params.commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      data.session.status = status;
      data.session.updatedAt = new Date().toISOString();
      await writeReviewNote(git, req.params.commitSha, data);

      res.json(data.session);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  return router;
}
