import { describe, it, expect } from 'vitest';
import { buildResearchContextBlock } from '../researchPromptBuilder';
import type { ResearchLoadResult } from '../researchFolderLoader';
import type { WorkflowStep } from '../researchIndexParser';

function makeResult(overrides: Partial<ResearchLoadResult> = {}): ResearchLoadResult {
  const defaultSteps: WorkflowStep[] = [
    { order: 0, stepFile: '00-problem.md', agent: 'research', purpose: 'Clarify' },
  ];
  return {
    orchestratorContent: '# Nexus Research Orchestrator\nSome orchestrator content.',
    workflowSteps: defaultSteps,
    activeState: {
      researchId: 'folder-agent-portal',
      problem: 'Design a folder agent portal',
      currentStep: '00-problem.md',
      completedSteps: [],
      createdAt: '2026-06-11T00:00:00.000Z',
      updatedAt: '2026-06-11T00:00:00.000Z',
    },
    currentStepContent: '# Step 00 — Problem Clarification\n\n## Agent\n\n@research',
    currentStep: '00-problem.md',
    assignedAgent: 'research',
    cleanedPrompt: 'Design a folder agent portal',
    ...overrides,
  };
}

describe('buildResearchContextBlock', () => {
  it('includes orchestrator content', () => {
    const block = buildResearchContextBlock(makeResult());
    expect(block).toContain('# Research Orchestrator');
    expect(block).toContain('# Nexus Research Orchestrator');
  });

  it('includes active research state', () => {
    const block = buildResearchContextBlock(makeResult());
    expect(block).toContain('Research ID: folder-agent-portal');
    expect(block).toContain('Problem: Design a folder agent portal');
    expect(block).toContain('Current Step: 00-problem.md');
    expect(block).toContain('Completed Steps: none');
  });

  it('shows completed steps when present', () => {
    const result = makeResult();
    result.activeState.completedSteps = ['00-problem.md'];
    result.activeState.currentStep = '01-local-context.md';
    const block = buildResearchContextBlock(result);
    expect(block).toContain('Completed Steps: 00-problem.md');
  });

  it('includes current step content', () => {
    const block = buildResearchContextBlock(makeResult());
    expect(block).toContain('# Current Research Step');
    expect(block).toContain('Step 00 — Problem Clarification');
  });

  it('includes assigned agent', () => {
    const block = buildResearchContextBlock(makeResult());
    expect(block).toContain('# Assigned Agent');
    expect(block).toContain('@research');
  });

  it('includes source path for current step', () => {
    const block = buildResearchContextBlock(makeResult());
    expect(block).toContain('.nexus/research/folder-agent-portal/00-problem.md');
  });
});
