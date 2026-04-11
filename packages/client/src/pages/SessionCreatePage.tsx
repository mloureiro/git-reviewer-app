import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { createSession, fetchRefs, fetchRepos } from '../api/reviews';
import { ApiError } from '../api/client';
import { Button, LinkButton, TextInput, ComboBox } from '../components/ui';
import type { ComboBoxOption } from '../components/ui';

function repoDisplayName(repoPath: string): string {
  if (!repoPath) return 'Unknown';
  const segments = repoPath.replace(/\/+$/, '').split('/');
  return segments[segments.length - 1] || repoPath;
}

const REF_GROUP_ORDER = ['Local branches', 'Remote branches', 'Tags'];

export function SessionCreatePage(): React.ReactNode {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [baseRef, setBaseRef] = useState('');
  const [headRef, setHeadRef] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [repos, setRepos] = useState<string[]>([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [remoteBranches, setRemoteBranches] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [currentBranch, setCurrentBranch] = useState('');

  const titleTouched = useRef(false);

  useEffect(() => {
    let cancelled = false;

    fetchRepos()
      .then((data) => {
        if (!cancelled) {
          setRepos(data.repos);
          if (data.repos.length > 0 && !selectedRepo) {
            setSelectedRepo(data.repos[0] ?? '');
          }
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
    // Intentionally run only once on mount — selectedRepo is read as initial value only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRepo && repos.length === 0) return;

    let cancelled = false;

    setBranches([]);
    setRemoteBranches([]);
    setTags([]);
    setCurrentBranch('');
    setBaseRef('');
    setHeadRef('');
    titleTouched.current = false;

    const repo = selectedRepo || undefined;
    fetchRefs(repo)
      .then((data) => {
        if (!cancelled) {
          setBranches(data.branches);
          setRemoteBranches(data.remoteBranches);
          setTags(data.tags);
          setCurrentBranch(data.currentBranch);

          // Smart base branch default
          const allLocal = data.branches;
          const allRemote = data.remoteBranches;
          if (allLocal.includes('master')) {
            setBaseRef('master');
          } else if (allLocal.includes('main')) {
            setBaseRef('main');
          } else if (allRemote.includes('master')) {
            setBaseRef('master');
          } else if (allRemote.includes('main')) {
            setBaseRef('main');
          }

          if (data.currentBranch) {
            setHeadRef(data.currentBranch);
            if (!titleTouched.current) {
              setTitle(data.currentBranch);
            }
          }
        }
      })
      .catch(() => {
        // Refs unavailable — user can still type manually
      });

    return () => {
      cancelled = true;
    };
    // repos.length is intentionally excluded — this effect is driven by selectedRepo changes only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRepo]);

  function handleHeadRefChange(value: string) {
    setHeadRef(value);
    if (!titleTouched.current) {
      setTitle(value);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const repo = selectedRepo || undefined;
      const response = await createSession({ title, baseRef, headRef }, repo);
      navigate(`/session/${response.session.session.headCommit}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
      setSubmitting(false);
    }
  }

  const refOptions: ComboBoxOption[] = [
    ...branches.map((b) => ({ value: b, label: b, group: 'Local branches' })),
    ...remoteBranches.map((b) => ({ value: b, label: b, group: 'Remote branches' })),
    ...tags.map((t) => ({ value: t, label: t, group: 'Tags' })),
  ];

  const repoOptions: ComboBoxOption[] = repos.map((r) => ({
    value: r,
    label: repoDisplayName(r),
  }));

  return (
    <div className="session-create">
      <div className="session-create__header">
        <h1 className="session-create__title">New Review</h1>
      </div>

      <form className="session-create__form" onSubmit={handleSubmit}>
        {repos.length > 1 && (
          <div className="form-field">
            <label className="form-field__label" htmlFor="repo">
              Repository
            </label>
            <ComboBox
              id="repo"
              options={repoOptions}
              value={selectedRepo}
              onChange={setSelectedRepo}
              disabled={submitting}
            />
          </div>
        )}

        <div className="form-field">
          <label className="form-field__label" htmlFor="title">
            Title
          </label>
          <TextInput
            id="title"
            placeholder="e.g. Review auth changes"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              titleTouched.current = true;
            }}
            required
            disabled={submitting}
          />
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor="baseRef">
            Base Ref
          </label>
          <ComboBox
            id="baseRef"
            options={refOptions}
            value={baseRef}
            onChange={setBaseRef}
            placeholder="e.g. main"
            required
            disabled={submitting}
            groupOrder={REF_GROUP_ORDER}
          />
          <p className="form-field__hint">
            The branch, tag, or commit to diff against (the &quot;before&quot;).
          </p>
        </div>

        <div className="form-field">
          <label className="form-field__label" htmlFor="headRef">
            Head Ref
          </label>
          <ComboBox
            id="headRef"
            options={refOptions}
            value={headRef}
            onChange={handleHeadRefChange}
            placeholder="e.g. HEAD"
            required
            disabled={submitting}
            groupOrder={REF_GROUP_ORDER}
          />
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
          <LinkButton to="/">Cancel</LinkButton>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? 'Creating\u2026' : 'Create Review'}
          </Button>
        </div>
      </form>
    </div>
  );
}
