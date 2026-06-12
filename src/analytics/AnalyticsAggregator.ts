import type {
  AnalyticsRunRecord,
  AnalyticsDashboardSummary,
  ProviderSummary,
  ModeSummary,
  ConversationSummary,
  WorkspaceSummary,
  AgentSummary,
  SkillSummary,
  WorkflowSummary,
} from './AnalyticsTypes';

export class AnalyticsAggregator {
  aggregate(records: AnalyticsRunRecord[]): AnalyticsDashboardSummary {
    if (records.length === 0) {
      return this.empty();
    }

    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalTokens = 0;
    let totalEstimatedCostUsd = 0;
    let totalLatencyMs = 0;
    let latencyCount = 0;
    let successfulRuns = 0;
    let failedRuns = 0;
    let stoppedRuns = 0;
    let filesChanged = 0;
    let linesAdded = 0;
    let linesDeleted = 0;
    let testsGenerated = 0;
    let bugsFixed = 0;
    let estimatedTimeSavedMinutes = 0;
    let goodFeedbackCount = 0;
    let badFeedbackCount = 0;

    const providerMap = new Map<string, {
      totalRuns: number;
      successRuns: number;
      failedRuns: number;
      stoppedRuns: number;
      totalTokens: number;
      estimatedCostUsd: number;
      totalLatencyMs: number;
      latencyCount: number;
    }>();

    const modeMap = new Map<string, {
      totalRuns: number;
      totalTokens: number;
      estimatedCostUsd: number;
    }>();

    const convMap = new Map<string, {
      conversationTitle?: string;
      totalRuns: number;
      totalTokens: number;
      estimatedCostUsd: number;
    }>();

    const workspaceMap = new Map<string, {
      workspaceName?: string;
      totalRuns: number;
      totalTokens: number;
      estimatedCostUsd: number;
    }>();

    const agentMap = new Map<string, number>();
    const skillMap = new Map<string, number>();
    const workflowMap = new Map<string, {
      workflowName?: string;
      totalRuns: number;
      estimatedCostUsd: number;
    }>();

    for (const r of records) {
      // Status counts
      if (r.status === 'success') successfulRuns += 1;
      else if (r.status === 'failed') failedRuns += 1;
      else if (r.status === 'stopped') stoppedRuns += 1;

      // Token / cost totals
      totalInputTokens += r.inputTokens;
      totalOutputTokens += r.outputTokens;
      totalTokens += r.totalTokens;
      totalEstimatedCostUsd += r.estimatedTotalCostUsd;

      // Latency
      if (r.latencyMs != null && r.latencyMs > 0) {
        totalLatencyMs += r.latencyMs;
        latencyCount += 1;
      }

      // Productivity
      filesChanged += r.filesChanged;
      linesAdded += r.linesAdded;
      linesDeleted += r.linesDeleted;
      testsGenerated += r.testsGenerated;
      bugsFixed += r.bugsFixed;
      estimatedTimeSavedMinutes += r.estimatedTimeSavedMinutes;

      // Feedback
      if (r.feedback === 'good') goodFeedbackCount += 1;
      else if (r.feedback === 'bad') badFeedbackCount += 1;

      // By provider
      const pKey = r.provider;
      const pEntry = providerMap.get(pKey) ?? {
        totalRuns: 0, successRuns: 0, failedRuns: 0, stoppedRuns: 0,
        totalTokens: 0, estimatedCostUsd: 0, totalLatencyMs: 0, latencyCount: 0,
      };
      pEntry.totalRuns += 1;
      if (r.status === 'success') pEntry.successRuns += 1;
      else if (r.status === 'failed') pEntry.failedRuns += 1;
      else if (r.status === 'stopped') pEntry.stoppedRuns += 1;
      pEntry.totalTokens += r.totalTokens;
      pEntry.estimatedCostUsd += r.estimatedTotalCostUsd;
      if (r.latencyMs != null && r.latencyMs > 0) {
        pEntry.totalLatencyMs += r.latencyMs;
        pEntry.latencyCount += 1;
      }
      providerMap.set(pKey, pEntry);

      // By mode
      const mKey = r.mode;
      const mEntry = modeMap.get(mKey) ?? { totalRuns: 0, totalTokens: 0, estimatedCostUsd: 0 };
      mEntry.totalRuns += 1;
      mEntry.totalTokens += r.totalTokens;
      mEntry.estimatedCostUsd += r.estimatedTotalCostUsd;
      modeMap.set(mKey, mEntry);

      // By conversation
      if (r.conversationId) {
        const cEntry = convMap.get(r.conversationId) ?? {
          conversationTitle: r.conversationTitle, totalRuns: 0, totalTokens: 0, estimatedCostUsd: 0,
        };
        cEntry.totalRuns += 1;
        cEntry.totalTokens += r.totalTokens;
        cEntry.estimatedCostUsd += r.estimatedTotalCostUsd;
        convMap.set(r.conversationId, cEntry);
      }

      // By workspace
      if (r.workspaceId) {
        const wEntry = workspaceMap.get(r.workspaceId) ?? {
          workspaceName: r.workspaceName, totalRuns: 0, totalTokens: 0, estimatedCostUsd: 0,
        };
        wEntry.totalRuns += 1;
        wEntry.totalTokens += r.totalTokens;
        wEntry.estimatedCostUsd += r.estimatedTotalCostUsd;
        workspaceMap.set(r.workspaceId, wEntry);
      }

      // Agents
      if (r.agentId) {
        agentMap.set(r.agentId, (agentMap.get(r.agentId) ?? 0) + 1);
      }

      // Skills
      if (r.skillIds) {
        for (const skillId of r.skillIds) {
          skillMap.set(skillId, (skillMap.get(skillId) ?? 0) + 1);
        }
      }

      // Workflows
      if (r.workflowKey) {
        const wfEntry = workflowMap.get(r.workflowKey) ?? {
          workflowName: r.workflowName, totalRuns: 0, estimatedCostUsd: 0,
        };
        wfEntry.totalRuns += 1;
        wfEntry.estimatedCostUsd += r.estimatedTotalCostUsd;
        workflowMap.set(r.workflowKey, wfEntry);
      }
    }

    const totalRuns = records.length;
    const avgLatencyMs = latencyCount > 0 ? Math.round(totalLatencyMs / latencyCount) : 0;
    const avgCostPerRun = totalRuns > 0 ? totalEstimatedCostUsd / totalRuns : 0;
    const ratedCount = goodFeedbackCount + badFeedbackCount;
    const acceptanceRate = ratedCount > 0 ? goodFeedbackCount / ratedCount : 0;

    const byProvider: ProviderSummary[] = [...providerMap.entries()].map(([provider, e]) => ({
      provider,
      totalRuns: e.totalRuns,
      successRuns: e.successRuns,
      failedRuns: e.failedRuns,
      stoppedRuns: e.stoppedRuns,
      totalTokens: e.totalTokens,
      estimatedCostUsd: e.estimatedCostUsd,
      reliability: e.totalRuns > 0 ? e.successRuns / e.totalRuns : 0,
      avgLatencyMs: e.latencyCount > 0 ? Math.round(e.totalLatencyMs / e.latencyCount) : 0,
      confidenceLow: e.totalRuns < 5,
    }));

    const byMode: ModeSummary[] = [...modeMap.entries()].map(([mode, e]) => ({
      mode,
      totalRuns: e.totalRuns,
      totalTokens: e.totalTokens,
      estimatedCostUsd: e.estimatedCostUsd,
    }));

    const byConversation: ConversationSummary[] = [...convMap.entries()].map(([conversationId, e]) => ({
      conversationId,
      conversationTitle: e.conversationTitle,
      totalRuns: e.totalRuns,
      totalTokens: e.totalTokens,
      estimatedCostUsd: e.estimatedCostUsd,
    }));

    const byWorkspace: WorkspaceSummary[] = [...workspaceMap.entries()].map(([workspaceId, e]) => ({
      workspaceId,
      workspaceName: e.workspaceName,
      totalRuns: e.totalRuns,
      totalTokens: e.totalTokens,
      estimatedCostUsd: e.estimatedCostUsd,
    }));

    const mostUsedAgents: AgentSummary[] = [...agentMap.entries()]
      .map(([agentId, totalRuns]) => ({ agentId, totalRuns }))
      .sort((a, b) => b.totalRuns - a.totalRuns)
      .slice(0, 10);

    const mostUsedSkills: SkillSummary[] = [...skillMap.entries()]
      .map(([skillId, totalRuns]) => ({ skillId, totalRuns }))
      .sort((a, b) => b.totalRuns - a.totalRuns)
      .slice(0, 10);

    const mostExpensiveWorkflows: WorkflowSummary[] = [...workflowMap.entries()]
      .map(([workflowKey, e]) => ({
        workflowKey,
        workflowName: e.workflowName,
        totalRuns: e.totalRuns,
        estimatedCostUsd: e.estimatedCostUsd,
      }))
      .sort((a, b) => b.estimatedCostUsd - a.estimatedCostUsd)
      .slice(0, 10);

    return {
      totalRuns,
      successfulRuns,
      failedRuns,
      stoppedRuns,
      totalInputTokens,
      totalOutputTokens,
      totalTokens,
      totalEstimatedCostUsd,
      avgLatencyMs,
      avgCostPerRun,
      tasksCompleted: successfulRuns,
      filesChanged,
      linesAdded,
      linesDeleted,
      testsGenerated,
      bugsFixed,
      estimatedTimeSavedMinutes,
      acceptanceRate,
      goodFeedbackCount,
      badFeedbackCount,
      byProvider,
      byMode,
      byConversation,
      byWorkspace,
      mostUsedAgents,
      mostUsedSkills,
      mostExpensiveWorkflows,
    };
  }

  private empty(): AnalyticsDashboardSummary {
    return {
      totalRuns: 0, successfulRuns: 0, failedRuns: 0, stoppedRuns: 0,
      totalInputTokens: 0, totalOutputTokens: 0, totalTokens: 0,
      totalEstimatedCostUsd: 0, avgLatencyMs: 0, avgCostPerRun: 0,
      tasksCompleted: 0, filesChanged: 0, linesAdded: 0, linesDeleted: 0,
      testsGenerated: 0, bugsFixed: 0, estimatedTimeSavedMinutes: 0,
      acceptanceRate: 0, goodFeedbackCount: 0, badFeedbackCount: 0,
      byProvider: [], byMode: [], byConversation: [], byWorkspace: [],
      mostUsedAgents: [], mostUsedSkills: [], mostExpensiveWorkflows: [],
    };
  }
}
