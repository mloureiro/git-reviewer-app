import { useParams } from 'react-router-dom';
import { DiffView } from '../components/DiffView';
import { useDiff } from '../hooks/useDiff';
import type { DiffQueryParams } from '../types/review';

function getDiffParams(params: URLSearchParams): DiffQueryParams {
  const uncommitted = params.get('uncommitted');

  if (uncommitted) {
    return { uncommitted: 'true' };
  }

  return {
    base: params.get('base') ?? 'main',
    head: params.get('head') ?? 'HEAD',
  };
}

export function SessionDetailPage() {
  const { commitSha } = useParams<{ commitSha: string }>();
  const searchParams = new URLSearchParams(window.location.search);
  const diffParams = getDiffParams(searchParams);
  const { diff, loading, error } = useDiff(diffParams);

  if (loading) return <div className="loading">Loading diff...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!diff) return <div className="empty">No changes to review.</div>;

  return (
    <div>
      {commitSha && <h2 className="session-title">Session: {commitSha}</h2>}
      <DiffView diffText={diff} />
    </div>
  );
}
