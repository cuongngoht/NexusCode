import { useT } from '../../i18n';
import type { AnalyticsDashboardSummary } from '../../messages';

interface Props {
  summary: AnalyticsDashboardSummary;
}

export function QualityMetricsPanel({ summary }: Props) {
  const t = useT();

  const ratedCount = summary.goodFeedbackCount + summary.badFeedbackCount;

  return (
    <div className="nx-analytics-panel">
      <h3 className="nx-analytics-section-title">{t.dashboard.quality}</h3>
      <table className="nx-analytics-table nx-analytics-table--compact">
        <tbody>
          <tr>
            <td>{t.dashboard.acceptanceRate}</td>
            <td className="nx-analytics-metric-value">
              {ratedCount > 0
                ? `${(summary.acceptanceRate * 100).toFixed(1)}%`
                : '—'}
            </td>
          </tr>
          <tr>
            <td>{t.dashboard.feedback.good}</td>
            <td className="nx-analytics-metric-value">{summary.goodFeedbackCount}</td>
          </tr>
          <tr>
            <td>{t.dashboard.feedback.bad}</td>
            <td className="nx-analytics-metric-value">{summary.badFeedbackCount}</td>
          </tr>
          <tr>
            <td>{t.dashboard.metrics.successful}</td>
            <td className="nx-analytics-metric-value">{summary.successfulRuns}</td>
          </tr>
          <tr>
            <td>{t.dashboard.metrics.failed}</td>
            <td className="nx-analytics-metric-value">{summary.failedRuns}</td>
          </tr>
          <tr>
            <td>{t.dashboard.metrics.stopped}</td>
            <td className="nx-analytics-metric-value">{summary.stoppedRuns}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
