import React, { useMemo } from 'react';
import { parse } from 'diff2html';
import type { DiffBlock, DiffFile, DiffLine } from 'diff2html/lib-esm/types';
import { LineType } from 'diff2html/lib-esm/types';
import { ColorSchemeType } from 'diff2html/lib-esm/types';
import 'diff2html/bundles/css/diff2html.min.css';
import hljs from 'highlight.js/lib/common';

import type { FocusableLine } from '../hooks/useLineFocus';
import type { DiffLineData, DiffViewMode } from '../types/review';
import { CopyPathButton } from './CopyPathButton';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function filePathToId(filePath: string): string {
  return `file-${filePath.replace(/[^a-zA-Z0-9]/g, '-')}`;
}

function colorSchemeClass(colorScheme: ColorSchemeType): string {
  switch (colorScheme) {
    case ColorSchemeType.DARK:
      return 'd2h-dark-color-scheme';
    case ColorSchemeType.LIGHT:
      return '';
    default:
      return 'd2h-auto-color-scheme';
  }
}

function lineTypeClass(type: LineType): string {
  switch (type) {
    case LineType.INSERT:
      return 'd2h-ins';
    case LineType.DELETE:
      return 'd2h-del';
    default:
      return 'd2h-cntx';
  }
}

/** Strip the leading +/- or space prefix from the raw diff line content. */
function stripLinePrefix(content: string): string {
  return content.length > 0 ? content.slice(1) : content;
}

/**
 * Map a file path's extension to an highlight.js language identifier.
 * Returns null when the extension is unknown or not supported.
 */
function getFileLanguage(filePath: string): string | null {
  const ext = filePath.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    mjs: 'javascript',
    cjs: 'javascript',
    json: 'json',
    css: 'css',
    scss: 'scss',
    html: 'xml',
    htm: 'xml',
    xml: 'xml',
    svg: 'xml',
    md: 'markdown',
    sh: 'bash',
    bash: 'bash',
    zsh: 'bash',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    c: 'c',
    cpp: 'cpp',
    cc: 'cpp',
    cxx: 'cpp',
    h: 'c',
    hpp: 'cpp',
    cs: 'csharp',
    php: 'php',
    yaml: 'yaml',
    yml: 'yaml',
    toml: 'ini',
    ini: 'ini',
    sql: 'sql',
    graphql: 'graphql',
    gql: 'graphql',
    dockerfile: 'dockerfile',
  };
  return map[ext] ?? null;
}

/**
 * Highlight a single line of code using highlight.js.
 * Returns the highlighted HTML string, or null if the language is not
 * recognised or the content is empty (caller should render plain text).
 */
function highlightLine(content: string, language: string | null): string | null {
  if (language === null || content.trim() === '') return null;
  if (hljs.getLanguage(language) == null) return null;
  try {
    return hljs.highlight(content, { language, ignoreIllegals: true }).value;
  } catch {
    return null;
  }
}

/** A paired row for side-by-side rendering: left (old) and right (new) lines. */
interface SideBySidePair {
  left: DiffLine | null;
  right: DiffLine | null;
}

/**
 * Pair up the lines in a diff block for side-by-side rendering.
 * DELETE lines go to the left column, INSERT lines go to the right column.
 * Adjacent DELETE+INSERT runs are paired together. CONTEXT lines span both.
 */
function pairLinesForSideBySide(lines: readonly DiffLine[]): SideBySidePair[] {
  const pairs: SideBySidePair[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (line == null) {
      i = i + 1;
      continue;
    }

    if (line.type === LineType.CONTEXT) {
      pairs.push({ left: line, right: line });
      i = i + 1;
      continue;
    }

    if (line.type === LineType.DELETE) {
      // Collect the run of DELETE lines
      const deletes: DiffLine[] = [];
      while (i < lines.length) {
        const current = lines[i];
        if (current == null || current.type !== LineType.DELETE) break;
        deletes.push(current);
        i = i + 1;
      }
      // Collect the immediately following INSERT lines
      const inserts: DiffLine[] = [];
      while (i < lines.length) {
        const current = lines[i];
        if (current == null || current.type !== LineType.INSERT) break;
        inserts.push(current);
        i = i + 1;
      }
      // Pair them up — the longer side gets null on the other side
      const count = Math.max(deletes.length, inserts.length);
      for (let j = 0; j < count; j = j + 1) {
        pairs.push({ left: deletes[j] ?? null, right: inserts[j] ?? null });
      }
      continue;
    }

    // INSERT without a preceding DELETE (shouldn't normally happen but handle it)
    if (line.type === LineType.INSERT) {
      pairs.push({ left: null, right: line });
      i = i + 1;
      continue;
    }

    i = i + 1;
  }

  return pairs;
}

