import type { DiffFile } from '../types/review';

interface FileTreeProps {
  files: DiffFile[];
  onFileClick: (filePath: string) => void;
  activeFile?: string;
  unresolvedCounts?: Record<string, number>;
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

function formatPath(file: DiffFile): string {
  if (file.status === 'renamed' && file.oldPath) {
    return `${file.oldPath} → ${file.path}`;
  }
  return file.path;
}

export function FileTree({ files, onFileClick, activeFile, unresolvedCounts }: FileTreeProps) {
  if (files.length === 0) {
    return null;
  }

  return (
    <nav className="file-tree" aria-label="Changed files">
      <div className="file-tree__header">
        <span className="file-tree__title">Files changed</span>
        <span className="file-tree__count">{files.length}</span>
      </div>
      <ul className="file-tree__list">
        {files.map((file) => {
          const isActive = file.path === activeFile;
          const label = formatPath(file);
          const unresolvedCount = unresolvedCounts != null ? (unresolvedCounts[file.path] ?? 0) : 0;

          return (
            <li key={file.path}>
              <button
                type="button"
                className={`file-tree__item${isActive ? ' file-tree__item--active' : ''}`}
                onClick={() => onFileClick(file.path)}
                aria-current={isActive ? 'true' : undefined}
                title={label}
              >
                <StatusDot status={file.status} />
                <span className="file-tree__path">{label}</span>
                <span className="file-tree__stats">
                  {file.additions > 0 && (
                    <span className="file-tree__additions">+{file.additions}</span>
                  )}
                  {file.deletions > 0 && (
                    <span className="file-tree__deletions">-{file.deletions}</span>
                  )}
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
        })}
      </ul>
    </nav>
  );
}
