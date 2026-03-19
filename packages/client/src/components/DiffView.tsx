import { parse } from 'diff2html';
import type { DiffBlock, DiffFile, DiffLine } from 'diff2html/lib-esm/types';
import { LineType } from 'diff2html/lib-esm/types';
import { ColorSchemeType } from 'diff2html/lib-esm/types';
import 'diff2html/bundles/css/diff2html.min.css';

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

// ---------------------------------------------------------------------------
// Props types
// ---------------------------------------------------------------------------

interface DiffLineRowProps {
  line: DiffLine;
  filePath: string;
  onLineClick?: (data: DiffLineData) => void;
}

interface DiffBlockProps {
  block: DiffBlock;
  filePath: string;
  onLineClick?: (data: DiffLineData) => void;
}

interface DiffFileProps {
  file: DiffFile;
  colorScheme: ColorSchemeType;
  onLineClick?: (data: DiffLineData) => void;
}

interface DiffViewProps {
  diffText: string;
  colorScheme?: ColorSchemeType;
  onLineClick?: (data: DiffLineData) => void;
}

// ---------------------------------------------------------------------------
// DiffLineRow
// ---------------------------------------------------------------------------

export function DiffLineRow({ line, filePath, onLineClick }: DiffLineRowProps) {
  const typeClass = lineTypeClass(line.type);
  const oldNum = line.type !== LineType.INSERT ? line.oldNumber : undefined;
  const newNum = line.type !== LineType.DELETE ? line.newNumber : undefined;
  const lineContent = stripLinePrefix(line.content);

  // The authoritative line number for the comment system: prefer newNumber
  // (insert / context), fall back to oldNumber (delete).
  const commentLine = newNum ?? oldNum ?? 0;
  const commentSide: 'left' | 'right' = line.type === LineType.DELETE ? 'left' : 'right';

  function handleClick(): void {
    if (onLineClick != null) {
      onLineClick({ file: filePath, line: commentLine, side: commentSide, content: lineContent });
    }
  }

  return (
    <tr
      className={`d2h-diff-tr ${typeClass}`}
      data-file-path={filePath}
      data-line-number={commentLine}
      data-line-side={commentSide}
      onClick={onLineClick != null ? handleClick : undefined}
    >
      {/* Left line number */}
      <td className="d2h-code-linenumber">
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
        <span className="d2h-code-line-ctn">{lineContent}</span>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// DiffBlock
// ---------------------------------------------------------------------------

export function DiffBlockComponent({ block, filePath, onLineClick }: DiffBlockProps) {
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

      {block.lines.map((line, idx) => (
        <DiffLineRow
          key={`${line.type}-${line.oldNumber ?? 'x'}-${line.newNumber ?? 'x'}-${idx}`}
          line={line}
          filePath={filePath}
          onLineClick={onLineClick}
        />
      ))}
    </tbody>
  );
}

// ---------------------------------------------------------------------------
// DiffFileComponent
// ---------------------------------------------------------------------------

export function DiffFileComponent({ file, colorScheme, onLineClick }: DiffFileProps) {
  const filePath = file.isRename === true ? file.newName : file.newName || file.oldName;
  const sectionId = filePathToId(filePath);
  const schemeClass = colorSchemeClass(colorScheme);

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
              onLineClick={onLineClick}
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
          />
        );
      })}
    </div>
  );
}
