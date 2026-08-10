/**
 * The NEXUS_TOOL_INTENT protocol — the single source of truth for how agents are
 * asked to request an MCP tool call, and for the group vocabulary the parser accepts.
 *
 * Nexus is itself the MCP client: it does not hand a `.mcp.json` to the provider CLIs.
 * Instead an agent that needs external documentation emits one tagged JSON block; the
 * extension host detects it, calls the MCP server, and re-runs the agent with the
 * result appended. That contract only works if the instruction below actually reaches
 * the CLI, so it must be reachable from all three injection sites — the prompt builder
 * (Infrastructure), the task handler (Interface) and AgentExecutor (Application).
 * Application may not import Infrastructure, which is why this lives in the domain
 * layer rather than next to the prompt builder.
 */

export const NEXUS_TOOL_INTENT_TAG = 'NEXUS_TOOL_INTENT';

/**
 * The only groups an intent may name. `McpIntentParser` validates against this and
 * the rendered instructions are generated from it, so the vocabulary cannot drift
 * between what we ask for and what we accept.
 */
export const MCP_TOOL_GROUPS = ['docs', 'samples', 'library-api', 'microsoft-docs'] as const;

export type McpToolGroup = (typeof MCP_TOOL_GROUPS)[number];

/** How to phrase the tool-intent request, given the surrounding output contract. */
export type RunInstructionStyle = 'narrative' | 'json-only';

export const NEXUS_PROGRESS_INSTRUCTION = `You are running inside Nexus AI Code. Describe your progress in clear phases: Planning, Reading context, Editing files, Running tests, Reviewing changes, Final summary. When modifying a file, mention the exact path. When running a command, mention the command. Keep progress updates concise.`;

/** Stable substring of the progress instruction, used as the idempotence guard. */
const PROGRESS_MARKER = 'You are running inside Nexus AI Code';

const OPEN_TAG = `<${NEXUS_TOOL_INTENT_TAG}>`;
const CLOSE_TAG = `</${NEXUS_TOOL_INTENT_TAG}>`;

const GROUP_LIST = MCP_TOOL_GROUPS.map(group => `\`${group}\``).join(', ');

const TAG_TEMPLATE = `\`\`\`
${OPEN_TAG}
{"group": "<group>", "query": "<search terms>", "reason": "<why you need this>"}
${CLOSE_TAG}
\`\`\`

Valid groups: ${GROUP_LIST}`;

/**
 * For free-form prose runs. The block may sit alongside the answer, because nothing
 * downstream is parsing the response as a whole.
 */
export const MCP_TOOL_INSTRUCTION_NARRATIVE = `## External Documentation (MCP)

If you need to look up external documentation, library API references, or code samples to answer accurately, emit **exactly one** tool-intent block anywhere in your response, before your final answer:

${TAG_TEMPLATE}

Nexus will call the appropriate documentation server, inject the results, and run you again with that context. Only emit the block when you genuinely need external references — omit it if you can answer from what you already know.`;

/**
 * For runs whose output is machine-parsed (the review report's JSON contract, the
 * agent-mode planner's two-section format). Those contracts forbid any extra text,
 * so the block cannot coexist with the answer — it has to *replace* it for one round.
 */
export const MCP_TOOL_INSTRUCTION_JSON_ONLY = `## External Documentation (MCP)

If — and only if — you need external documentation, library API references, or code samples **before** you can produce the required output, then respond with ONLY the block below and nothing else. No JSON, no prose, no explanation:

${TAG_TEMPLATE}

Nexus will call the appropriate documentation server and run you again with the results attached, and you will then produce the required output exactly as specified above. If you can produce the required output without external references, ignore this section completely and produce it now.`;

/**
 * Appends the run-level instructions to an already-composed prompt.
 *
 * Idempotent by design: it guards on marker substrings rather than relying on being
 * called exactly once. Prompts are assembled from independent fragments across three
 * layers, and several paths legitimately compose one prompt from another, so making
 * double-injection structurally impossible is cheaper than auditing every call site.
 */
export function appendRunInstructions(
  prompt: string,
  opts: { mcpEnabled?: boolean; style?: RunInstructionStyle },
): string {
  const style = opts.style ?? 'narrative';
  const parts: string[] = [prompt];

  // The progress narration is prose, so it is suppressed for machine-parsed output.
  if (style !== 'json-only' && !prompt.includes(PROGRESS_MARKER)) {
    parts.push('');
    parts.push(NEXUS_PROGRESS_INSTRUCTION);
  }

  if (opts.mcpEnabled && !prompt.includes(OPEN_TAG)) {
    parts.push('');
    parts.push(style === 'json-only' ? MCP_TOOL_INSTRUCTION_JSON_ONLY : MCP_TOOL_INSTRUCTION_NARRATIVE);
  }

  return parts.join('\n');
}
