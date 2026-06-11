import * as fs from 'fs';
import * as path from 'path';

export interface ActiveResearchState {
  researchId: string;
  problem: string;
  currentStep: string;
  completedSteps: string[];
  createdAt: string;
  updatedAt: string;
}

const DEFAULT_STEPS = [
  '00-problem.md',
  '01-local-context.md',
  '02-options.md',
  '03-tradeoffs.md',
  '04-recommendation.md',
  '05-export-plan.md',
];

function getActivePath(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.nexus', 'research', 'active.json');
}

function getTopicSteps(workspaceRoot: string, researchId: string): string[] {
  const topicDir = path.join(workspaceRoot, '.nexus', 'research', researchId);
  try {
    return (fs.readdirSync(topicDir) as string[])
      .filter((f: string) => /^\d{2}-[a-z]/.test(f) && f.endsWith('.md'))
      .sort();
  } catch {
    return DEFAULT_STEPS;
  }
}

export function loadActiveResearch(workspaceRoot: string): ActiveResearchState | null {
  try {
    const raw = fs.readFileSync(getActivePath(workspaceRoot), 'utf8');
    const parsed = JSON.parse(raw) as ActiveResearchState;
    if (!parsed.researchId || !parsed.currentStep) return null;
    return {
      researchId: parsed.researchId,
      problem: parsed.problem ?? '',
      currentStep: parsed.currentStep,
      completedSteps: Array.isArray(parsed.completedSteps) ? parsed.completedSteps : [],
      createdAt: parsed.createdAt ?? new Date().toISOString(),
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function saveActiveResearch(workspaceRoot: string, state: ActiveResearchState): void {
  const activePath = getActivePath(workspaceRoot);
  fs.mkdirSync(path.dirname(activePath), { recursive: true });
  fs.writeFileSync(activePath, JSON.stringify(state, null, 2), 'utf8');
}

export function createActiveResearch(
  workspaceRoot: string,
  researchId: string,
  problem: string,
): ActiveResearchState {
  const now = new Date().toISOString();
  const state: ActiveResearchState = {
    researchId,
    problem,
    currentStep: '00-problem.md',
    completedSteps: [],
    createdAt: now,
    updatedAt: now,
  };
  saveActiveResearch(workspaceRoot, state);
  return state;
}

export function markCurrentStepDone(workspaceRoot: string): ActiveResearchState | null {
  const state = loadActiveResearch(workspaceRoot);
  if (!state) return null;

  const steps = getTopicSteps(workspaceRoot, state.researchId);
  const completed = new Set(state.completedSteps);
  completed.add(state.currentStep);

  const nextStep = steps.find(s => !completed.has(s)) ?? state.currentStep;
  const updated: ActiveResearchState = {
    ...state,
    completedSteps: Array.from(completed),
    currentStep: nextStep,
    updatedAt: new Date().toISOString(),
  };
  saveActiveResearch(workspaceRoot, updated);
  return updated;
}

export function advanceToNextStep(workspaceRoot: string): ActiveResearchState | null {
  const state = loadActiveResearch(workspaceRoot);
  if (!state) return null;

  const steps = getTopicSteps(workspaceRoot, state.researchId);
  const idx = steps.indexOf(state.currentStep);
  const nextStep = idx >= 0 && idx < steps.length - 1 ? steps[idx + 1] : state.currentStep;

  const updated: ActiveResearchState = {
    ...state,
    currentStep: nextStep,
    updatedAt: new Date().toISOString(),
  };
  saveActiveResearch(workspaceRoot, updated);
  return updated;
}

export function listResearchTopics(workspaceRoot: string): string[] {
  const researchDir = path.join(workspaceRoot, '.nexus', 'research');
  try {
    return fs.readdirSync(researchDir, { withFileTypes: true })
      .filter((d: fs.Dirent) => d.isDirectory())
      .map((d: fs.Dirent) => d.name)
      .sort();
  } catch {
    return [];
  }
}
