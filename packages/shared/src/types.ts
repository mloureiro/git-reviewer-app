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
}

export interface ReviewData {
  version: 1;
  session: ReviewSession;
  comments: ReviewComment[];
  viewedFiles?: ViewedFile[];
}

export interface ViewedFile {
  path: string;
  viewedAt: string;
  diffHash: string;
}

export interface DiffFile {
  path: string;
  status: 'added' | 'modified' | 'deleted' | 'renamed';
  additions: number;
  deletions: number;
  oldPath?: string;
}
