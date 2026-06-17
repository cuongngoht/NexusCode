import React from 'react';
import { Badge, Text } from '@fluentui/react-components';
import type { CodeReviewReport } from '../../../application/code-review/CodeReviewReport';
import { ReviewVerdictBadge } from './ReviewVerdictBadge';
import { ReviewArchitectureScoreCard } from './ReviewArchitectureScoreCard';
import { useT } from '../../i18n';

interface Props {
  report: CodeReviewReport;
}

const SEVERITY_CONFIG = [
  { key: 'blocker',  label: 'Blocker',  color: 'danger'       as const },
  { key: 'critical', label: 'Critical', color: 'important'    as const },
  { key: 'major',    label: 'Major',    color: 'warning'      as const },
  { key: 'minor',    label: 'Minor',    color: 'informative'  as const },
  { key: 'nit',      label: 'Nit',      color: 'subtle'       as const },
  { key: 'info',     label: 'Info',     color: 'brand'        as const },
] as const;

export function ReviewOverview({ report }: Props): React.ReactElement {
  const t = useT();
  const s = t.codeReview;
  const { stats } = report;

  const verdictBg: Record<string, string> = {
    'approve':               'var(--vscode-testing-iconPassed)',
    'approve-with-comments': 'var(--vscode-notificationsWarningIcon-foreground)',
    'request-changes':       'var(--vscode-errorForeground)',
  };
  const verdictBorder = verdictBg[report.verdict] ?? 'var(--vscode-panel-border)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Verdict hero */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        padding: '14px 16px',
        borderRadius: '8px',
        border: `1px solid ${verdictBorder}`,
        background: 'var(--vscode-editorWidget-background)',
        flexWrap: 'wrap',
      }}>
        <ReviewVerdictBadge verdict={report.verdict} type="review" />
        {report.architectureVerdict && (
          <ReviewVerdictBadge verdict={report.architectureVerdict} type="architecture" />
        )}
        <div style={{ flex: 1, minWidth: '160px' }}>
          <Text as="p" size={300} style={{ margin: 0, color: 'var(--vscode-editor-foreground)' }}>
            {report.summary}
          </Text>
        </div>
      </div>

      {/* Severity stats row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
        {SEVERITY_CONFIG.filter(({ key }) => (stats[key as keyof typeof stats] as number) > 0).map(({ key, label, color }) => (
          <Badge key={key} appearance="filled" color={color} size="medium" shape="rounded">
            {label}: {stats[key as keyof typeof stats] as number}
          </Badge>
        ))}
        {stats.architecture > 0 && (
          <Badge appearance="tint" color="informative" size="medium" shape="rounded">
            {s.architectureFindings}: {stats.architecture}
          </Badge>
        )}
        {stats.totalFindings === 0 && (
          <Text size={200} style={{ color: 'var(--vscode-testing-iconPassed)' }}>✓ {s.noFindings}</Text>
        )}
      </div>

      {/* Architecture score (collapsed into mini card) */}
      {report.architectureScore && (
        <ReviewArchitectureScoreCard score={report.architectureScore} />
      )}

      {/* Architecture summary text */}
      {report.architectureSummary && !report.architectureScore && (
        <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)', fontStyle: 'italic' }}>
          {s.architectureSummary}: {report.architectureSummary}
        </Text>
      )}

      {/* Meta row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {report.baseBranch && (
          <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)', fontFamily: 'var(--vscode-editor-font-family)' }}>
            {report.baseBranch}{report.compareBranch ? ` → ${report.compareBranch}` : ''}
          </Text>
        )}
        {report.changedFiles.length > 0 && (
          <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)' }}>
            {report.changedFiles.length} {s.changedFiles.toLowerCase()}
          </Text>
        )}
        <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {new Date(report.generatedAt).toLocaleString()}
        </Text>
      </div>
    </div>
  );
}
