import { useT } from '../../i18n';
import type { WorkflowSummary } from '../../messages';

interface Props {
  workflows: WorkflowSummary[];
}

function formatCost(usd: number): string {
  if (usd < 0.001) return `$${usd.toFixed(6)}`;
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

export function WorkflowCostTable({ workflows }: Props) {
  const t = useT();

  if (workflows.length === 0) return null;

  return (
    <div className="nx-analytics-panel">
      <h3 className="nx-analytics-section-title">{t.dashboard.mostExpensiveWorkflows}</h3>
      <table className="nx-analytics-table">
        <thead>
          <tr>
            <th>{t.dashboard.tableHeaders.workflow}</th>
            <th>{t.dashboard.tableHeaders.runs}</th>
            <th>{t.dashboard.tableHeaders.cost}</th>
          </tr>
        </thead>
        <tbody>
          {workflows.map(w => (
            <tr key={w.workflowKey}>
              <td>{w.workflowName ?? w.workflowKey}</td>
              <td>{w.totalRuns}</td>
              <td>{formatCost(w.estimatedCostUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
