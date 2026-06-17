import type { AgentSession } from './AgentSession';
import type { AgentPlan, AgentPlanResult } from './AgentPlan';

export interface AgentPlannerInput {
  session: AgentSession;
  prompt: string;
  workspaceRoot: string;
  providerId: string;
  model?: string;
  conversationContext?: string;
  attachments?: unknown[];
}

export type RunAgentForTextFn = (
  prompt: string,
  workspaceRoot: string,
  providerId: string,
  model?: string,
) => Promise<string>;

const PLANNER_PROMPT_HEADER = `You are Nexus Agent Mode Planner.

Your job:
- Understand the repository.
- Create a safe implementation plan.
- Do not edit files.
- Do not run terminal commands.
- Identify risky actions.
- Identify files that may need reading or editing.
- Identify tests to run.
- Identify rollback strategy.
- Identify docs and security impact.

Return exactly two sections separated by exactly these headers (no extra text before or between them):

SECTION 1: MARKDOWN_PLAN
Include:
- Summary
- Repository understanding
- Files to read
- Files to edit
- Files to create
- Files to delete
- Commands to run
- Risks
- Assumptions
- Test strategy
- Rollback strategy
- Docs impact
- Security impact
- Estimated complexity

SECTION 2: AGENT_PLAN_JSON
Return valid JSON matching this schema:
{
  "summary": "string",
  "filesToRead": ["string"],
  "filesToEdit": ["string"],
  "filesToCreate": ["string"],
  "filesToDelete": ["string"],
  "commandsToRun": ["string"],
  "risks": ["string"],
  "assumptions": ["string"],
  "testStrategy": ["string"],
  "rollbackStrategy": ["string"],
  "docsImpact": ["string"],
  "securityImpact": ["string"],
  "estimatedComplexity": "low | medium | high"
}

Rules:
- Never include files to delete unless the user explicitly requested deletion or deletion is essential.
- Never include publish, git push, rm -rf, or destructive commands as normal commands.
- If terminal commands are needed, list them for approval.
- Keep the plan minimal and scoped to the user request.
- Prefer existing project conventions.`;

const FALLBACK_PLAN: AgentPlan = {
  summary: 'Plan could not be parsed from planner output.',
  filesToRead: [],
  filesToEdit: [],
  filesToCreate: [],
  filesToDelete: [],
  commandsToRun: [],
  risks: ['Planner returned non-JSON plan; fallback parser used.'],
  assumptions: [],
  testStrategy: [],
  rollbackStrategy: [],
  docsImpact: [],
  securityImpact: [],
  estimatedComplexity: 'medium',
};

export class AgentPlanner {
  constructor(private readonly runAgent: RunAgentForTextFn) {}

  async plan(input: AgentPlannerInput): Promise<AgentPlanResult> {
    const fullPrompt = buildPlannerPrompt(input);

    let rawOutput = '';
    try {
      rawOutput = await this.runAgent(
        fullPrompt,
        input.workspaceRoot,
        input.providerId,
        input.model,
      );
    } catch (err) {
      const fallback = { ...FALLBACK_PLAN, risks: [`Planner agent failed: ${String(err)}`] };
      return {
        plan: fallback,
        planText: `Planning failed: ${String(err)}`,
      };
    }

    return parsePlannerOutput(rawOutput);
  }
}

function buildPlannerPrompt(input: AgentPlannerInput): string {
  const parts: string[] = [PLANNER_PROMPT_HEADER];

  if (input.conversationContext) {
    parts.push('\n# Previous Conversation Context\n' + input.conversationContext);
  }

  parts.push('\n# User Task\n' + input.prompt);

  return parts.join('\n');
}

function parsePlannerOutput(raw: string): AgentPlanResult {
  // Split on section headers
  const mdMatch = raw.match(/SECTION 1:\s*MARKDOWN_PLAN\s*\n([\s\S]*?)(?=SECTION 2:\s*AGENT_PLAN_JSON|$)/i);
  const jsonMatch = raw.match(/SECTION 2:\s*AGENT_PLAN_JSON\s*\n([\s\S]*?)$/i);

  const planText = mdMatch ? mdMatch[1].trim() : raw.trim();

  // Try JSON section first
  if (jsonMatch) {
    const jsonText = jsonMatch[1].trim();
    const plan = tryParseJson(jsonText);
    if (plan) return { plan, planText };
  }

  // Try to extract JSON from fenced code blocks
  const fencedMatch = raw.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  if (fencedMatch) {
    const plan = tryParseJson(fencedMatch[1].trim());
    if (plan) return { plan, planText };
  }

  // Try bare JSON object
  const bareJsonMatch = raw.match(/\{[\s\S]*"summary"[\s\S]*\}/);
  if (bareJsonMatch) {
    const plan = tryParseJson(bareJsonMatch[0]);
    if (plan) return { plan, planText };
  }

  // Fallback: extract from markdown
  return { plan: extractPlanFromMarkdown(planText), planText };
}

function tryParseJson(text: string): AgentPlan | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null && typeof parsed.summary === 'string') {
      return normalizePlan(parsed as Partial<AgentPlan>);
    }
    return null;
  } catch {
    return null;
  }
}

function normalizePlan(partial: Partial<AgentPlan>): AgentPlan {
  const arrField = (v: unknown): string[] =>
    Array.isArray(v) ? (v as unknown[]).filter(x => typeof x === 'string') as string[] : [];
  return {
    summary: typeof partial.summary === 'string' ? partial.summary : FALLBACK_PLAN.summary,
    filesToRead: arrField(partial.filesToRead),
    filesToEdit: arrField(partial.filesToEdit),
    filesToCreate: arrField(partial.filesToCreate),
    filesToDelete: arrField(partial.filesToDelete),
    commandsToRun: arrField(partial.commandsToRun),
    risks: arrField(partial.risks),
    assumptions: arrField(partial.assumptions),
    testStrategy: arrField(partial.testStrategy),
    rollbackStrategy: arrField(partial.rollbackStrategy),
    docsImpact: arrField(partial.docsImpact),
    securityImpact: arrField(partial.securityImpact),
    estimatedComplexity:
      partial.estimatedComplexity === 'low' || partial.estimatedComplexity === 'high'
        ? partial.estimatedComplexity
        : 'medium',
  };
}

function extractPlanFromMarkdown(markdown: string): AgentPlan {
  const lines = markdown.split('\n');
  const firstPara = lines.find(l => l.trim() && !l.startsWith('#'))?.trim() ?? '';

  return {
    ...FALLBACK_PLAN,
    summary: firstPara || FALLBACK_PLAN.summary,
  };
}
