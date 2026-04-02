import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { createSession, fetchRefs } from '../api/reviews';
import { ApiError } from '../api/client';

export function SessionCreatePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [baseRef, setBaseRef] = useState('');
  const [headRef, setHeadRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [branches, setBranches] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');

  useEffect(() => {
    fetchRefs()
      .then((data) => {
        setBranches(data.branches);
        setTags(data.tags);
        setCurrentBranch(data.currentBranch);
        if (data.currentBranch) {
          setHeadRef(data.currentBranch);
        }
      })
      .catch(() => {
        // Refs unavailable — user can still type manually
      });
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const reviewData = await createSession({ title, baseRef, headRef });
      navigate(`/session/${reviewData.session.headCommit}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      setSubmitting(false);
    }
  }

  const refOptions = [
    ...branches.map((b) => ({ value: b, label: b, group: 'branch' as const })),
    ...tags.map((t) => ({ value: t, label: t, group: 'tag' as const })),
  ];

  return (
    <div className="session-create">
      <div className="session-create__header">
        <h1 className="session-create__title">New Review Session</h1>
      </div>

      <form className="session-create__form" onSubmit={handleSubmit}>
        <div className="form-field">
          <label className="form-field__label" htmlFor="title">
            Title
          </label>
          <input
            id="title"
            type="text"
            className="form-field__input"
            placeholder="e.g. Review auth changes"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            disabled={submitting}
          />
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor="baseRef">
            Base Ref
          </label>
          <input
            id="baseRef"
            type="text"
            className="form-field__input"
            placeholder="e.g. main"
            list="baseRef-options"
            value={baseRef}
            onChange={(e) => setBaseRef(e.target.value)}
            required
            disabled={submitting}
            autoComplete="off"
          />
          <datalist id="baseRef-options">
            {refOptions.map(({ value, group }) => (
              <option key={`${group}-${value}`} value={value}>
                {group === 'tag' ? `tag: ${value}` : value}
              </option>
            ))}
          </datalist>
          <p className="form-field__hint">
            The branch, tag, or commit to diff against (the &quot;before&quot;).
          </p>
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor="headRef">
            Head Ref
          </label>
          <input
            id="headRef"
            type="text"
            className="form-field__input"
            placeholder="e.g. HEAD"
            list="headRef-options"
            value={headRef}
            onChange={(e) => setHeadRef(e.target.value)}
            required
            disabled={submitting}
            autoComplete="off"
          />
          <datalist id="headRef-options">
            {refOptions.map(({ value, group }) => (
              <option key={`${group}-${value}`} value={value}>
                {group === 'tag' ? `tag: ${value}` : value}
              </option>
            ))}
          </datalist>
          <p className="form-field__hint">
            The branch, tag, or commit to review (the &quot;after&quot;).
            {currentBranch && (
              <span className="form-field__current-branch">
                {' '}
                Current branch: <code>{currentBranch}</code>
              </span>
            )}
          </p>
        </div>

        {error !== null && <p className="session-create__error">{error}</p>}

        <div className="session-create__actions">
          <Link to="/" className="btn btn--secondary">
            Cancel
          </Link>
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Creating\u2026' : 'Create Review'}
          </button>
        </div>
      </form>
    </div>
  );
}
