import { useEffect, useState } from 'react';
import { fetchFiles } from '../api/reviews';
import type { DiffFile, FilesQueryParams } from '../types/review';

export interface UseFilesResult {
  files: DiffFile[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches the list of changed files from the API for the given query params.
 * Re-fetches whenever params change.
 * Pass `null` to skip fetching (returns idle state with no HTTP request).
 */
export function useFiles(params: FilesQueryParams | null): UseFilesResult {
  const [files, setFiles] = useState<DiffFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stringify params to create a stable primitive dependency that changes only when params content changes
  // null is serialised as the string "null" so it also forms a stable key
  const paramsKey = JSON.stringify(params);

  useEffect(() => {
    const parsedParams = JSON.parse(paramsKey) as FilesQueryParams | null;

    if (parsedParams === null) {
      setFiles([]);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;

    setLoading(true);
    setError(null);

    const currentParams: FilesQueryParams = parsedParams;

    fetchFiles(currentParams)
      .then((response) => {
        if (!cancelled) {
          setFiles(response.files);
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
  }, [paramsKey]);

  return { files, loading, error };
}
