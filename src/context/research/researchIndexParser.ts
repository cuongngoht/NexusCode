export interface WorkflowStep {
  order: number;
  stepFile: string;
  agent: string;
  purpose: string;
}

export const DEFAULT_WORKFLOW: WorkflowStep[] = [
  { order: 0, stepFile: '00-problem.md', agent: 'research', purpose: 'Clarify the feature or problem' },
  { order: 1, stepFile: '01-local-context.md', agent: 'research', purpose: 'Inspect local project context' },
  { order: 2, stepFile: '02-options.md', agent: 'research', purpose: 'Compare possible approaches' },
  { order: 3, stepFile: '03-tradeoffs.md', agent: 'research', purpose: 'Analyze tradeoffs and risks' },
  { order: 4, stepFile: '04-recommendation.md', agent: 'research', purpose: 'Recommend the best approach' },
  { order: 5, stepFile: '05-export-plan.md', agent: 'software-architect', purpose: 'Convert research into an implementation plan' },
];

export function parseWorkflowTable(orchestratorContent: string): WorkflowStep[] {
  const rows: WorkflowStep[] = [];
  // Match table rows: | 00 | 00-problem.md | @research | Clarify... |
  const rowRe = /\|\s*(\d+)\s*\|\s*([^\|]+\.md)\s*\|\s*@?([^\|]+?)\s*\|\s*([^\|]+)\s*\|/g;
  let match: RegExpExecArray | null;
  rowRe.lastIndex = 0;
  while ((match = rowRe.exec(orchestratorContent)) !== null) {
    rows.push({
      order: parseInt(match[1], 10),
      stepFile: match[2].trim(),
      agent: match[3].trim().replace(/^@/, ''),
      purpose: match[4].trim(),
    });
  }
  return rows.length >= 3 ? rows : DEFAULT_WORKFLOW;
}

export function resolveAgentForStep(
  stepContent: string,
  workflowSteps: WorkflowStep[],
  currentStep: string,
): string {
  // 1. Check step file's ## Agent heading
  const agentMatch = stepContent.match(/##\s+Agent\s*\n+@?(\S+)/);
  if (agentMatch) return agentMatch[1].replace(/^@/, '');

  // 2. Check workflow table
  const step = workflowSteps.find(s => s.stepFile === currentStep);
  if (step) return step.agent;

  // 3. Fallback
  return 'research';
}
