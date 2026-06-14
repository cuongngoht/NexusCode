import React from 'react';
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
        <span style={{ fontWeight: 600, fontSize: '14px' }}>{s.verdict}</span>
        <ReviewVerdictBadge verdict={report.verdict} type="review" />
        {report.architectureVerdict && (
          <>
            <span style={{ fontSize: '13px', color: 'var(--vscode-descriptionForeground)' }}>{s.architectureVerdict}:</span>
            <ReviewVerdictBadge verdict={report.architectureVerdict} type="architecture" />
          </>
        )}
      </div>

      {/* Summary */}
      <p style={{ margin: '0 0 12px', fontSize: '13px' }}>{report.summary}</p>

      {/* Architecture summary */}
      {report.architectureSummary && (
        <div style={{ margin: '0 0 12px', padding: '8px 12px', background: 'var(--vscode-sideBar-background)', borderRadius: '4px', fontSize: '13px' }}>
          <strong>{s.architectureSummary}:</strong> {report.architectureSummary}
        </div>
      )}

      {/* Architecture score */}
      {report.architectureScore && (
        <ReviewArchitectureScoreCard score={report.architectureScore} />
      )}

      {/* Stats row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
        {([
          { key: 'blocker', label: 'Blocker', value: stats.blocker },
          { key: 'critical', label: 'Critical', value: stats.critical },
          { key: 'major', label: 'Major', value: stats.major },
          { key: 'minor', label: 'Minor', value: stats.minor },
          { key: 'nit', label: 'Nit', value: stats.nit },
          { key: 'info', label: 'Info', value: stats.info },
        ] as const).filter(({ value }) => value > 0).map(({ key, label, value }) => (
          <span key={key} style={{
            fontSize: '12px', padding: '2px 8px',
            borderRadius: '10px',
            background: 'var(--vscode-badge-background)',
            color: 'var(--vscode-badge-foreground)',
          }}>
            {label}: {value}
          </span>
        ))}
        {stats.architecture > 0 && (
          <span style={{ fontSize: '12px', padding: '2px 8px', borderRadius: '10px', background: 'var(--vscode-badge-background)', color: 'var(--vscode-badge-foreground)' }}>
            {s.architectureFindings}: {stats.architecture}
          </span>
        )}
      </div>

      {/* Changed files count */}
      {report.changedFiles.length > 0 && (
        <div style={{ fontSize: '12px', color: 'var(--vscode-descriptionForeground)' }}>
          {s.changedFiles}: {report.changedFiles.length}
        </div>
      )}
    </div>
  );
}
