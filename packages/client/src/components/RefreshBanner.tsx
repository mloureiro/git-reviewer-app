interface RefreshBannerProps {
  changedRefs: string[];
  onRefresh: () => void;
  onDismiss: () => void;
}

export function RefreshBanner({ changedRefs, onRefresh, onDismiss }: RefreshBannerProps) {
  const refList = changedRefs.map((r) => `\u200B${r}\u200B`).join(', ');

  return (
    <div className="refresh-banner" role="alert">
      <span className="refresh-banner__message">
        New commits detected on <code>{refList}</code>
      </span>
      <button
        className="btn btn--sm btn--primary refresh-banner__btn"
        type="button"
        onClick={onRefresh}
      >
        Refresh
      </button>
      <button
        className="btn btn--sm refresh-banner__dismiss"
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
}
