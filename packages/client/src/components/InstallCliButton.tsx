import { useState, useCallback } from 'react';

function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

export function InstallCliButton() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleInstall = useCallback(async () => {
    setStatus('loading');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const result = (await invoke('install_cli')) as string;
      setStatus('success');
      setMessage(result);
    } catch (err) {
      setStatus('error');
      setMessage(err instanceof Error ? err.message : String(err));
    }
  }, []);

  if (!isTauri()) {
    return null;
  }

  return (
    <div className="install-cli">
      <button
        className="btn btn--secondary btn--sm"
        onClick={handleInstall}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Installing...' : 'Install CLI'}
      </button>
      {status === 'success' && (
        <span className="install-cli__message install-cli__message--success">{message}</span>
      )}
      {status === 'error' && (
        <span className="install-cli__message install-cli__message--error">{message}</span>
      )}
    </div>
  );
}