// ---------------------------------------------------------------------------
// Focus helpers
// ---------------------------------------------------------------------------

/**
 * Returns true when `entry` matches the currently focused line.
 * Null-safe: returns false when either argument is null/undefined.
 */
function isLineFocused(
  focusedLine: FocusableLine | null | undefined,
  file: string,
  lineNum: number,
  side: 'left' | 'right',
): boolean {
  if (focusedLine == null) return false;
  return focusedLine.file === file && focusedLine.line === lineNum && focusedLine.side === side;
}

// ---------------------------------------------------------------------------
// Props types
// ---------------------------------------------------------------------------

interface DiffLineRowProps {
  line: DiffLine;
  filePath: string;
  language: string | null;
  onLineClick?: (data: DiffLineData) => void;
  hasComment?: boolean;
  isFocusedLine?: boolean;
}

interface DiffBlockProps {
  block: DiffBlock;
  filePath: string;
  language: string | null;
  viewMode: DiffViewMode;
  focusedLine?: FocusableLine | null;
  onLineClick?: (data: DiffLineData) => void;
  renderAfterLine?: (lineData: DiffLineData, colSpan?: number) => React.ReactNode;
  hasCommentOnLine?: (lineData: DiffLineData) => boolean;
}

interface DiffFileProps {
  file: DiffFile;
  colorScheme: ColorSchemeType;
  viewMode: DiffViewMode;
  isFocused?: boolean;
  focusedLine?: FocusableLine | null;
  onLineClick?: (data: DiffLineData) => void;
  renderAfterLine?: (lineData: DiffLineData, colSpan?: number) => React.ReactNode;
  hasCommentOnLine?: (lineData: DiffLineData) => boolean;
  isViewed?: boolean;
  isChangedSinceViewed?: boolean;
  onToggleViewed?: (filePath: string, isViewed: boolean) => void;
  isCollapsed?: boolean;
  onToggleCollapsed?: () => void;
}

interface DiffViewProps {
  diffText: string;
  colorScheme?: ColorSchemeType;
  viewMode?: DiffViewMode;
  /** When set, the section for this file path receives a visual focus highlight. */
  focusedFile?: string | null;
  /** When set, the matching diff row receives a visual line-level focus highlight. */
  focusedLine?: FocusableLine | null;
  onLineClick?: (data: DiffLineData) => void;
  renderAfterLine?: (lineData: DiffLineData, colSpan?: number) => React.ReactNode;
  hasCommentOnLine?: (lineData: DiffLineData) => boolean;
  viewedFiles?: Set<string>;
  changedSinceViewed?: Set<string>;
  onToggleViewed?: (filePath: string, isViewed: boolean) => void;
  collapsedFiles?: Set<string>;
  onToggleCollapsed?: (filePath: string) => void;
}

// ---------------------------------------------------------------------------
// DiffLineRow (line-by-line mode)
// ---------------------------------------------------------------------------

