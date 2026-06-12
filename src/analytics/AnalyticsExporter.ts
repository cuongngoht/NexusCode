import type { AnalyticsDashboardSummary, AnalyticsRunRecord, AnalyticsQuery } from './AnalyticsTypes';

const CSV_COLUMNS = [
  'startedAt',
  'provider',
  'model',
  'mode',
  'status',
  'totalTokens',
  'inputTokens',
  'outputTokens',
  'estimatedTotalCostUsd',
  'latencyMs',
  'filesChanged',
  'linesAdded',
  'linesDeleted',
  'testsGenerated',
  'bugsFixed',
  'feedback',
] as const;

function escapeCsvField(val: string | number | undefined): string {
  if (val === undefined || val === null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export class AnalyticsExporter {
  toJson(
    summary: AnalyticsDashboardSummary,
    runs: AnalyticsRunRecord[],
    query?: AnalyticsQuery,
  ): string {
    return JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        query: query ?? null,
        summary,
        runs,
      },
      null,
      2,
    );
  }

  toCsv(runs: AnalyticsRunRecord[]): string {
    const header = CSV_COLUMNS.join(',');
    const rows = runs.map(r => {
      return CSV_COLUMNS.map(col => escapeCsvField((r as unknown as Record<string, unknown>)[col] as string | number | undefined)).join(',');
    });
    return [header, ...rows].join('\n');
  }

  toMarkdown(summary: AnalyticsDashboardSummary, _runs: AnalyticsRunRecord[]): string {
    const lines: string[] = [];

    lines.push('# NexusCode Analytics Report');
    lines.push('');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('');

    lines.push('## Summary');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Total Runs | ${summary.totalRuns} |`);
    lines.push(`| Successful | ${summary.successfulRuns} |`);
    lines.push(`| Failed | ${summary.failedRuns} |`);
    lines.push(`| Stopped | ${summary.stoppedRuns} |`);
    lines.push(`| Total Tokens | ${summary.totalTokens.toLocaleString()} |`);
    lines.push(`| Estimated Cost | $${summary.totalEstimatedCostUsd.toFixed(4)} |`);
    lines.push(`| Avg Latency | ${summary.avgLatencyMs}ms |`);
    lines.push(`| Avg Cost/Run | $${summary.avgCostPerRun.toFixed(4)} |`);
    lines.push('');

    lines.push('## Provider Usage');
    lines.push('');
    lines.push(`| Provider | Runs | Success | Failed | Tokens | Cost | Reliability | Avg Latency |`);
    lines.push(`| --- | --- | --- | --- | --- | --- | --- | --- |`);
    for (const p of summary.byProvider) {
      lines.push(
        `| ${p.provider} | ${p.totalRuns} | ${p.successRuns} | ${p.failedRuns} | ${p.totalTokens.toLocaleString()} | $${p.estimatedCostUsd.toFixed(4)} | ${(p.reliability * 100).toFixed(0)}% | ${p.avgLatencyMs}ms |`,
      );
    }
    lines.push('');

    lines.push('## Mode Usage');
    lines.push('');
    lines.push(`| Mode | Runs | Tokens | Cost |`);
    lines.push(`| --- | --- | --- | --- |`);
    for (const m of summary.byMode) {
      lines.push(
        `| ${m.mode} | ${m.totalRuns} | ${m.totalTokens.toLocaleString()} | $${m.estimatedCostUsd.toFixed(4)} |`,
      );
    }
    lines.push('');

    lines.push('## Productivity');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Files Changed | ${summary.filesChanged} |`);
    lines.push(`| Lines Added | ${summary.linesAdded} |`);
    lines.push(`| Lines Deleted | ${summary.linesDeleted} |`);
    lines.push(`| Tests Generated | ${summary.testsGenerated} |`);
    lines.push(`| Bugs Fixed | ${summary.bugsFixed} |`);
    lines.push(`| Estimated Time Saved | ${summary.estimatedTimeSavedMinutes} min |`);
    lines.push('');

    lines.push('## Quality');
    lines.push('');
    lines.push(`| Metric | Value |`);
    lines.push(`| --- | --- |`);
    lines.push(`| Acceptance Rate | ${(summary.acceptanceRate * 100).toFixed(1)}% |`);
    lines.push(`| Good Feedback | ${summary.goodFeedbackCount} |`);
    lines.push(`| Bad Feedback | ${summary.badFeedbackCount} |`);
    lines.push('');

    if (summary.mostExpensiveWorkflows.length > 0) {
      lines.push('## Most Expensive Workflows');
      lines.push('');
      lines.push(`| Workflow | Runs | Cost |`);
      lines.push(`| --- | --- | --- |`);
      for (const w of summary.mostExpensiveWorkflows) {
        lines.push(
          `| ${w.workflowName ?? w.workflowKey} | ${w.totalRuns} | $${w.estimatedCostUsd.toFixed(4)} |`,
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}
