import { appendRunInstructions } from '../core/mcp/McpIntentProtocol';

export {
  appendRunInstructions,
  NEXUS_PROGRESS_INSTRUCTION,
} from '../core/mcp/McpIntentProtocol';
export type { RunInstructionStyle } from '../core/mcp/McpIntentProtocol';

export interface BundlePrefixInput {
  agentMarkdownBundle?: string;
  skillMarkdownBundle?: string;
  existingEnhancedPrompt: string;
}

export interface PromptAugmentationInput extends BundlePrefixInput {
  /** Retained for call-site readability; the composed prompt already contains it. */
  userPrompt?: string;
  /** When true, appends MCP tool-call instructions so the agent knows to emit NEXUS_TOOL_INTENT. */
  mcpEnabled?: boolean;
}

/**
 * Prefixes @agent and #skill instruction bundles onto an already-enhanced prompt.
 *
 * Deliberately does NOT append the progress or MCP instructions. Those are run-level
 * and belong at the very end of assembly, after any subagent block — see
 * `appendRunInstructions`. Splitting them apart is what lets callers inject the MCP
 * protocol on every run while only prefixing bundles when mentions are present.
 */
export function buildBundlePrefixedPrompt(input: BundlePrefixInput): string {
  const { agentMarkdownBundle, skillMarkdownBundle, existingEnhancedPrompt } = input;

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

  return parts.join('\n');
}

/**
 * Bundles + run instructions in one call, for paths that compose a whole prompt in one
 * shot (the agent-review supplement step). Multi-stage paths call the two halves
 * separately so the subagent block can land between them.
 */
export function buildAugmentedPrompt(input: PromptAugmentationInput): string {
  return appendRunInstructions(buildBundlePrefixedPrompt(input), { mcpEnabled: input.mcpEnabled });
}