export const DiffLineRow = React.memo(function DiffLineRow({
  line,
  filePath,
  language,
  onLineClick,
  hasComment,
  isFocusedLine = false,
}: DiffLineRowProps) {
  const typeClass = lineTypeClass(line.type);
  const oldNum = line.type !== LineType.INSERT ? line.oldNumber : undefined;
  const newNum = line.type !== LineType.DELETE ? line.newNumber : undefined;
  const lineContent = stripLinePrefix(line.content);
  const highlightedHtml = highlightLine(lineContent, language);

  // The authoritative line number for the comment system: prefer newNumber
  // (insert / context), fall back to oldNumber (delete).
  const commentLine = newNum ?? oldNum ?? 0;
  const commentSide: 'left' | 'right' = line.type === LineType.DELETE ? 'left' : 'right';

  const isClickable = onLineClick != null;

  function handleClick(): void {
    // Don't open comment form when the user is selecting text to copy
    const selection = window.getSelection();
    if (selection != null && selection.toString().length > 0) return;

    if (onLineClick != null) {
      onLineClick({ file: filePath, line: commentLine, side: commentSide, content: lineContent });
    }
  }

  const rowClass = [
    'd2h-diff-tr',
    typeClass,
    isClickable ? 'diff-line--clickable' : '',
    hasComment === true ? 'diff-line--has-comment' : '',
    isFocusedLine ? 'diff-line--focused' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <tr
      className={rowClass}
      data-file-path={filePath}
      data-line-number={commentLine}
      data-line-side={commentSide}
      data-line-focused={isFocusedLine ? 'true' : undefined}
      onClick={isClickable ? handleClick : undefined}
    >
      {/* Left line number — shows "+" affordance on hover, comment dot when comment exists */}
      <td className="d2h-code-linenumber">
        {hasComment === true && (
          <span className="diff-line__comment-dot" aria-label="Has comment" />
        )}
        <span className="diff-line__plus-icon" aria-hidden="true">
          +
        </span>
        <div className="line-num1">{oldNum}</div>
        <div className="line-num2">{newNum}</div>
      </td>

      {/* +/- prefix */}
      <td className="d2h-code-line-prefix">
        {line.type === LineType.INSERT && '+'}
        {line.type === LineType.DELETE && '-'}
        {line.type === LineType.CONTEXT && ' '}
      </td>

      {/* Line content */}
      <td className="d2h-code-line">
        {highlightedHtml != null ? (
          <span
            className="d2h-code-line-ctn"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <span className="d2h-code-line-ctn">{lineContent}</span>
        )}
      </td>
    </tr>
  );
});

// ---------------------------------------------------------------------------
// SideBySideRow — renders a paired left/right row
// ---------------------------------------------------------------------------

interface SideBySideRowProps {
  pair: SideBySidePair;
  filePath: string;
  language: string | null;
  focusedLine?: FocusableLine | null;
  onLineClick?: (data: DiffLineData) => void;
  hasCommentOnLine?: (lineData: DiffLineData) => boolean;
}

function renderSideCell(
  line: DiffLine | null,
  filePath: string,
  language: string | null,
  side: 'left' | 'right',
  onLineClick: ((data: DiffLineData) => void) | undefined,
  hasComment: boolean,
  isFocused: boolean,
): React.ReactNode {
  if (line === null) {
    return (
      <>
        <td className="d2h-code-linenumber d2h-sbs-linenumber d2h-sbs-linenumber--empty" />
        <td className="d2h-code-line-prefix d2h-sbs-empty" />
        <td className="d2h-code-line d2h-sbs-empty" />
      </>
    );
  }

  const lineContent = stripLinePrefix(line.content);
  const highlightedHtml = highlightLine(lineContent, language);
  const lineNum = side === 'left' ? line.oldNumber : line.newNumber;
  const isClickable = onLineClick != null;

  function handleClick(): void {
    const selection = window.getSelection();
    if (selection != null && selection.toString().length > 0) return;

    if (onLineClick != null && lineNum != null) {
      onLineClick({ file: filePath, line: lineNum, side, content: lineContent });
    }
  }

  return (
    <>
      <td
        className={[
          'd2h-code-linenumber',
          'd2h-sbs-linenumber',
          isClickable ? 'diff-line--clickable' : '',
          hasComment ? 'diff-line--has-comment' : '',
          isFocused ? 'diff-line--focused' : '',
        ]
          .filter(Boolean)
          .join(' ')}
        onClick={isClickable ? handleClick : undefined}
      >
        {hasComment && <span className="diff-line__comment-dot" aria-label="Has comment" />}
        {isClickable && (
          <span className="diff-line__plus-icon" aria-hidden="true">
            +
          </span>
        )}
        <div className="line-num1">{lineNum}</div>
      </td>
      <td className="d2h-code-line-prefix">
        {line.type === LineType.INSERT && '+'}
        {line.type === LineType.DELETE && '-'}
        {line.type === LineType.CONTEXT && ' '}
      </td>
      <td className="d2h-code-line">
        {highlightedHtml != null ? (
          <span
            className="d2h-code-line-ctn"
            dangerouslySetInnerHTML={{ __html: highlightedHtml }}
          />
        ) : (
          <span className="d2h-code-line-ctn">{lineContent}</span>
        )}
      </td>
    </>
  );
}

