import React from 'react';

type Severity = 'error' | 'warning' | 'info';

interface Props {
  message: string;
  severity?: Severity;
  action?: { label: string; onClick: () => void };
  onDismiss?: () => void;
}

const ICONS: Record<Severity, string> = {
  error: '✖',
  warning: '⚠',
  info: 'ℹ',
};

export const ErrorBanner: React.FC<Props> = ({
  message, severity = 'error', action, onDismiss,
}) => (
  <div className={`error-banner error-banner--${severity}`} role="alert">
    <span className="error-banner-icon">{ICONS[severity]}</span>
    <span className="error-banner-message">{message}</span>
    {action && (
      <button className="error-banner-action" onClick={action.onClick}>
        {action.label}
      </button>
    )}
    {onDismiss && (
      <button
        className="error-banner-dismiss"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        ✕
      </button>
    )}
  </div>
);
