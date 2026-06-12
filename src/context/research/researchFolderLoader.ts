import * as fs from 'fs';
import * as path from 'path';
import { detectResearchMention } from './researchProblemDetector';
import { uniqueResearchSlug } from './researchSlug';
import { loadActiveResearch, createActiveResearch, type ActiveResearchState } from './activeResearchStore';
import { ensureOrchestratorExists, loadOrchestrator, getResearchDir } from './researchOrchestratorLoader';
import { parseWorkflowTable, resolveAgentForStep, type WorkflowStep } from './researchIndexParser';
import { createResearchTopic } from './researchWorkflowCreator';

const MAX_STEP_CHARS = 4000;

export interface ResearchLoadResult {
  orchestratorContent: string;
  workflowSteps: WorkflowStep[];
  activeState: ActiveResearchState;
  currentStepContent: string;
  currentStep: string;
  assignedAgent: string;
  cleanedPrompt: string;
}

function isSafePath(workspaceRoot: string, filePath: string): boolean {
  const researchRoot = path.resolve(getResearchDir(workspaceRoot));
  const resolved = path.resolve(filePath);
  return resolved.startsWith(researchRoot + path.sep) || resolved === researchRoot;
}

export function loadResearchContext(
  workspaceRoot: string,
  originalPrompt: string,
): ResearchLoadResult | null {
  const detection = detectResearchMention(originalPrompt);
  if (!detection.found) return null;

  ensureOrchestratorExists(workspaceRoot);
  const orchestratorContent = loadOrchestrator(workspaceRoot);
  const workflowSteps = parseWorkflowTable(orchestratorContent);

  let activeState = loadActiveResearch(workspaceRoot);

  if (detection.isNew) {
    const problem = detection.problem;
    const slug = uniqueResearchSlug(workspaceRoot, problem);
    createResearchTopic(workspaceRoot, slug, problem);
    activeState = createActiveResearch(workspaceRoot, slug, problem);
  } else if (!activeState) {
    return null;
  }

  const currentStep = activeState.currentStep;
  const stepPath = path.join(
    workspaceRoot,
    '.nexus',
    'research',
    activeState.researchId,
    currentStep,
  );

  if (!isSafePath(workspaceRoot, stepPath)) {
    return null;
  }

  let currentStepContent = '';
  try {
    currentStepContent = fs.readFileSync(stepPath, 'utf8').slice(0, MAX_STEP_CHARS);
  } catch {
    currentStepContent = `<!-- step file ${currentStep} not found -->`;
  }

  const assignedAgent = resolveAgentForStep(currentStepContent, workflowSteps, currentStep);

  return {
    orchestratorContent,
    workflowSteps,
    activeState,
    currentStepContent,
    currentStep,
    assignedAgent,
    cleanedPrompt: detection.cleanedPrompt,
  };
}