const SideBySideRow = React.memo(function SideBySideRow({
  pair,
  filePath,
  language,
  focusedLine,
  onLineClick,
  hasCommentOnLine,
}: SideBySideRowProps) {
  const { left, right } = pair;

  const leftTypeClass = left != null ? lineTypeClass(left.type) : '';
  const rightTypeClass = right != null ? lineTypeClass(right.type) : '';

  // For comment checks: use the appropriate line number and side
  const leftLineNum =
    left != null ? (left.type !== LineType.INSERT ? left.oldNumber : undefined) : undefined;
  const rightLineNum =
    right != null ? (right.type !== LineType.DELETE ? right.newNumber : undefined) : undefined;

  const leftLineData: DiffLineData | null =
    leftLineNum != null ? { file: filePath, line: leftLineNum, side: 'left', content: '' } : null;
  const rightLineData: DiffLineData | null =
    rightLineNum != null
      ? { file: filePath, line: rightLineNum, side: 'right', content: '' }
      : null;

  const hasLeftComment =
    leftLineData != null && hasCommentOnLine != null ? hasCommentOnLine(leftLineData) : false;
  const hasRightComment =
    rightLineData != null && hasCommentOnLine != null ? hasCommentOnLine(rightLineData) : false;

  const isLeftFocused =
    leftLineNum != null ? isLineFocused(focusedLine, filePath, leftLineNum, 'left') : false;
  const isRightFocused =
    rightLineNum != null ? isLineFocused(focusedLine, filePath, rightLineNum, 'right') : false;

  const rowClass = [
    'd2h-diff-tr',
    'd2h-diff-tr--sbs',
    leftTypeClass || rightTypeClass,
    isLeftFocused || isRightFocused ? 'diff-line--focused' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <tr className={rowClass}>
      {renderSideCell(left, filePath, language, 'left', onLineClick, hasLeftComment, isLeftFocused)}
      <td className="d2h-sbs-divider" />
      {renderSideCell(
        right,
        filePath,
        language,
        'right',
        onLineClick,
        hasRightComment,
        isRightFocused,
      )}
    </tr>
  );
});

// ---------------------------------------------------------------------------
// DiffBlock
// ---------------------------------------------------------------------------

