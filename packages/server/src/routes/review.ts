import { Router } from 'express';
import type { SimpleGit } from 'simple-git';
import { v4 as uuid } from 'uuid';
import {
  getDiffText,
  getUncommittedDiffText,
  getChangedFiles,
  getUncommittedChangedFiles,
} from '../git/diff.js';
import { listReviewNotes, readReviewNote, writeReviewNote } from '../git/notes.js';
import type { ReviewComment, ReviewData } from '@git-reviewer/shared';

export function createReviewRouter(git: SimpleGit): Router {
  const router = Router();

  // Get diff between base and head
  router.get('/diff', async (req, res) => {
    try {
      const { base, head, uncommitted } = req.query;

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
      const data = await readReviewNote(git, req.params.commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      const { file, line, side, body, author } = req.body as Omit<
        ReviewComment,
        'id' | 'createdAt' | 'resolved'
      >;

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

      const { resolved } = req.body as { resolved: boolean };
      comment.resolved = resolved;
      data.session.updatedAt = new Date().toISOString();
      await writeReviewNote(git, req.params.commitSha, data);

      res.json(comment);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Update session status (approve / request changes)
  router.patch('/sessions/:commitSha', async (req, res) => {
    try {
      const data = await readReviewNote(git, req.params.commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      const { status } = req.body as { status: ReviewData['session']['status'] };
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
