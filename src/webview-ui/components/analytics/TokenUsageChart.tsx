import type { ProviderSummary } from '../../messages';

interface Props {
  byProvider: ProviderSummary[];
  title: string;
}

export function TokenUsageChart({ byProvider, title }: Props) {
  if (byProvider.length === 0) return null;

  const maxTokens = Math.max(...byProvider.map(p => p.totalTokens), 1);

  return (
    <div className="nx-analytics-chart">
      <h3 className="nx-analytics-section-title">{title}</h3>
      <div className="nx-analytics-bars">
        {byProvider.map(p => (
          <div key={p.provider} className="nx-analytics-bar-row">
            <div className="nx-analytics-bar-label">{p.provider}</div>
            <div className="nx-analytics-bar-track">
              <div
                className="nx-analytics-bar-fill"
                style={{ '--nx-bar-pct': `${(p.totalTokens / maxTokens) * 100}%` } as React.CSSProperties}
                title={`${p.totalTokens.toLocaleString()} tokens`}
              />
            </div>
            <div className="nx-analytics-bar-value">
              {p.totalTokens >= 1_000_000
                ? `${(p.totalTokens / 1_000_000).toFixed(1)}M`
                : p.totalTokens >= 1_000
                  ? `${(p.totalTokens / 1_000).toFixed(1)}K`
                  : String(p.totalTokens)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