export function DiffBlockComponent({
  block,
  filePath,
  language,
  viewMode,
  focusedLine,
  onLineClick,
  renderAfterLine,
  hasCommentOnLine,
}: DiffBlockProps) {
  if (viewMode === 'side-by-side') {
    const pairs = pairLinesForSideBySide(block.lines);

    return (
      <tbody className="d2h-diff-tbody">
        {/* Hunk header row — spans all 7 columns (3 left + divider + 3 right) */}
        <tr className="d2h-diff-tr d2h-info">
          <td className="d2h-code-linenumber d2h-info" />
          <td className="d2h-code-line-prefix d2h-info" />
          <td className="d2h-code-line d2h-info" colSpan={5}>
            <span className="d2h-code-line-ctn">{block.header}</span>
          </td>
        </tr>

        {pairs.map((pair, idx) => {
          const { left, right } = pair;

          const leftLineNum =
            left != null ? (left.type !== LineType.INSERT ? left.oldNumber : undefined) : undefined;
          const rightLineNum =
            right != null
              ? right.type !== LineType.DELETE
                ? right.newNumber
                : undefined
              : undefined;

          const leftLineData: DiffLineData | null =
            leftLineNum != null
              ? {
                  file: filePath,
                  line: leftLineNum,
                  side: 'left',
                  content: left != null ? stripLinePrefix(left.content) : '',
                }
              : null;
          const rightLineData: DiffLineData | null =
            rightLineNum != null
              ? {
                  file: filePath,
                  line: rightLineNum,
                  side: 'right',
                  content: right != null ? stripLinePrefix(right.content) : '',
                }
              : null;

          const leftAfter =
            renderAfterLine != null && leftLineData != null
              ? renderAfterLine(leftLineData, 7)
              : null;
          const rightAfter =
            renderAfterLine != null && rightLineData != null
              ? renderAfterLine(rightLineData, 7)
              : null;

          return (
            <React.Fragment key={`pair-${idx}`}>
              <SideBySideRow
                pair={pair}
                filePath={filePath}
                language={language}
                focusedLine={focusedLine}
                onLineClick={onLineClick}
                hasCommentOnLine={hasCommentOnLine}
              />
              {leftAfter}
              {rightAfter}
            </React.Fragment>
          );
        })}
      </tbody>
    );
  }

  // Default: line-by-line
  return (
    <tbody className="d2h-diff-tbody">
      {/* Hunk header row */}
      <tr className="d2h-diff-tr d2h-info">
        <td className="d2h-code-linenumber d2h-info" />
        <td className="d2h-code-line-prefix d2h-info" />
        <td className="d2h-code-line d2h-info">
          <span className="d2h-code-line-ctn">{block.header}</span>
        </td>
      </tr>

      {block.lines.map((line, idx) => {
        const oldNum = line.type !== LineType.INSERT ? line.oldNumber : undefined;
        const newNum = line.type !== LineType.DELETE ? line.newNumber : undefined;
        const commentLine = newNum ?? oldNum ?? 0;
        const commentSide: 'left' | 'right' = line.type === LineType.DELETE ? 'left' : 'right';
        const lineContent = stripLinePrefix(line.content);
        const lineData: DiffLineData = {
          file: filePath,
          line: commentLine,
          side: commentSide,
          content: lineContent,
        };
        const rowKey = `${line.type}-${line.oldNumber ?? 'x'}-${line.newNumber ?? 'x'}-${idx}`;
        const hasComment = hasCommentOnLine != null ? hasCommentOnLine(lineData) : false;
        const isFocusedLine = isLineFocused(focusedLine, filePath, commentLine, commentSide);

        return (
          <React.Fragment key={rowKey}>
            <DiffLineRow
              line={line}
              filePath={filePath}
              language={language}
              onLineClick={onLineClick}
              hasComment={hasComment}
              isFocusedLine={isFocusedLine}
            />
            {renderAfterLine != null ? renderAfterLine(lineData) : null}
          </React.Fragment>
        );
      })}
    </tbody>
  );
}

// ---------------------------------------------------------------------------
// DiffFileComponent
// ---------------------------------------------------------------------------

