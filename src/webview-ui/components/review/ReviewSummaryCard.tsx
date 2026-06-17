import React from 'react';
import { Badge, Card, Text } from '@fluentui/react-components';
import type { CodeReviewReport } from '../../../application/code-review/CodeReviewReport';
import { ReviewVerdictBadge } from './ReviewVerdictBadge';
import { ReviewArchitectureScoreCard } from './ReviewArchitectureScoreCard';
import { useT } from '../../i18n';

interface Props {
  report: CodeReviewReport;
}

export function ReviewSummaryCard({ report }: Props): React.ReactElement {
  const t = useT();
  const s = t.codeReview;
  const { stats } = report;

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Verdict row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px', flexWrap: 'wrap' }}>
        <Text weight="semibold" size={400}>{s.verdict}</Text>
        <ReviewVerdictBadge verdict={report.verdict} type="review" />
        {report.architectureVerdict && (
          <>
            <Text size={300} style={{ color: 'var(--vscode-descriptionForeground)' }}>{s.architectureVerdict}:</Text>
            <ReviewVerdictBadge verdict={report.architectureVerdict} type="architecture" />
          </>
        )}
      </div>

      {/* Summary */}
      <Text as="p" size={300} style={{ margin: '0 0 12px' }}>{report.summary}</Text>

      {/* Architecture summary */}
      {report.architectureSummary && (
        <Card style={{ margin: '0 0 12px', padding: '8px 12px' }}>
          <Text weight="semibold">{s.architectureSummary}:</Text>{' '}
          <Text>{report.architectureSummary}</Text>
        </Card>
      )}

      {/* Architecture score */}
      {report.architectureScore && (
        <ReviewArchitectureScoreCard score={report.architectureScore} />
      )}

      {/* Stats row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
        {([
          { key: 'blocker', label: 'Blocker', value: stats.blocker, color: 'danger' as const },
          { key: 'critical', label: 'Critical', value: stats.critical, color: 'important' as const },
          { key: 'major', label: 'Major', value: stats.major, color: 'warning' as const },
          { key: 'minor', label: 'Minor', value: stats.minor, color: 'informative' as const },
          { key: 'nit', label: 'Nit', value: stats.nit, color: 'subtle' as const },
          { key: 'info', label: 'Info', value: stats.info, color: 'brand' as const },
        ] as const).filter(({ value }) => value > 0).map(({ key, label, value, color }) => (
          <Badge key={key} appearance="filled" color={color} size="small">
            {label}: {value}
          </Badge>
        ))}
        {stats.architecture > 0 && (
          <Badge appearance="filled" color="informative" size="small">
            {s.architectureFindings}: {stats.architecture}
          </Badge>
        )}
      </div>

      {/* Changed files count */}
      {report.changedFiles.length > 0 && (
        <Text size={200} style={{ color: 'var(--vscode-descriptionForeground)' }}>
          {s.changedFiles}: {report.changedFiles.length}
        </Text>
      )}
    </div>
  );
}
