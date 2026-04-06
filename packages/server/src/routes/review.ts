import { Router } from 'express';
import type { SimpleGit } from 'simple-git';
import { v4 as uuid } from 'uuid';
import {
  getDiffText,
  getUncommittedDiffText,
  getChangedFiles,
  getUncommittedChangedFiles,
  getFileDiffHashes,
} from '../git/diff.js';
import { getCommitList, getCommitDiffText, getCommitChangedFiles } from '../git/commits.js';
import {
  listReviewNotes,
  readReviewNote,
  removeReviewNote,
  writeReviewNote,
} from '../git/notes.js';
import { evaluateAutoMarkRules } from '../git/auto-mark.js';
import type { RepoRegistry } from '../git/repo-registry.js';
import type {
  AutoMarkRule,
  ReviewComment,
  ReviewData,
  ReviewStatus,
  ViewedFile,
} from '@git-reviewer/shared';

// Matches a valid git commit SHA (4–40 lowercase hex characters)
const COMMIT_SHA_RE = /^[a-f0-9]{4,40}$/;

// Characters that are dangerous in shell contexts
const SHELL_DANGEROUS_RE = /[;&|`$()<>\r\n\0 ]|\.\./;

const VALID_STATUSES: ReadonlyArray<ReviewStatus> = ['pending', 'approved', 'changes_requested'];

const VALID_AUTO_MARK_RULES: ReadonlyArray<AutoMarkRule> = [
  'rename-only',
  'import-only',
  'whitespace-only',
  'lockfile',
  'generated',
];

function isValidRef(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && !SHELL_DANGEROUS_RE.test(value);
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

export function createMultiRepoReviewRouter(registry: RepoRegistry): Router {
  const router = Router();

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
  router.get('/sessions', async (req, res) => {
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

  // Get a specific review session
  router.get('/sessions/:commitSha', async (req, res) => {
    try {
      if (!COMMIT_SHA_RE.test(req.params.commitSha)) {
        res.status(400).json({ error: 'Invalid commitSha: must be 4–40 lowercase hex characters' });
        return;
      }

      const resolved = await resolveRepoForSession(registry, req.query.repo, req.params.commitSha);
      if (!resolved) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }
      const [git] = resolved;

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

  // Get commits for a session's base..head range
  router.get('/sessions/:commitSha/commits', async (req, res) => {
    try {
      if (!COMMIT_SHA_RE.test(req.params.commitSha)) {
        res.status(400).json({ error: 'Invalid commitSha: must be 4–40 lowercase hex characters' });
        return;
      }

      const resolved = await resolveRepoForSession(registry, req.query.repo, req.params.commitSha);
      if (!resolved) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }
      const [git] = resolved;

      const data = await readReviewNote(git, req.params.commitSha);
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
  router.get('/commits/:commitHash/diff', async (req, res) => {
    try {
      const [git] = registry.resolve(req.query.repo);
      if (!COMMIT_SHA_RE.test(req.params.commitHash)) {
        res
          .status(400)
          .json({ error: 'Invalid commitHash: must be 4–40 lowercase hex characters' });
        return;
      }

      const diff = await getCommitDiffText(git, req.params.commitHash);
      res.json({ diff });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Get changed files for a single commit
  router.get('/commits/:commitHash/files', async (req, res) => {
    try {
      const [git] = registry.resolve(req.query.repo);
      if (!COMMIT_SHA_RE.test(req.params.commitHash)) {
        res
          .status(400)
          .json({ error: 'Invalid commitHash: must be 4–40 lowercase hex characters' });
        return;
      }

      const files = await getCommitChangedFiles(git, req.params.commitHash);
      const diffText = await getCommitDiffText(git, req.params.commitHash);
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
          repoPath,
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

      const resolved = await resolveRepoForSession(registry, req.query.repo, req.params.commitSha);
      if (!resolved) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }
      const [git] = resolved;

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

      const repoResult = await resolveRepoForSession(
        registry,
        req.query.repo,
        req.params.commitSha,
      );
      if (!repoResult) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }
      const [git] = repoResult;

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

  // Mark a file as viewed
  router.post('/sessions/:commitSha/viewed-files', async (req, res) => {
    try {
      if (!COMMIT_SHA_RE.test(req.params.commitSha)) {
        res.status(400).json({ error: 'Invalid commitSha: must be 4–40 lowercase hex characters' });
        return;
      }

      const resolved = await resolveRepoForSession(registry, req.query.repo, req.params.commitSha);
      if (!resolved) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }
      const [git] = resolved;

      const { path } = req.body as { path: string };
      if (typeof path !== 'string' || path.trim().length === 0) {
        res.status(400).json({ error: 'Invalid body: path must be a non-empty string' });
        return;
      }

      const data = await readReviewNote(git, req.params.commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      // Compute the current diff hash for this file
      const diffText = await getDiffText(git, data.session.baseRef, data.session.headRef);
      const diffHashes = getFileDiffHashes(diffText);
      const diffHash = diffHashes[path] ?? '';

      const viewedFile: ViewedFile = {
        path,
        viewedAt: new Date().toISOString(),
        diffHash,
      };

      // Replace existing entry for this path or add new
      const viewedFiles = data.viewedFiles ?? [];
      const existingIndex = viewedFiles.findIndex((vf) => vf.path === path);
      if (existingIndex >= 0) {
        viewedFiles[existingIndex] = viewedFile;
      } else {
        viewedFiles.push(viewedFile);
      }
      data.viewedFiles = viewedFiles;
      data.session.updatedAt = new Date().toISOString();
      await writeReviewNote(git, req.params.commitSha, data);

      res.status(201).json(viewedFile);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Unmark a file as viewed
  router.delete('/sessions/:commitSha/viewed-files/:filePath', async (req, res) => {
    try {
      if (!COMMIT_SHA_RE.test(req.params.commitSha)) {
        res.status(400).json({ error: 'Invalid commitSha: must be 4–40 lowercase hex characters' });
        return;
      }

      const resolved = await resolveRepoForSession(registry, req.query.repo, req.params.commitSha);
      if (!resolved) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }
      const [git] = resolved;

      const filePath = decodeURIComponent(req.params.filePath);

      const data = await readReviewNote(git, req.params.commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      const viewedFiles = data.viewedFiles ?? [];
      data.viewedFiles = viewedFiles.filter((vf) => vf.path !== filePath);
      data.session.updatedAt = new Date().toISOString();
      await writeReviewNote(git, req.params.commitSha, data);

      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Update auto-mark rules and immediately apply them
  router.put('/sessions/:commitSha/auto-mark-rules', async (req, res) => {
    try {
      if (!COMMIT_SHA_RE.test(req.params.commitSha)) {
        res.status(400).json({ error: 'Invalid commitSha: must be 4–40 lowercase hex characters' });
        return;
      }

      const resolved = await resolveRepoForSession(registry, req.query.repo, req.params.commitSha);
      if (!resolved) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }
      const [git] = resolved;

      const { rules } = req.body as { rules: AutoMarkRule[] };
      if (!Array.isArray(rules) || !rules.every((r) => VALID_AUTO_MARK_RULES.includes(r))) {
        res.status(400).json({
          error: `Invalid body: rules must be an array of valid rule types (${VALID_AUTO_MARK_RULES.join(', ')})`,
        });
        return;
      }

      const data = await readReviewNote(git, req.params.commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      data.autoMarkRules = rules;

      // Evaluate rules against current files
      const files = await getChangedFiles(git, data.session.baseRef, data.session.headRef);
      const diffText = await getDiffText(git, data.session.baseRef, data.session.headRef);
      const diffHashes = getFileDiffHashes(diffText);
      const matches = evaluateAutoMarkRules(files, diffText, rules);

      // Build new auto-marked ViewedFile entries
      const now = new Date().toISOString();
      const autoMarked: ViewedFile[] = matches.map((m) => ({
        path: m.path,
        viewedAt: now,
        diffHash: diffHashes[m.path] ?? '',
        autoMarkedBy: m.rule,
      }));

      // Merge: keep manually-marked files, remove stale auto-marked, add new auto-marked
      const viewedFiles = data.viewedFiles ?? [];
      const manuallyViewed = viewedFiles.filter((vf) => vf.autoMarkedBy == null);
      const autoMarkedPaths = new Set(autoMarked.map((vf) => vf.path));
      // Keep manual entries that don't overlap with new auto-marked entries
      const kept = manuallyViewed.filter((vf) => !autoMarkedPaths.has(vf.path));
      data.viewedFiles = [...kept, ...autoMarked];
      data.session.updatedAt = now;
      await writeReviewNote(git, req.params.commitSha, data);

      res.json({ rules, autoMarked });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Re-apply existing auto-mark rules against current files
  router.post('/sessions/:commitSha/auto-mark-apply', async (req, res) => {
    try {
      if (!COMMIT_SHA_RE.test(req.params.commitSha)) {
        res.status(400).json({ error: 'Invalid commitSha: must be 4–40 lowercase hex characters' });
        return;
      }

      const resolved = await resolveRepoForSession(registry, req.query.repo, req.params.commitSha);
      if (!resolved) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }
      const [git] = resolved;

      const data = await readReviewNote(git, req.params.commitSha);
      if (!data) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }

      const rules = data.autoMarkRules ?? [];
      const files = await getChangedFiles(git, data.session.baseRef, data.session.headRef);
      const diffText = await getDiffText(git, data.session.baseRef, data.session.headRef);
      const diffHashes = getFileDiffHashes(diffText);
      const matches = evaluateAutoMarkRules(files, diffText, rules);

      const now = new Date().toISOString();
      const autoMarked: ViewedFile[] = matches.map((m) => ({
        path: m.path,
        viewedAt: now,
        diffHash: diffHashes[m.path] ?? '',
        autoMarkedBy: m.rule,
      }));

      // Merge: keep manually-marked, replace auto-marked
      const viewedFiles = data.viewedFiles ?? [];
      const manuallyViewed = viewedFiles.filter((vf) => vf.autoMarkedBy == null);
      const autoMarkedPaths = new Set(autoMarked.map((vf) => vf.path));
      const kept = manuallyViewed.filter((vf) => !autoMarkedPaths.has(vf.path));
      data.viewedFiles = [...kept, ...autoMarked];
      data.session.updatedAt = now;
      await writeReviewNote(git, req.params.commitSha, data);

      res.json({ autoMarked });
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

      const resolved = await resolveRepoForSession(registry, req.query.repo, req.params.commitSha);
      if (!resolved) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }
      const [git] = resolved;

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

      const resolved = await resolveRepoForSession(registry, req.query.repo, req.params.commitSha);
      if (!resolved) {
        res.status(404).json({ error: 'Review session not found' });
        return;
      }
      const [git] = resolved;

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
