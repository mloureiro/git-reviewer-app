// Allowlist for git ref characters: alphanumeric, hyphen, underscore, dot, slash, tilde, caret
const VALID_REF_RE = /^[a-zA-Z0-9_\-./~^]+$/;

// Sentinel value used for uncommitted (working-tree) sessions — not a real git ref
const WORKING_TREE_SENTINEL = 'working tree';

/**
 * Returns true when `value` is a string that is safe to pass to git as a ref.
 *
 * Uses an allowlist of characters known to be valid in git ref names:
 * alphanumeric, hyphen, underscore, dot, slash, tilde and caret (the latter
 * two allow ancestor notation like HEAD~3 or HEAD^2). Additionally blocks
 * `..` sequences to prevent range / path-traversal ambiguity. The literal
 * string 'working tree' is also accepted because it is the sentinel value used
 * for uncommitted sessions — it is never passed to git commands, but must
 * survive the validation gate so that the endpoint can return an appropriate
 * response.
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
