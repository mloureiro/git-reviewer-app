import { DiffView } from './components/DiffView';
import { useDiff } from './hooks/useDiff';
import type { DiffQueryParams } from './types/review';

function getDiffParams(): DiffQueryParams {
  const params = new URLSearchParams(window.location.search);
  const uncommitted = params.get('uncommitted');

  if (uncommitted) {
    return { uncommitted: 'true' };
  }

  return {
    base: params.get('base') ?? 'main',
    head: params.get('head') ?? 'HEAD',
  };
}

export function App() {
  const { diff, loading, error } = useDiff(getDiffParams());

  if (loading) return <div className="loading">Loading diff...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!diff) return <div className="empty">No changes to review.</div>;

  return (
    <div className="app">
      <header className="header">
        <h1>git-reviewer</h1>
      </header>
      <main className="main">
        <DiffView diffText={diff} />
      </main>
    </div>
  );
}
