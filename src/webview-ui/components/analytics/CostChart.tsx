import type { ProviderSummary } from '../../messages';

interface Props {
  byProvider: ProviderSummary[];
  title: string;
}

function formatCost(usd: number): string {
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function CostChart({ byProvider, title }: Props) {
  if (byProvider.length === 0) return null;

  const maxCost = Math.max(...byProvider.map(p => p.estimatedCostUsd), 0.000001);

  return (
    <div className="nx-analytics-chart">
      <h3 className="nx-analytics-section-title">{title}</h3>
      <div className="nx-analytics-bars">
        {byProvider.map(p => (
          <div key={p.provider} className="nx-analytics-bar-row">
            <div className="nx-analytics-bar-label">{p.provider}</div>
            <div className="nx-analytics-bar-track">
              <div
                className="nx-analytics-bar-fill nx-analytics-bar-fill--cost"
                style={{ '--nx-bar-pct': `${(p.estimatedCostUsd / maxCost) * 100}%` } as React.CSSProperties}
                title={formatCost(p.estimatedCostUsd)}
              />
            </div>
            <div className="nx-analytics-bar-value">{formatCost(p.estimatedCostUsd)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
