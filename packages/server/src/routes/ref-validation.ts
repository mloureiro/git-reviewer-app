// Allowlist for git ref characters: letters, digits, hyphen, underscore, dot, slash
const VALID_REF_RE = /^[a-zA-Z0-9_\-./]+$/;

// Sentinel value used for uncommitted (working-tree) sessions — not a real git ref
const WORKING_TREE_SENTINEL = 'working tree';

/**
 * Returns true when `value` is a string that is safe to pass to git as a ref.
 *
 * Uses an allowlist of characters permitted in git ref names (letters, digits,
 * hyphen, underscore, dot, slash) and additionally blocks `..` sequences to
 * prevent path traversal. The literal string 'working tree' is also accepted
 * because it is the sentinel value used for uncommitted sessions — it is never
 * passed to git commands, but must survive the validation gate so that the
 * endpoint can return an appropriate response.
 */
export function isValidRef(value: unknown): value is string {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (value === WORKING_TREE_SENTINEL) return true;
  if (value.includes('..')) return false;
  return VALID_REF_RE.test(value);
}

export function isUncommittedSession(headRef: string): boolean {
  return headRef === WORKING_TREE_SENTINEL;
}
