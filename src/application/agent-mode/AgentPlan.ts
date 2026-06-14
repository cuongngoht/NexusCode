export interface AgentPlan {
  summary: string;
  filesToRead: string[];
  filesToEdit: string[];
  filesToCreate: string[];
  filesToDelete: string[];
  commandsToRun: string[];
  risks: string[];
  assumptions: string[];
  testStrategy: string[];
  rollbackStrategy: string[];
  docsImpact: string[];
  securityImpact: string[];
  estimatedComplexity: 'low' | 'medium' | 'high';
}

export interface AgentPlanResult {
  plan: AgentPlan;
  planText: string;
}
