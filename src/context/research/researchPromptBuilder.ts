import type { ResearchLoadResult } from './researchFolderLoader';

export function buildResearchContextBlock(result: ResearchLoadResult): string {
  const { orchestratorContent, activeState, currentStepContent } = result;
  const completedList =
    activeState.completedSteps.length > 0
      ? activeState.completedSteps.join(', ')
      : 'none';

  return [
    '# Research Orchestrator',
    `Source: .nexus/research/index.md`,
    '',
    orchestratorContent,
    '',
    '---',
    '',
    '# Active Research State',
    `Research ID: ${activeState.researchId}`,
    `Problem: ${activeState.problem}`,
    `Current Step: ${activeState.currentStep}`,
    `Completed Steps: ${completedList}`,
    '',
    '---',
    '',
    '# Current Research Step',
    `Source: .nexus/research/${activeState.researchId}/${activeState.currentStep}`,
    '',
    currentStepContent,
    '',
    '---',
    '',
    '# Assigned Agent',
    `@${result.assignedAgent}`,
  ].join('\n');
}
