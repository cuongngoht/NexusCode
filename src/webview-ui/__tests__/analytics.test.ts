import { describe, it, expect } from 'vitest';
import { reducer, createInitialState } from '../messages';
import type { AppState, AppAction, AnalyticsDashboardSummary, AnalyticsRunRecord } from '../messages';

function s(): AppState { return createInitialState(); }
const act = (state: AppState, action: AppAction) => reducer(state, action);

function makeSummary(): AnalyticsDashboardSummary {
  return {
    totalRuns: 10,
    successfulRuns: 8,
    failedRuns: 1,
    stoppedRuns: 1,
    totalInputTokens: 1000,
    totalOutputTokens: 2000,
    totalTokens: 3000,
    totalEstimatedCostUsd: 0.05,
    avgLatencyMs: 1500,
    avgCostPerRun: 0.005,
    tasksCompleted: 8,
    filesChanged: 5,
    linesAdded: 100,
    linesDeleted: 20,
    testsGenerated: 3,
    bugsFixed: 1,
    estimatedTimeSavedMinutes: 30,
    acceptanceRate: 0.8,
    goodFeedbackCount: 4,
    badFeedbackCount: 1,
    byProvider: [
      {
        provider: 'claude',
        totalRuns: 10,
        successRuns: 8,
        failedRuns: 1,
        stoppedRuns: 1,
        totalTokens: 3000,
        estimatedCostUsd: 0.05,
        reliability: 0.8,
        avgLatencyMs: 1500,
        confidenceLow: false,
      },
    ],
    byMode: [{ mode: 'edit', totalRuns: 10, totalTokens: 3000, estimatedCostUsd: 0.05 }],
    byConversation: [],
    byWorkspace: [],
    mostUsedAgents: [],
    mostUsedSkills: [],
    mostExpensiveWorkflows: [],
  };
}

function makeRun(partial?: Partial<AnalyticsRunRecord>): AnalyticsRunRecord {
  return {
    id: '1',
    taskId: 'task1',
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

describe('analytics state — setMainView', () => {
  it('starts with mainView = chat', () => {
    const state = s();
    expect(state.mainView).toBe('chat');
  });

  it('switches to dashboard', () => {
    const state = act(s(), { type: 'setMainView', view: 'dashboard' });
    expect(state.mainView).toBe('dashboard');
  });

  it('switches back to chat', () => {
    let state = act(s(), { type: 'setMainView', view: 'dashboard' });
    state = act(state, { type: 'setMainView', view: 'chat' });
    expect(state.mainView).toBe('chat');
  });
});

describe('analytics state — loading', () => {
  it('analyticsLoading action sets loading true and clears error', () => {
    let state = act(s(), { type: 'analyticsErrorReceived', message: 'some error' });
    state = act(state, { type: 'analyticsLoading' });
    expect(state.analyticsLoading).toBe(true);
    expect(state.analyticsError).toBeUndefined();
  });
});

describe('analytics state — summary received', () => {
  it('stores summary and clears loading', () => {
    const summary = makeSummary();
    let state = act(s(), { type: 'analyticsLoading' });
    state = act(state, { type: 'analyticsSummaryReceived', summary });
    expect(state.analyticsSummary).toEqual(summary);
    expect(state.analyticsLoading).toBe(false);
  });
});

describe('analytics state — runs received', () => {
  it('stores runs and clears loading', () => {
    const runs = [makeRun(), makeRun({ id: '2', taskId: 'task2' })];
    let state = act(s(), { type: 'analyticsLoading' });
    state = act(state, { type: 'analyticsRunsReceived', runs });
    expect(state.analyticsRuns).toHaveLength(2);
    expect(state.analyticsLoading).toBe(false);
  });
});

describe('analytics state — error received', () => {
  it('stores error message and clears loading', () => {
    let state = act(s(), { type: 'analyticsLoading' });
    state = act(state, { type: 'analyticsErrorReceived', message: 'Network error' });
    expect(state.analyticsError).toBe('Network error');
    expect(state.analyticsLoading).toBe(false);
  });

  it('clearAnalyticsError clears error', () => {
    let state = act(s(), { type: 'analyticsErrorReceived', message: 'oops' });
    state = act(state, { type: 'clearAnalyticsError' });
    expect(state.analyticsError).toBeUndefined();
  });
});

describe('analytics ext messages', () => {
  it('analyticsSummary ext msg stores summary', () => {
    const summary = makeSummary();
    const state = act(s(), { type: 'extMsg', msg: { type: 'analyticsSummary', summary } });
    expect(state.analyticsSummary).toEqual(summary);
    expect(state.analyticsLoading).toBe(false);
  });

  it('analyticsRuns ext msg stores runs', () => {
    const runs = [makeRun()];
    const state = act(s(), { type: 'extMsg', msg: { type: 'analyticsRuns', runs } });
    expect(state.analyticsRuns).toHaveLength(1);
  });

  it('analyticsExported ext msg is a no-op (notification shown by extension)', () => {
    const state = act(s(), { type: 'extMsg', msg: { type: 'analyticsExported', path: '/tmp/out.json' } });
    // No state change expected — the path is shown via VS Code notification
    expect(state.mainView).toBe('chat');
  });

  it('analyticsError ext msg stores error', () => {
    const state = act(s(), { type: 'extMsg', msg: { type: 'analyticsError', message: 'Failed to load' } });
    expect(state.analyticsError).toBe('Failed to load');
    expect(state.analyticsLoading).toBe(false);
  });
});

describe('analytics initial state', () => {
  it('all analytics fields have correct defaults', () => {
    const state = s();
    expect(state.mainView).toBe('chat');
    expect(state.analyticsSummary).toBeUndefined();
    expect(state.analyticsRuns).toBeUndefined();
    expect(state.analyticsLoading).toBe(false);
    expect(state.analyticsError).toBeUndefined();
  });
});
