import * as fs from 'fs';
import * as path from 'path';

function writeIfNotExists(filePath: string, content: string): void {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

const STEP_00 = (problem: string) => `# Step 00 — Problem Clarification

## Agent

@research

## Goal

Clarify the feature or problem before researching solutions.

## Problem

${problem}

## Questions

- What exactly is the user trying to solve?
- What is the expected outcome?
- What is in scope?
- What is out of scope?
- What assumptions are being made?
- What would count as a good answer?

## Output Required

### Clarified Problem

### Desired Outcome

### Scope

### Non-goals

### Assumptions

### Next Step
`;

const STEP_01 = `# Step 01 — Local Project Context

## Agent

@research

## Goal

Inspect local Nexus project context before suggesting options.

## Search Targets

\`\`\`txt
README.md
CLAUDE.md
GEMINI.md
agents.md
media/agents
media/subagents
media/prompts
media/skills
src/context
src/application
src/webview
src/webview-ui
src/extension.ts
package.json
\`\`\`

## Questions

* What existing modules relate to this feature?
* What existing behavior must be preserved?
* Are there existing prompts, agents, subagents, or skills that can be reused?
* Are there tests that should be extended?
* What architecture patterns already exist?

## Output Required

### Relevant Files

### Existing Capabilities

### Reusable Modules

### Current Limitations

### Risks

### Next Step
`;

const STEP_02 = `# Step 02 — Options

## Agent

@research

## Goal

Compare possible implementation approaches.

## Requirements

Compare at least 2 approaches when possible.

For each option, include:

- Description
- Files likely affected
- Pros
- Cons
- Complexity
- Risk
- Best use case

## Output Required

### Option A

### Option B

### Option C

### Comparison Table

### Preferred Direction

### Next Step
`;

const STEP_03 = `# Step 03 — Tradeoffs

## Agent

@research

## Goal

Analyze tradeoffs before making a recommendation.

## Areas to Analyze

- UX simplicity
- Implementation complexity
- Token cost
- Context size
- Maintainability
- Compatibility
- Security
- Path safety
- Testability
- Risk of breaking existing behavior

## Output Required

### Key Tradeoffs

### Risk Ranking

### What to Avoid

### Required Constraints

### Next Step
`;

const STEP_04 = `# Step 04 — Recommendation

## Agent

@research

## Goal

Choose the best path forward.

## Output Required

### Final Recommendation

### Why This Is Best

### What Should Be Implemented First

### What Should Be Deferred

### Required Files to Change

### Tests Needed

### Acceptance Criteria

### Next Agent
`;

const STEP_05 = `# Step 05 — Export Implementation Plan

## Agent

@software-architect

## Goal

Convert completed research into a coding plan.

## Output Required

Create a proposed planning folder:

\`\`\`txt
.nexus/plans/<research-id>/
  index.md
  00-context.md
  01-architecture.md
  02-implementation.md
  03-tests.md
  04-code-review.md
\`\`\`

## Required Sections

### Implementation Goal

### Architecture Summary

### Files to Change

### Step-by-step Plan

### Tests

### Acceptance Criteria

### Risks

### Rollback Plan

## Rule

Do not implement code in this step. Only produce the implementation plan.
`;

const SOURCES_MD = `# Research Sources

## Local Sources

Add project files inspected here.

## External Sources

Add official documentation or web sources here if used.

## Notes

Keep source summaries short and useful.
`;

const NOTES_MD = `# Research Notes

Use this file for scratch notes, unresolved questions, and follow-up ideas.
`;

export function createResearchTopic(
  workspaceRoot: string,
  researchId: string,
  problem: string,
): void {
  const topicDir = path.join(workspaceRoot, '.nexus', 'research', researchId);
  fs.mkdirSync(topicDir, { recursive: true });

  writeIfNotExists(path.join(topicDir, '00-problem.md'), STEP_00(problem));
  writeIfNotExists(path.join(topicDir, '01-local-context.md'), STEP_01);
  writeIfNotExists(path.join(topicDir, '02-options.md'), STEP_02);
  writeIfNotExists(path.join(topicDir, '03-tradeoffs.md'), STEP_03);
  writeIfNotExists(path.join(topicDir, '04-recommendation.md'), STEP_04);
  writeIfNotExists(path.join(topicDir, '05-export-plan.md'), STEP_05);
  writeIfNotExists(path.join(topicDir, 'sources.md'), SOURCES_MD);
  writeIfNotExists(path.join(topicDir, 'notes.md'), NOTES_MD);
}
