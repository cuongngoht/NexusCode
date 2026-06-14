import React from 'react';
import type { CodeReviewVerdict } from '../../../application/code-review/CodeReviewReport';
import type { ArchitectureVerdict } from '../../../application/code-review/CodeReviewArchitectureScore';
import { useT } from '../../i18n';

interface Props {
  verdict: CodeReviewVerdict | ArchitectureVerdict;
  type?: 'review' | 'architecture';
}

const VERDICT_COLORS: Record<string, string> = {
  'approve':               'var(--vscode-testing-iconPassed)',
  'approve-with-comments': 'var(--vscode-notificationsWarningIcon-foreground)',
  'request-changes':       'var(--vscode-errorForeground)',
  'healthy':               'var(--vscode-testing-iconPassed)',
  'acceptable-with-debt':  'var(--vscode-notificationsWarningIcon-foreground)',
  'needs-refactor':        'var(--vscode-editorWarning-foreground)',
  'architecture-blocker':  'var(--vscode-errorForeground)',
};

export function ReviewVerdictBadge({ verdict, type = 'review' }: Props): React.ReactElement {
  const t = useT();
  const labelMap = type === 'architecture'
    ? t.codeReview.architectureVerdicts as Record<string, string>
    : t.codeReview.verdicts as Record<string, string>;

  const label = labelMap[verdict] ?? verdict;
  const color = VERDICT_COLORS[verdict] ?? 'var(--vscode-foreground)';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 600,
        color,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        border: `1px solid ${color}`,
      }}
    >
      {label}
    </span>
  );
}
