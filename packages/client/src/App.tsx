import { useEffect, useState } from 'react';
import { DiffView } from './components/DiffView';

export function App() {
  const [diffText, setDiffText] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDiff() {
      try {
        const params = new URLSearchParams(window.location.search);
        const base = params.get('base') ?? 'main';
        const head = params.get('head') ?? 'HEAD';
        const uncommitted = params.get('uncommitted');

        const query = uncommitted ? '?uncommitted=true' : `?base=${base}&head=${head}`;
        const response = await fetch(`/api/diff${query}`);
        const data = (await response.json()) as { diff: string; error?: string };

        if (!response.ok) throw new Error(data.error ?? 'Failed to fetch diff');
        setDiffText(data.diff);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    }

    fetchDiff();
  }, []);

  if (loading) return <div className="loading">Loading diff...</div>;
  if (error) return <div className="error">Error: {error}</div>;
  if (!diffText) return <div className="empty">No changes to review.</div>;

  return (
    <div className="app">
      <header className="header">
        <h1>git-reviewer</h1>
      </header>
      <main className="main">
        <DiffView diffText={diffText} />
      </main>
    </div>
  );
}
