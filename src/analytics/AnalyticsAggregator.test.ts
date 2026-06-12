import { describe, it, expect } from 'vitest';
import { AnalyticsAggregator } from './AnalyticsAggregator';
import type { AnalyticsRunRecord } from './AnalyticsTypes';

const aggregator = new AnalyticsAggregator();

function makeRecord(partial?: Partial<AnalyticsRunRecord>): AnalyticsRunRecord {
  return {
    id: `r-${Math.random()}`,
    taskId: `task-${Math.random()}`,
    provider: 'claude',
    mode: 'edit',
    status: 'success',
    inputTokens: 100,
    outputTokens: 200,
    totalTokens: 300,
    originalPromptTokens: 80,
    enhancedPromptTokens: 100,
    contextOverheadTokens: 20,
    estimatedInputCostUsd: 0.0003,
    estimatedOutputCostUsd: 0.003,
    estimatedTotalCostUsd: 0.0033,
    filesChanged: 1,
    linesAdded: 10,
    linesDeleted: 2,
    testsGenerated: 0,
    bugsFixed: 0,
    estimatedTimeSavedMinutes: 5,
    startedAt: Date.now(),
    feedback: 'none',
    ...partial,
  };
}

describe('AnalyticsAggregator — empty input', () => {
  it('returns all-zero summary for empty array', () => {
    const summary = aggregator.aggregate([]);
    expect(summary.totalRuns).toBe(0);
    expect(summary.successfulRuns).toBe(0);
    expect(summary.failedRuns).toBe(0);
    expect(summary.totalTokens).toBe(0);
    expect(summary.totalEstimatedCostUsd).toBe(0);
    expect(summary.byProvider).toHaveLength(0);
    expect(summary.byMode).toHaveLength(0);
  });
});

describe('AnalyticsAggregator — single record', () => {
  it('aggregates single success record correctly', () => {
    const record = makeRecord({ status: 'success', feedback: 'good' });
    const summary = aggregator.aggregate([record]);
    expect(summary.totalRuns).toBe(1);
    expect(summary.successfulRuns).toBe(1);
    expect(summary.failedRuns).toBe(0);
    expect(summary.totalTokens).toBe(300);
    expect(summary.goodFeedbackCount).toBe(1);
    expect(summary.badFeedbackCount).toBe(0);
    expect(summary.acceptanceRate).toBe(1);
  });

  it('aggregates single failed record correctly', () => {
    const record = makeRecord({ status: 'failed' });
    const summary = aggregator.aggregate([record]);
    expect(summary.failedRuns).toBe(1);
    expect(summary.successfulRuns).toBe(0);
  });

  it('aggregates single stopped record correctly', () => {
    const record = makeRecord({ status: 'stopped' });
    const summary = aggregator.aggregate([record]);
    expect(summary.stoppedRuns).toBe(1);
  });
});

describe('AnalyticsAggregator — multiple providers', () => {
  it('groups records by provider', () => {
    const records = [
      makeRecord({ provider: 'claude', totalTokens: 300 }),
      makeRecord({ provider: 'claude', totalTokens: 200 }),
      makeRecord({ provider: 'codex', totalTokens: 100 }),
    ];
    const summary = aggregator.aggregate(records);
    expect(summary.byProvider).toHaveLength(2);

    const claudeSummary = summary.byProvider.find(p => p.provider === 'claude')!;
    expect(claudeSummary.totalRuns).toBe(2);
    expect(claudeSummary.totalTokens).toBe(500);

    const codexSummary = summary.byProvider.find(p => p.provider === 'codex')!;
    expect(codexSummary.totalRuns).toBe(1);
    expect(codexSummary.totalTokens).toBe(100);
  });
});

