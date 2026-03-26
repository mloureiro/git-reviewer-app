import { useState, useCallback } from 'react';
import type { DiffFile } from '../types/review';

interface FileTreeProps {
  files: DiffFile[];
  onFileClick: (filePath: string) => void;
  activeFile?: string;
  unresolvedCounts?: Record<string, number>;
  viewedFiles?: Set<string>;
  changedSinceViewed?: Set<string>;
  onToggleViewed?: (filePath: string, isViewed: boolean) => void;
}

interface TreeNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children: TreeNode[];
  file?: DiffFile;
}

const STATUS_LABELS: Record<DiffFile['status'], string> = {
  added: 'A',
  deleted: 'D',
  modified: 'M',
  renamed: 'R',
};

function StatusDot({ status }: { status: DiffFile['status'] }) {
  return (
    <span className={`file-tree__status file-tree__status--${status}`} aria-label={status}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function formatFileName(file: DiffFile): string {
  const fileName = file.path.split('/').pop() ?? file.path;
  if (file.status === 'renamed' && file.oldPath) {
    const oldFileName = file.oldPath.split('/').pop() ?? file.oldPath;
    return oldFileName === fileName ? fileName : `${oldFileName} → ${fileName}`;
  }
  return fileName;
}

function buildTree(files: DiffFile[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', type: 'folder', children: [] };

  for (const file of files) {
    const parts = file.path.split('/');
    let current = root;

    // Navigate/create folder nodes for each directory segment
    for (let i = 0; i < parts.length - 1; i += 1) {
      const folderName = parts[i] as string;
      const folderPath = parts.slice(0, i + 1).join('/');
      let child = current.children.find((c) => c.type === 'folder' && c.name === folderName);
      if (child == null) {
        child = { name: folderName, path: folderPath, type: 'folder', children: [] };
        current.children.push(child);
      }
      current = child;
    }

    // Add the file node
    const fileName = parts[parts.length - 1] as string;
    current.children.push({
      name: fileName,
      path: file.path,
      type: 'file',
      children: [],
      file,
    });
  }

  // Compact single-child folders and sort
  compactAndSort(root);

  return root.children;
}

function compactAndSort(node: TreeNode): void {
  // Recurse first so children are already compacted
  for (const child of node.children) {
    compactAndSort(child);
  }

  // Compact: if a folder has exactly one child and that child is a folder, merge them
  if (node.type === 'folder') {
    let first = node.children[0];
    while (node.children.length === 1 && first != null && first.type === 'folder') {
      node.name = node.name ? `${node.name}/${first.name}` : first.name;
      node.path = first.path;
      node.children = first.children;
      first = node.children[0];
    }
  }

  // Sort: folders first, then files, alphabetically within each group
  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

interface TreeNodeRowProps {
  node: TreeNode;
  depth: number;
  collapsed: Set<string>;
  onToggle: (path: string) => void;
  onFileClick: (filePath: string) => void;
  activeFile?: string;
  unresolvedCounts?: Record<string, number>;
  viewedFiles?: Set<string>;
  changedSinceViewed?: Set<string>;
  onToggleViewed?: (filePath: string, isViewed: boolean) => void;
}

function TreeNodeRow({
  node,
  depth,
  collapsed,
  onToggle,
  onFileClick,
  activeFile,
  unresolvedCounts,
  viewedFiles,
  changedSinceViewed,
  onToggleViewed,
}: TreeNodeRowProps) {
  const indent = depth * 12;

  if (node.type === 'folder') {
    const isCollapsed = collapsed.has(node.path);
    return (
      <>
        <li>
          <button
            type="button"
            className="file-tree__folder"
            onClick={() => onToggle(node.path)}
            style={{ paddingLeft: `${indent + 12}px` }}
            aria-expanded={!isCollapsed}
          >
            <span
              className={`file-tree__chevron${isCollapsed ? ' file-tree__chevron--collapsed' : ''}`}
            >
              {isCollapsed ? '\u25B6' : '\u25BC'}
            </span>
            <span className="file-tree__folder-name">{node.name}</span>
          </button>
        </li>
        {!isCollapsed &&
          node.children.map((child) => (
            <TreeNodeRow
              key={child.path}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              onFileClick={onFileClick}
              activeFile={activeFile}
              unresolvedCounts={unresolvedCounts}
              viewedFiles={viewedFiles}
              changedSinceViewed={changedSinceViewed}
              onToggleViewed={onToggleViewed}
            />
          ))}
      </>
    );
  }

  // File node
  const file = node.file as DiffFile;
  const isActive = file.path === activeFile;
  const label = formatFileName(file);
  const unresolvedCount = unresolvedCounts != null ? (unresolvedCounts[file.path] ?? 0) : 0;
  const isViewed = viewedFiles != null && viewedFiles.has(file.path);
  const isChangedSinceViewed = changedSinceViewed != null && changedSinceViewed.has(file.path);

  const itemClass = [
    'file-tree__item',
    isActive ? 'file-tree__item--active' : '',
    isViewed ? 'file-tree__item--viewed' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <li>
      <button
        type="button"
        className={itemClass}
        onClick={() => onFileClick(file.path)}
        aria-current={isActive ? 'true' : undefined}
        title={file.path}
        style={{ paddingLeft: `${indent + 12}px` }}
      >
        {onToggleViewed != null && (
          <span
            className={`file-tree__viewed-toggle${isViewed ? ' file-tree__viewed-toggle--viewed' : ''}${isChangedSinceViewed ? ' file-tree__viewed-toggle--changed' : ''}`}
            role="checkbox"
            aria-checked={isViewed}
            aria-label={isViewed ? 'Viewed' : 'Mark as viewed'}
            title={
              isChangedSinceViewed
                ? 'Changed since last viewed'
                : isViewed
                  ? 'Viewed'
                  : 'Mark as viewed'
            }
            onClick={(e) => {
              e.stopPropagation();
              onToggleViewed(file.path, isViewed);
            }}
          >
            {isChangedSinceViewed ? '\u25CF' : isViewed ? '\u2713' : '\u25CB'}
          </span>
        )}
        <StatusDot status={file.status} />
        <span className="file-tree__path">{label}</span>
        <span className="file-tree__stats">
          {file.additions > 0 && <span className="file-tree__additions">+{file.additions}</span>}
          {file.deletions > 0 && <span className="file-tree__deletions">-{file.deletions}</span>}
        </span>
        {unresolvedCount > 0 && (
          <span
            className="file-tree__unresolved-badge"
            title={`${unresolvedCount} unresolved comment${unresolvedCount === 1 ? '' : 's'}`}
            aria-label={`${unresolvedCount} unresolved`}
          >
            {unresolvedCount}
          </span>
        )}
      </button>
    </li>
  );
}

export function FileTree({
  files,
  onFileClick,
  activeFile,
  unresolvedCounts,
  viewedFiles,
  changedSinceViewed,
  onToggleViewed,
}: FileTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const handleToggle = useCallback((path: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  if (files.length === 0) {
    return null;
  }

  const tree = buildTree(files);

  return (
    <nav className="file-tree" aria-label="Changed files">
      <div className="file-tree__header">
        <span className="file-tree__title">Files changed</span>
        <span className="file-tree__count">{files.length}</span>
      </div>
      <ul className="file-tree__list">
        {tree.map((node) => (
          <TreeNodeRow
            key={node.path}
            node={node}
            depth={0}
            collapsed={collapsed}
            onToggle={handleToggle}
            onFileClick={onFileClick}
            activeFile={activeFile}
            unresolvedCounts={unresolvedCounts}
            viewedFiles={viewedFiles}
            changedSinceViewed={changedSinceViewed}
            onToggleViewed={onToggleViewed}
          />
        ))}
      </ul>
    </nav>
  );
}

// Exported for testing
export { buildTree };
export type { TreeNode };
