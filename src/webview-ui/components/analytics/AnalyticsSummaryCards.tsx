import { useT } from '../../i18n';
import type { AnalyticsDashboardSummary } from '../../messages';

interface Props {
  summary: AnalyticsDashboardSummary;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function formatMinutes(min: number): string {
  if (min >= 60) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${min}m`;
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

interface CardProps {
  label: string;
  value: string;
  sub?: string;
}

function SummaryCard({ label, value, sub }: CardProps) {
  return (
    <div className="nx-analytics-card">
      <div className="nx-analytics-card-label">{label}</div>
      <div className="nx-analytics-card-value">{value}</div>
      {sub && <div className="nx-analytics-card-sub">{sub}</div>}
    </div>
  );
}

export function AnalyticsSummaryCards({ summary }: Props) {
  const t = useT();

  const successRate = summary.totalRuns > 0
    ? summary.successfulRuns / summary.totalRuns
    : 0;

  return (
    <div className="nx-analytics-cards">
      <SummaryCard
        label={t.dashboard.totalTokens}
        value={formatNumber(summary.totalTokens)}
        sub={`${formatNumber(summary.totalInputTokens)} in / ${formatNumber(summary.totalOutputTokens)} out`}
      />
      <SummaryCard
        label={t.dashboard.estimatedCost}
        value={formatCost(summary.totalEstimatedCostUsd)}
        sub={`${formatCost(summary.avgCostPerRun)} / run`}
      />
      <SummaryCard
        label={t.dashboard.tasksCompleted}
        value={formatNumber(summary.tasksCompleted)}
        sub={`${summary.totalRuns} total runs`}
      />
      <SummaryCard
        label={t.dashboard.timeSaved}
        value={formatMinutes(summary.estimatedTimeSavedMinutes)}
        sub={`${summary.filesChanged} files · ${formatNumber(summary.linesAdded + summary.linesDeleted)} lines`}
      />
      <SummaryCard
        label={t.dashboard.successRate}
        value={formatPercent(successRate)}
        sub={`${summary.failedRuns} failed · ${summary.stoppedRuns} stopped`}
      />
      <SummaryCard
        label={t.dashboard.acceptanceRate}
        value={summary.goodFeedbackCount + summary.badFeedbackCount > 0
          ? formatPercent(summary.acceptanceRate)
          : '—'}
        sub={`${summary.goodFeedbackCount} good · ${summary.badFeedbackCount} bad`}
      />
    </div>
  );
}
