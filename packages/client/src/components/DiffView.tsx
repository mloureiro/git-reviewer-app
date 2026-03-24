import React from 'react';
import { parse } from 'diff2html';
import type { DiffBlock, DiffFile, DiffLine } from 'diff2html/lib-esm/types';
import { LineType } from 'diff2html/lib-esm/types';
import { ColorSchemeType } from 'diff2html/lib-esm/types';
import 'diff2html/bundles/css/diff2html.min.css';
import hljs from 'highlight.js/lib/common';

import type { DiffLineData } from '../types/review';

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

// ---------------------------------------------------------------------------
// Props types
// ---------------------------------------------------------------------------

interface DiffLineRowProps {
  line: DiffLine;
  filePath: string;
  language: string | null;
  onLineClick?: (data: DiffLineData) => void;
  hasComment?: boolean;
}

interface DiffBlockProps {
  block: DiffBlock;
  filePath: string;
  language: string | null;
  onLineClick?: (data: DiffLineData) => void;
  renderAfterLine?: (lineData: DiffLineData) => React.ReactNode;
  hasCommentOnLine?: (lineData: DiffLineData) => boolean;
}

interface DiffFileProps {
  file: DiffFile;
  colorScheme: ColorSchemeType;
  onLineClick?: (data: DiffLineData) => void;
  renderAfterLine?: (lineData: DiffLineData) => React.ReactNode;
  hasCommentOnLine?: (lineData: DiffLineData) => boolean;
}

interface DiffViewProps {
  diffText: string;
  colorScheme?: ColorSchemeType;
  onLineClick?: (data: DiffLineData) => void;
  renderAfterLine?: (lineData: DiffLineData) => React.ReactNode;
  hasCommentOnLine?: (lineData: DiffLineData) => boolean;
}

// ---------------------------------------------------------------------------
// DiffLineRow
// ---------------------------------------------------------------------------

export function DiffLineRow({
  line,
  filePath,
  language,
  onLineClick,
  hasComment,
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
    if (onLineClick != null) {
      onLineClick({ file: filePath, line: commentLine, side: commentSide, content: lineContent });
    }
  }

  const rowClass = [
    'd2h-diff-tr',
    typeClass,
    isClickable ? 'diff-line--clickable' : '',
    hasComment === true ? 'diff-line--has-comment' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <tr
      className={rowClass}
      data-file-path={filePath}
      data-line-number={commentLine}
      data-line-side={commentSide}
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
}

// ---------------------------------------------------------------------------
// DiffBlock
// ---------------------------------------------------------------------------

export function DiffBlockComponent({
  block,
  filePath,
  language,
  onLineClick,
  renderAfterLine,
  hasCommentOnLine,
}: DiffBlockProps) {
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

        return (
          <React.Fragment key={rowKey}>
            <DiffLineRow
              line={line}
              filePath={filePath}
              language={language}
              onLineClick={onLineClick}
              hasComment={hasComment}
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

export function DiffFileComponent({
  file,
  colorScheme,
  onLineClick,
  renderAfterLine,
  hasCommentOnLine,
}: DiffFileProps) {
  const filePath = file.isRename === true ? file.newName : file.newName || file.oldName;
  const sectionId = filePathToId(filePath);
  const schemeClass = colorSchemeClass(colorScheme);
  const language = getFileLanguage(filePath);

  return (
    <section key={sectionId} id={sectionId} className="diff-file-section">
      <div className="diff-file-section__header">
        <span className="diff-file-section__filename">{filePath}</span>
        <span className="diff-file-section__stats">
          {file.addedLines > 0 && (
            <span className="diff-file-section__additions">+{file.addedLines}</span>
          )}
          {file.deletedLines > 0 && (
            <span className="diff-file-section__deletions">-{file.deletedLines}</span>
          )}
        </span>
      </div>

      <div className={`d2h-file-diff ${schemeClass}`}>
        <table className="d2h-diff-table">
          {file.blocks.map((block, idx) => (
            <DiffBlockComponent
              key={`block-${idx}`}
              block={block}
              filePath={filePath}
              language={language}
              onLineClick={onLineClick}
              renderAfterLine={renderAfterLine}
              hasCommentOnLine={hasCommentOnLine}
            />
          ))}
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// DiffView (top-level)
// ---------------------------------------------------------------------------

export function DiffView({
  diffText,
  colorScheme = ColorSchemeType.AUTO,
  onLineClick,
  renderAfterLine,
  hasCommentOnLine,
}: DiffViewProps) {
  const diffFiles = parse(diffText);

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
            onLineClick={onLineClick}
            renderAfterLine={renderAfterLine}
            hasCommentOnLine={hasCommentOnLine}
          />
        );
      })}
    </div>
  );
}
