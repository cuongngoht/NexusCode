import { useT } from '../../i18n';
import type { ProviderSummary } from '../../messages';

interface Props {
  byProvider: ProviderSummary[];
}

export function ProviderReliabilityChart({ byProvider }: Props) {
  const t = useT();

  if (byProvider.length === 0) return null;

  return (
    <div className="nx-analytics-chart">
      <h3 className="nx-analytics-section-title">{t.dashboard.providerReliability}</h3>
      <table className="nx-analytics-table">
        <thead>
          <tr>
            <th>{t.dashboard.tableHeaders.provider}</th>
            <th>{t.dashboard.tableHeaders.runs}</th>
            <th>{t.dashboard.tableHeaders.reliability}</th>
            <th>{t.dashboard.tableHeaders.avgLatency}</th>
          </tr>
        </thead>
        <tbody>
          {byProvider.map(p => (
            <tr key={p.provider}>
              <td>
                {p.provider}
                {p.confidenceLow && (
                  <span className="nx-analytics-confidence-low" title={t.dashboard.confidenceLow}>
                    {' '}*
                  </span>
                )}
              </td>
              <td>{p.totalRuns}</td>
              <td>
                <div className="nx-analytics-reliability-cell">
                  <div className="nx-analytics-mini-bar-track">
                    <div
                      className="nx-analytics-mini-bar-fill"
                      style={{ '--nx-bar-pct': `${p.reliability * 100}%` } as React.CSSProperties}
                    />
                  </div>
                  <span>{(p.reliability * 100).toFixed(0)}%</span>
                </div>
              </td>
              <td>{p.avgLatencyMs > 0 ? `${p.avgLatencyMs}ms` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {byProvider.some(p => p.confidenceLow) && (
        <p className="nx-analytics-footnote">* {t.dashboard.confidenceLow}</p>
      )}
    </div>
  );
}
