export type SubagentRole =
  | 'search'
  | 'planner'
  | 'coder'
  | 'tester'
  | 'reviewer'
  | 'security'
  | 'debugger'
  | 'docs'
  | 'product'
  | 'research'
  | 'architect';

export type { SubagentFinding, SubagentFindingSeverity, ParsedSubagentOutput } from './SubagentOutputSchema';
import type { SubagentFinding, ParsedSubagentOutput } from './SubagentOutputSchema';

export interface SubagentResult {
  readonly role: SubagentRole;
  readonly agentId: string;
  readonly compactOutput: string;
  readonly durationMs: number;
  readonly error?: string;
  readonly parsedOutput?: ParsedSubagentOutput;
  readonly confidence?: number;
  readonly files?: string[];
  readonly findings?: SubagentFinding[];
  readonly rawOutput?: string;
}

export interface SubagentRunTrace {
  runId: string;
  conversationId?: string;
  taskId?: string;
  mode: string;
  startedAt: number;
  completedAt?: number;
  results: SubagentResult[];
}

export class SubagentResultStore {
  private readonly runs = new Map<string, SubagentRunTrace>();

  saveRun(runId: string, trace: SubagentRunTrace): void {
    this.runs.set(runId, trace);
    if (this.runs.size > 50) {
      const oldest = [...this.runs.keys()][0];
      this.runs.delete(oldest);
    }
  }

  appendResult(runId: string, result: SubagentResult): void {
    const trace = this.runs.get(runId);
    if (trace) {
      trace.results.push(result);
    }
  }

  getRun(runId: string): SubagentRunTrace | undefined {
    return this.runs.get(runId);
  }

  clearRun(runId: string): void {
    this.runs.delete(runId);
  }

  listRecent(limit = 10): SubagentRunTrace[] {
    return [...this.runs.values()].slice(-limit);
  }
}