describe('AnalyticsAggregator — reliability', () => {
  it('computes reliability as successRuns / totalRuns', () => {
    const records = [
      makeRecord({ provider: 'claude', status: 'success' }),
      makeRecord({ provider: 'claude', status: 'success' }),
      makeRecord({ provider: 'claude', status: 'failed' }),
      makeRecord({ provider: 'claude', status: 'failed' }),
    ];
    const summary = aggregator.aggregate(records);
    const prov = summary.byProvider[0];
    expect(prov.reliability).toBeCloseTo(0.5, 2);
  });

  it('marks confidenceLow = true for fewer than 5 runs', () => {
    const records = [makeRecord(), makeRecord(), makeRecord(), makeRecord()];
    const summary = aggregator.aggregate(records);
    expect(summary.byProvider[0].confidenceLow).toBe(true);
  });

  it('marks confidenceLow = false for 5 or more runs', () => {
    const records = Array.from({ length: 5 }, () => makeRecord());
    const summary = aggregator.aggregate(records);
    expect(summary.byProvider[0].confidenceLow).toBe(false);
  });
});

describe('AnalyticsAggregator — feedback acceptance rate', () => {
  it('computes acceptanceRate = good / (good + bad)', () => {
    const records = [
      makeRecord({ feedback: 'good' }),
      makeRecord({ feedback: 'good' }),
      makeRecord({ feedback: 'bad' }),
      makeRecord({ feedback: 'none' }),
    ];
    const summary = aggregator.aggregate(records);
    // 2 good, 1 bad — none is ignored
    expect(summary.acceptanceRate).toBeCloseTo(2 / 3, 3);
    expect(summary.goodFeedbackCount).toBe(2);
    expect(summary.badFeedbackCount).toBe(1);
  });

  it('returns 0 acceptanceRate when no rated records', () => {
    const records = [makeRecord({ feedback: 'none' })];
    const summary = aggregator.aggregate(records);
    expect(summary.acceptanceRate).toBe(0);
  });
});

describe('AnalyticsAggregator — multiple modes', () => {
  it('groups records by mode', () => {
    const records = [
      makeRecord({ mode: 'edit' }),
      makeRecord({ mode: 'edit' }),
      makeRecord({ mode: 'debug' }),
    ];
    const summary = aggregator.aggregate(records);
    const editMode = summary.byMode.find(m => m.mode === 'edit')!;
    const debugMode = summary.byMode.find(m => m.mode === 'debug')!;
    expect(editMode.totalRuns).toBe(2);
    expect(debugMode.totalRuns).toBe(1);
  });
});

describe('AnalyticsAggregator — latency', () => {
  it('computes average latency from records with latencyMs', () => {
    const records = [
      makeRecord({ latencyMs: 1000 }),
      makeRecord({ latencyMs: 2000 }),
      makeRecord({ latencyMs: undefined }),
    ];
    const summary = aggregator.aggregate(records);
    expect(summary.avgLatencyMs).toBe(1500);
  });

  it('returns 0 avgLatencyMs when no latency data', () => {
    const records = [makeRecord({ latencyMs: undefined })];
    const summary = aggregator.aggregate(records);
    expect(summary.avgLatencyMs).toBe(0);
  });
});

describe('AnalyticsAggregator — conversations', () => {
  it('groups by conversationId', () => {
    const records = [
      makeRecord({ conversationId: 'conv1', conversationTitle: 'Chat 1' }),
      makeRecord({ conversationId: 'conv1' }),
      makeRecord({ conversationId: 'conv2' }),
    ];
    const summary = aggregator.aggregate(records);
    expect(summary.byConversation).toHaveLength(2);
    const conv1 = summary.byConversation.find(c => c.conversationId === 'conv1')!;
    expect(conv1.totalRuns).toBe(2);
    expect(conv1.conversationTitle).toBe('Chat 1');
  });
});

describe('AnalyticsAggregator — workflows', () => {
  it('sorts mostExpensiveWorkflows by cost descending', () => {
    const records = [
      makeRecord({ workflowKey: 'wf-a', workflowName: 'Alpha', estimatedTotalCostUsd: 1.0 }),
      makeRecord({ workflowKey: 'wf-b', workflowName: 'Beta', estimatedTotalCostUsd: 5.0 }),
      makeRecord({ workflowKey: 'wf-c', workflowName: 'Gamma', estimatedTotalCostUsd: 2.0 }),
    ];
    const summary = aggregator.aggregate(records);
    expect(summary.mostExpensiveWorkflows[0].workflowKey).toBe('wf-b');
    expect(summary.mostExpensiveWorkflows[1].workflowKey).toBe('wf-c');
    expect(summary.mostExpensiveWorkflows[2].workflowKey).toBe('wf-a');
  });
});
