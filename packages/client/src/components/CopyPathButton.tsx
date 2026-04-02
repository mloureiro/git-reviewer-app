import { useState, useCallback } from 'react';

export function CopyPathButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard
        .writeText(path)
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
        .catch(() => {
          // Clipboard API may not be available in some contexts
        });
    },
    [path],
  );

  return (
    <button
      type="button"
      className="copy-path-btn"
      onClick={handleCopy}
      title={copied ? 'Copied!' : `Copy path: ${path}`}
      aria-label={`Copy file path: ${path}`}
    >
      {copied ? '\u2713' : '\u2398'}
    </button>
  );
}
