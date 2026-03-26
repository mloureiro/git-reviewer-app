import { useEffect, useState } from 'react';
import { fetchFiles, fetchCommitFiles } from '../api/reviews';
import type { DiffFile, FilesQueryParams } from '../types/review';

export interface UseFilesResult {
  files: DiffFile[];
  diffHashes: Record<string, string>;
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the list of changed files from the API for the given query params.
 * Re-fetches whenever params change.
 * Pass `null` to skip fetching (returns idle state with no HTTP request).
 *
 * When `commitHash` is provided, fetches files for that single commit
 * instead of the base..head range.
 */
export function useFiles(
  params: FilesQueryParams | null,
  commitHash?: string | null,
): UseFilesResult {
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [diffHashes, setDiffHashes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stringify params to create a stable primitive dependency that changes only when params content changes
  // null is serialised as the string "null" so it also forms a stable key
  const paramsKey = JSON.stringify(params);
  const commitKey = commitHash ?? null;

  useEffect(() => {
    const parsedParams = JSON.parse(paramsKey) as FilesQueryParams | null;

    if (parsedParams === null && commitKey === null) {
      setFiles([]);
      setDiffHashes({});
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    const promise =
      commitKey != null
        ? fetchCommitFiles(commitKey)
        : fetchFiles(parsedParams as FilesQueryParams);

    promise
      .then((response) => {
        if (!cancelled) {
          setFiles(response.files);
          setDiffHashes(response.diffHashes ?? {});
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to fetch files');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [paramsKey, commitKey]);

  return { files, diffHashes, loading, error };
}
