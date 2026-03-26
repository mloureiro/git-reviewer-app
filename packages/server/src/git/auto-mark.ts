import type { AutoMarkRule, DiffFile } from '@git-reviewer/shared';

/** Known lock-file basenames. */
const LOCKFILE_NAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'Gemfile.lock',
  'Pipfile.lock',
  'poetry.lock',
  'composer.lock',
  'Cargo.lock',
  'go.sum',
  'flake.lock',
  'bun.lockb',
  'bun.lock',
]);

/** Path patterns that indicate generated / build output files. */
const GENERATED_PATTERNS = [
  /\.generated\./,
  /\.min\./,
  /(?:^|\/)(dist|build|out|output|__generated__)\//,
  /\.d\.ts$/,
  /\.map$/,
];

/**
 * Regex matching import / require / re-export statements.
 * Covers:
 *   import ... from '...'
 *   import '...'
 *   require('...')
 *   export ... from '...'
 */
const IMPORT_LINE_RE =
  /^\s*(import\b.*|export\b.*from\b.*|(?:const|let|var)\s+\S+\s*=\s*require\s*\(.*\)\s*;?\s*|require\s*\(.*\)\s*;?\s*)$/;

/** Result of a single auto-mark evaluation. */
export interface AutoMarkMatch {
  path: string;
  rule: AutoMarkRule;
}

/**
 * Evaluate the given auto-mark rules against a set of diff files.
 * Returns an array of matches (one per file that satisfies at least one rule).
 * Each file appears at most once, matched by the first applicable rule.
 */
export function evaluateAutoMarkRules(
  files: DiffFile[],
  diffText: string,
  rules: AutoMarkRule[],
): AutoMarkMatch[] {
  if (rules.length === 0) return [];

  // Pre-parse per-file diff sections for content-based rules
  const fileDiffSections = rules.some((r) => r === 'import-only' || r === 'whitespace-only')
    ? parseFileDiffSections(diffText)
    : new Map<string, string>();

  const matches: AutoMarkMatch[] = [];
  const matchedPaths = new Set<string>();

  for (const rule of rules) {
    for (const file of files) {
      if (matchedPaths.has(file.path)) continue;

      const matched = evaluateSingleRule(rule, file, fileDiffSections.get(file.path) ?? '');
      if (matched) {
        matches.push({ path: file.path, rule });
        matchedPaths.add(file.path);
      }
    }
  }

  return matches;
}

function evaluateSingleRule(rule: AutoMarkRule, file: DiffFile, diffSection: string): boolean {
  switch (rule) {
    case 'rename-only':
      return file.status === 'renamed' && file.additions === 0 && file.deletions === 0;

    case 'lockfile':
      return isLockfile(file.path);

    case 'generated':
      return isGenerated(file.path);

    case 'import-only':
      return isImportOnly(diffSection);

    case 'whitespace-only':
      return isWhitespaceOnly(diffSection);

    default:
      return false;
  }
}

function isLockfile(filePath: string): boolean {
  const basename = filePath.split('/').pop() ?? '';
  return LOCKFILE_NAMES.has(basename);
}

function isGenerated(filePath: string): boolean {
  return GENERATED_PATTERNS.some((pattern) => pattern.test(filePath));
}

/**
 * Check if all changed lines (additions/deletions) in a diff section
 * are import/require statements.
 */
function isImportOnly(diffSection: string): boolean {
  if (!diffSection) return false;

  const changedLines = extractChangedLines(diffSection);
  if (changedLines.length === 0) return false;

  return changedLines.every((line) => IMPORT_LINE_RE.test(line));
}

/**
 * Check if stripping whitespace from added/removed lines yields no difference.
 * i.e. only whitespace/formatting changed.
 */
function isWhitespaceOnly(diffSection: string): boolean {
  if (!diffSection) return false;

  const lines = diffSection.split('\n');
  const added: string[] = [];
  const removed: string[] = [];
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;

    if (line.startsWith('+') && !line.startsWith('+++')) {
      added.push(line.slice(1));
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      removed.push(line.slice(1));
    }
  }

  if (added.length === 0 && removed.length === 0) return false;

  const normalise = (s: string): string => s.replace(/\s+/g, '');
  const normalisedAdded = added.map(normalise).sort().join('\n');
  const normalisedRemoved = removed.map(normalise).sort().join('\n');

  return normalisedAdded === normalisedRemoved;
}

/**
 * Extract the content of added/removed lines (without the +/- prefix)
 * from a unified diff section.
 */
function extractChangedLines(diffSection: string): string[] {
  const lines = diffSection.split('\n');
  const changed: string[] = [];
  let inHunk = false;

  for (const line of lines) {
    if (line.startsWith('@@')) {
      inHunk = true;
      continue;
    }
    if (!inHunk) continue;

    if (
      (line.startsWith('+') && !line.startsWith('+++')) ||
      (line.startsWith('-') && !line.startsWith('---'))
    ) {
      changed.push(line.slice(1));
    }
  }

  return changed;
}

/**
 * Split a unified diff text into per-file sections keyed by file path.
 */
function parseFileDiffSections(diffText: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!diffText.trim()) return result;

  const sections = diffText.split(/^(?=diff --git )/m).filter(Boolean);

  for (const section of sections) {
    const headerMatch = section.match(/^diff --git a\/(.+?) b\/(.+)/m);
    if (headerMatch == null) continue;

    const filePath = headerMatch[2] as string;
    result.set(filePath, section);
  }

  return result;
}
