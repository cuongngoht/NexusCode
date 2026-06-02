export type OutputFormat = 'markdown' | 'text' | 'json';

export interface AgentOutput {
  content: string;
  format: OutputFormat;
}
