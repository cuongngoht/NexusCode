import * as vscode from 'vscode';

const BUDGET_KEY = 'nexus.knowledgeFacts.enrichmentBudget';

interface EnrichmentBudgetState {
  dateKey: string; // 'YYYY-MM-DD', local calendar day
  count: number;
}

/**
 * Persisted in workspaceState (not a new file) — this is ephemeral counter state, not project
 * knowledge that should live under .nexus/ alongside facts that may be git-tracked.
 * Resets on calendar day, not a rolling 24h window — simpler at this call volume (5/day default)
 * and matches no existing rolling-window precedent in this codebase.
 */
export class EnrichmentBudgetTracker {
  constructor(private readonly workspaceState: vscode.Memento) {}

  private todayKey(): string {
    return new Date().toISOString().slice(0, 10);
  }

  canRunNow(maxPerDay: number): boolean {
    const state = this.workspaceState.get<EnrichmentBudgetState>(BUDGET_KEY);
    if (!state || state.dateKey !== this.todayKey()) return true;
    return state.count < maxPerDay;
  }

  async recordRun(): Promise<void> {
    const key = this.todayKey();
    const state = this.workspaceState.get<EnrichmentBudgetState>(BUDGET_KEY);
    const count = state?.dateKey === key ? state.count + 1 : 1;
    await this.workspaceState.update(BUDGET_KEY, { dateKey: key, count });
  }
}
