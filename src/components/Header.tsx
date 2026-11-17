import { useStore } from '../lib/store';

const LABEL = { connecting: 'Connecting', live: 'Live', reconnecting: 'Reconnecting', offline: 'Offline' } as const;

export function Header() {
  const status = useStore((s) => s.status);
  return (
    <header className="top">
      <div className="brand">
        tickerline<span>.</span>
      </div>
      <div className={`status ${status}`} role="status" aria-live="polite">
        <i aria-hidden="true" />
        {LABEL[status]}
      </div>
    </header>
  );
}
