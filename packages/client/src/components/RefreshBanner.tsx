import { Button } from './ui';

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
      <Button variant="primary" size="sm" onClick={onRefresh}>
        Refresh
      </Button>
      <Button size="sm" onClick={onDismiss} aria-label="Dismiss">
        Dismiss
      </Button>
    </div>
  );
}
