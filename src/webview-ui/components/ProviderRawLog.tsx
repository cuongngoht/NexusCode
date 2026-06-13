import { useState } from 'react';
import { useStreamStore } from '../streamStore';
import { useT } from '../i18n';

export function ProviderRawLog() {
  const { rawLog } = useStreamStore();
  const [expanded, setExpanded] = useState(false);
  const t = useT();

  if (rawLog.length === 0) return null;

  return (
    <div className="nx-raw-log">
      <button
        type="button"
        className="nx-raw-log__toggle"
        onClick={() => setExpanded(prev => !prev)}
        aria-expanded={expanded ? 'true' : 'false'}
      >
        {t.rawLog.toggle}
        <span className="nx-raw-log__chevron" aria-hidden="true">
          {expanded ? '▲' : '▼'}
        </span>
      </button>
      {expanded && (
        <pre
          className="nx-raw-log__content"
          aria-label={t.rawLog.ariaLabel}
        >
          {rawLog.join('')}
        </pre>
      )}
    </div>
  );
}
