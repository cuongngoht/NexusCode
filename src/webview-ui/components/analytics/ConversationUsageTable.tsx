import { useT } from '../../i18n';
import type { ConversationSummary } from '../../messages';

interface Props {
  conversations: ConversationSummary[];
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function ConversationUsageTable({ conversations }: Props) {
  const t = useT();

  if (conversations.length === 0) return null;

  // Show top 10 by cost
  const sorted = [...conversations]
    .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)
    .slice(0, 10);

  return (
    <div className="nx-analytics-panel">
      <h3 className="nx-analytics-section-title">{t.dashboard.conversationUsage}</h3>
      <table className="nx-analytics-table">
        <thead>
          <tr>
            <th>{t.dashboard.tableHeaders.conversation}</th>
            <th>{t.dashboard.tableHeaders.runs}</th>
            <th>{t.dashboard.tableHeaders.tokens}</th>
            <th>{t.dashboard.tableHeaders.cost}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map(c => (
            <tr key={c.conversationId}>
              <td className="nx-analytics-conv-title">
                {c.conversationTitle ?? c.conversationId.slice(0, 8) + '…'}
              </td>
              <td>{c.totalRuns}</td>
              <td>{formatTokens(c.totalTokens)}</td>
              <td>{formatCost(c.estimatedCostUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
