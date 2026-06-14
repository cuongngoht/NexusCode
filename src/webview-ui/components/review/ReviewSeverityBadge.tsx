import React from 'react';
import type { CodeReviewSeverity } from '../../../application/code-review/CodeReviewSeverity';

interface Props {
  severity: CodeReviewSeverity;
}

const SEVERITY_COLORS: Record<CodeReviewSeverity, string> = {
  blocker:  'var(--vscode-errorForeground)',
  critical: 'var(--vscode-errorForeground)',
  major:    'var(--vscode-notificationsWarningIcon-foreground)',
  minor:    'var(--vscode-editorWarning-foreground)',
  nit:      'var(--vscode-descriptionForeground)',
  info:     'var(--vscode-descriptionForeground)',
};

const SEVERITY_BG: Record<CodeReviewSeverity, string> = {
  blocker:  'color-mix(in srgb, var(--vscode-errorForeground) 15%, transparent)',
  critical: 'color-mix(in srgb, var(--vscode-errorForeground) 10%, transparent)',
  major:    'color-mix(in srgb, var(--vscode-notificationsWarningIcon-foreground) 12%, transparent)',
  minor:    'color-mix(in srgb, var(--vscode-editorWarning-foreground) 10%, transparent)',
  nit:      'color-mix(in srgb, var(--vscode-descriptionForeground) 8%, transparent)',
  info:     'color-mix(in srgb, var(--vscode-descriptionForeground) 6%, transparent)',
};

export function ReviewSeverityBadge({ severity }: Props): React.ReactElement {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: '3px',
        fontSize: '11px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        color: SEVERITY_COLORS[severity],
        background: SEVERITY_BG[severity],
        border: `1px solid ${SEVERITY_COLORS[severity]}`,
      }}
    >
      {severity}
    </span>
  );
}
