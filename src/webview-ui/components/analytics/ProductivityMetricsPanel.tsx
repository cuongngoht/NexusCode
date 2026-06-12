import { useT } from '../../i18n';
import type { AnalyticsDashboardSummary } from '../../messages';

interface Props {
  summary: AnalyticsDashboardSummary;
}

function formatMinutes(min: number): string {
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${min}m`;
}

export function ProductivityMetricsPanel({ summary }: Props) {
  const t = useT();

  return (
    <div className="nx-analytics-panel">
      <h3 className="nx-analytics-section-title">{t.dashboard.productivity}</h3>
      <table className="nx-analytics-table nx-analytics-table--compact">
        <tbody>
          <tr>
            <td>{t.dashboard.metrics.filesChanged}</td>
            <td className="nx-analytics-metric-value">{summary.filesChanged}</td>
          </tr>
          <tr>
            <td>{t.dashboard.metrics.linesAdded}</td>
            <td className="nx-analytics-metric-value">{summary.linesAdded.toLocaleString()}</td>
          </tr>
          <tr>
            <td>{t.dashboard.metrics.linesDeleted}</td>
            <td className="nx-analytics-metric-value">{summary.linesDeleted.toLocaleString()}</td>
          </tr>
          <tr>
            <td>{t.dashboard.metrics.testsGenerated}</td>
            <td className="nx-analytics-metric-value">{summary.testsGenerated}</td>
          </tr>
          <tr>
            <td>{t.dashboard.metrics.bugsFixed}</td>
            <td className="nx-analytics-metric-value">{summary.bugsFixed}</td>
          </tr>
          <tr>
            <td>{t.dashboard.metrics.timeSaved}</td>
            <td className="nx-analytics-metric-value">{formatMinutes(summary.estimatedTimeSavedMinutes)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
