import * as fs from 'fs';
import * as path from 'path';

const MAX_ORCHESTRATOR_CHARS = 8000;

export const ORCHESTRATOR_TEMPLATE = `# Nexus Research Orchestrator

## Purpose

This file is the central orchestrator for Nexus research workflows.

When the user types \`@research\`, Nexus must read this file first.

The orchestrator decides:

- which research topic is active
- which step should run
- which step file should be loaded
- which agent should handle the step
- what output format is expected
- when research should be exported into an implementation plan

## Core Flow

\`\`\`txt
@research <problem>
→ create research topic
→ create step files
→ set active research
→ run current step

@research
→ continue active research
→ load current step
→ run current step

/research done
→ mark current step complete
→ move to next step
\`\`\`

## Default Workflow

| Order | Step File | Agent | Purpose |
| ----- | --------- | ----- | ------- |
| 00 | 00-problem.md | @research | Clarify the feature or problem |
| 01 | 01-local-context.md | @research | Inspect local project context |
| 02 | 02-options.md | @research | Compare possible approaches |
| 03 | 03-tradeoffs.md | @research | Analyze tradeoffs and risks |
| 04 | 04-recommendation.md | @research | Recommend the best approach |
| 05 | 05-export-plan.md | @software-architect | Convert research into an implementation plan |

## Routing Rules

* Always read this file before running research.
* If the user provides a new problem, create a new research topic.
* If the user only types \`@research\`, continue the active topic.
* Active topic is stored in \`.nexus/research/active.json\`.
* Load only this orchestrator file and the current step by default.
* Do not load all topic files by default.
* Use the agent declared for the current step.
* If no agent can be resolved, fallback to \`@research\`.
* Research must inspect local project context before suggesting implementation.
* Do not write production code during research.
* Final research output should produce a planning proposal under \`.nexus/plans/<research-id>/\`.

## Step Completion Rules

* Do not automatically mark a step complete after the CLI responds.
* User controls progress with \`/research done\`.
* \`/research current\` should show active topic and current step.

## Done Criteria

Research is complete when:

* The problem is clarified
* Local context is summarized
* Options are compared
* Tradeoffs are analyzed
* A recommendation is made
* An implementation plan is ready
`;

export function getResearchDir(workspaceRoot: string): string {
  return path.join(workspaceRoot, '.nexus', 'research');
}

export function getIndexPath(workspaceRoot: string): string {
  return path.join(getResearchDir(workspaceRoot), 'index.md');
}

export function ensureOrchestratorExists(workspaceRoot: string): void {
  const indexPath = getIndexPath(workspaceRoot);
  fs.mkdirSync(path.dirname(indexPath), { recursive: true });
  if (!fs.existsSync(indexPath)) {
    fs.writeFileSync(indexPath, ORCHESTRATOR_TEMPLATE, 'utf8');
  }
}

export function loadOrchestrator(workspaceRoot: string): string {
  try {
    const content = fs.readFileSync(getIndexPath(workspaceRoot), 'utf8');
    return content.slice(0, MAX_ORCHESTRATOR_CHARS);
  } catch {
    return ORCHESTRATOR_TEMPLATE.slice(0, MAX_ORCHESTRATOR_CHARS);
  }
}
