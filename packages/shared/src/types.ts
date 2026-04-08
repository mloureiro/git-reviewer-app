export interface ReviewComment {
  id: string;
  file: string;
  line: number;
  side: 'left' | 'right';
  body: string;
  author: string;
  createdAt: string;
  resolved: boolean;
}

export type ReviewStatus = 'pending' | 'approved' | 'changes_requested';

export interface ReviewSession {
  id: string;
  title: string;
  baseRef: string;
  headRef: string;
  baseCommit: string;
  headCommit: string;
  status: ReviewStatus;
  createdAt: string;
  updatedAt: string;
  repoPath?: string;
}

export interface ReviewData {
  version: 1;
  session: ReviewSession;
  comments: ReviewComment[];
  viewedFiles?: ViewedFile[];
  autoMarkRules?: AutoMarkRule[];
}

export type AutoMarkRule =
  | 'rename-only'
  | 'import-only'
  | 'whitespace-only'
  | 'lockfile'
  | 'generated';

export interface ViewedFile {
  path: string;
  viewedAt: string;
  diffHash: string;
  autoMarkedBy?: AutoMarkRule;
}

export type SessionHealthReason =
  | 'base-ref-missing'
  | 'head-ref-missing'
  | 'both-refs-missing'
  | 'no-changes';

export type SessionHealth = { status: 'ok' } | { status: 'stale'; reason: SessionHealthReason };

export interface SessionStats {
  files: number;
  additions: number;
  deletions: number;
}

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  oldPath?: string;
  binary?: boolean;
}

export interface CommitInfo {
  hash: string;
  shortHash: string;
  message: string;
  author: string;
  date: string;
}
