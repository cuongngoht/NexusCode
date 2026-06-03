export type SummaryConfidence = 'low' | 'medium' | 'high';
export type RiskSeverity = 'low' | 'medium' | 'high';
export type EvidenceStatus = 'unknown' | 'likely' | 'confirmed';
export type StepPriority = 'low' | 'medium' | 'high';

export type ProjectMapAiSummary = {
  summary: string;
  risks: Array<{
    title: string;
    severity: RiskSeverity;
    evidence: string[];
    recommendation: string;
  }>;
  missingPieces: Array<{
    title: string;
    evidence: string[];
    status: EvidenceStatus;
  }>;
  nextSteps: Array<{
    title: string;
    priority: StepPriority;
    reason: string;
  }>;
};