export const DiffFileComponent = React.memo(function DiffFileComponent({
  file,
  colorScheme,
  viewMode,
  isFocused = false,
  focusedLine,
  onLineClick,
  renderAfterLine,
  hasCommentOnLine,
  isViewed = false,
  isChangedSinceViewed = false,
  onToggleViewed,
  isCollapsed = false,
  onToggleCollapsed,
}: DiffFileProps) {
  const filePath = file.isRename === true ? file.newName : file.newName || file.oldName;
  const sectionId = filePathToId(filePath);
  const schemeClass = colorSchemeClass(colorScheme);
  const language = getFileLanguage(filePath);
  const sectionClass = ['diff-file-section', isFocused ? 'diff-file-section--focused' : '']
    .filter(Boolean)
    .join(' ');

  const isNewFile = file.oldName === '' || (file.deletedLines === 0 && file.addedLines > 0);
  const isDeletedFile = file.newName === '' || (file.addedLines === 0 && file.deletedLines > 0);
  const showPlaceholder = viewMode === 'side-by-side' && (isNewFile || isDeletedFile);

  return (
    <section key={sectionId} id={sectionId} className={sectionClass}>
      <div
        className="diff-file-section__header"
        onClick={onToggleCollapsed}
        role={onToggleCollapsed ? 'button' : undefined}
      >
        {onToggleCollapsed && (
          <span className="diff-file-section__collapse-toggle">
            {isCollapsed ? '\u25B6' : '\u25BC'}
          </span>
        )}
        <span className="diff-file-section__filename">{filePath}</span>
        <CopyPathButton path={filePath} />
        <span className="diff-file-section__stats">
          {file.addedLines > 0 && (
            <span className="diff-file-section__additions">+{file.addedLines}</span>
          )}
          {file.deletedLines > 0 && (
            <span className="diff-file-section__deletions">-{file.deletedLines}</span>
          )}
        </span>
        {onToggleViewed != null && (
          <button
            type="button"
            className={`diff-file-section__viewed-btn${isViewed ? ' diff-file-section__viewed-btn--viewed' : ''}${isChangedSinceViewed ? ' diff-file-section__viewed-btn--changed' : ''}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleViewed(filePath, isViewed);
            }}
            title={
              isChangedSinceViewed
                ? 'Changed since last viewed'
                : isViewed
                  ? 'Marked as viewed'
                  : 'Mark as viewed'
            }
          >
            {isChangedSinceViewed ? 'Changed since viewed' : isViewed ? 'Viewed' : 'Mark as viewed'}
          </button>
        )}
      </div>

      {!isCollapsed && (
        <div
          className={`d2h-file-diff ${schemeClass}${viewMode === 'side-by-side' ? ' d2h-file-diff--sbs' : ''}${showPlaceholder ? ' diff-sbs-wrapper' : ''}`}
        >
          {showPlaceholder && (
            <div
              className={`diff-sbs-placeholder ${isNewFile ? 'diff-sbs-placeholder--left' : 'diff-sbs-placeholder--right'}`}
            >
              <svg
                className="diff-sbs-placeholder__icon"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                {isNewFile ? (
                  <>
                    <line x1="12" y1="13" x2="12" y2="19" />
                    <line x1="9" y1="16" x2="15" y2="16" />
                  </>
                ) : (
                  <>
                    <line x1="9" y1="15" x2="15" y2="15" />
                  </>
                )}
              </svg>
              <span className="diff-sbs-placeholder__text">
                {isNewFile ? 'New file' : 'File removed'}
              </span>
            </div>
          )}
          <table className="d2h-diff-table">
            {file.blocks.map((block, idx) => (
              <DiffBlockComponent
                key={`block-${idx}`}
                block={block}
                filePath={filePath}
                language={language}
                viewMode={viewMode}
                focusedLine={focusedLine}
                onLineClick={onLineClick}
                renderAfterLine={renderAfterLine}
                hasCommentOnLine={hasCommentOnLine}
              />
            ))}
          </table>
        </div>
      )}
    </section>
  );
});

// ---------------------------------------------------------------------------
// DiffView (top-level)
// ---------------------------------------------------------------------------

export function DiffView({
  diffText,
  colorScheme = ColorSchemeType.AUTO,
  viewMode = 'line-by-line',
  focusedFile = null,
  focusedLine = null,
  onLineClick,
  renderAfterLine,
  hasCommentOnLine,
  viewedFiles,
  changedSinceViewed,
  onToggleViewed,
  collapsedFiles,
  onToggleCollapsed,
}: DiffViewProps) {
  const diffFiles = useMemo(() => parse(diffText), [diffText]);

  if (diffFiles.length === 0) {
    return null;
  }

  return (
    <div className="diff-view d2h-wrapper">
      {diffFiles.map((file) => {
        const filePath = file.isRename === true ? file.newName : file.newName || file.oldName;
        const sectionId = filePathToId(filePath);

        return (
          <DiffFileComponent
            key={sectionId}
            file={file}
            colorScheme={colorScheme}
            viewMode={viewMode}
            isFocused={focusedFile === filePath}
            focusedLine={focusedLine}
            onLineClick={onLineClick}
            renderAfterLine={renderAfterLine}
            hasCommentOnLine={hasCommentOnLine}
            isViewed={viewedFiles != null && viewedFiles.has(filePath)}
            isChangedSinceViewed={changedSinceViewed != null && changedSinceViewed.has(filePath)}
            onToggleViewed={onToggleViewed}
            isCollapsed={collapsedFiles != null && collapsedFiles.has(filePath)}
            onToggleCollapsed={onToggleCollapsed ? () => onToggleCollapsed(filePath) : undefined}
          />
        );
      })}
    </div>
  );
}
