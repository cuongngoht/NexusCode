export type SubagentFindingSeverity = 'high' | 'medium' | 'low' | 'info';

export interface SubagentFinding {
  severity: SubagentFindingSeverity;
  title: string;
  evidence?: string[];
  files?: string[];
  recommendation?: string;
}

export interface ParsedSubagentOutput {
  role: string;
  confidence: number;
  findings: SubagentFinding[];
  files: string[];
  nextActions: string[];
  risks?: string[];
  rawMarkdown?: string;
}
