export interface PromptAugmentationInput {
  agentMarkdownBundle?: string;
  skillMarkdownBundle?: string;
  userPrompt: string;
  existingEnhancedPrompt: string;
  /** When true, appends MCP tool-call instructions so the agent knows to emit NEXUS_TOOL_INTENT. */
  mcpEnabled?: boolean;
}

const NEXUS_PROGRESS_INSTRUCTION = `You are running inside Nexus AI Code. Describe your progress in clear phases: Planning, Reading context, Editing files, Running tests, Reviewing changes, Final summary. When modifying a file, mention the exact path. When running a command, mention the command. Keep progress updates concise.`;

// Injected only when MCP is enabled. Teaches the agent the NEXUS_TOOL_INTENT protocol so that
// McpIntentParser can detect it and trigger a follow-up MCP round automatically — no per-agent
// instruction needed.
const MCP_TOOL_INSTRUCTION = `## External Documentation (MCP)

If you need to look up external documentation, library API references, or code samples to answer accurately, emit **exactly one** tool-intent block anywhere in your response, before your final answer:

\`\`\`
<NEXUS_TOOL_INTENT>
{"group": "<group>", "query": "<search terms>", "reason": "<why you need this>"}
</NEXUS_TOOL_INTENT>
\`\`\`

Valid groups: \`docs\`, \`samples\`, \`library-api\`, \`microsoft-docs\`

Nexus will call the appropriate documentation server, inject the results, and run you again with that context. Only emit the block when you genuinely need external references — omit it if you can answer from what you already know.`;

export function buildAugmentedPrompt(input: PromptAugmentationInput): string {
  const { agentMarkdownBundle, skillMarkdownBundle, existingEnhancedPrompt, mcpEnabled } = input;

  const parts: string[] = [];

  if (agentMarkdownBundle) {
    parts.push(agentMarkdownBundle);
    parts.push('');
    parts.push('---');
    parts.push('');
  }

  if (skillMarkdownBundle) {
    parts.push(skillMarkdownBundle);
    parts.push('');
    parts.push('---');
    parts.push('');
  }

  parts.push(existingEnhancedPrompt);
  parts.push('');
  parts.push(NEXUS_PROGRESS_INSTRUCTION);

  if (mcpEnabled) {
    parts.push('');
    parts.push(MCP_TOOL_INSTRUCTION);
  }

  return parts.join('\n');
}
