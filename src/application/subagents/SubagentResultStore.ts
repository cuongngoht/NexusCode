export type SubagentRole =
  | 'search'
  | 'planner'
  | 'tester'
  | 'reviewer'
  | 'security'
  | 'debugger'
  | 'docs'
  | 'product'
  | 'research';

export interface SubagentResult {
  readonly role: SubagentRole;
  readonly agentId: string;
  readonly compactOutput: string;
  readonly durationMs: number;
  readonly error?: string;
}
