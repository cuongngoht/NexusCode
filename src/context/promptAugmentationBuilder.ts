export interface PromptAugmentationInput {
  agentMarkdownBundle?: string;
  skillMarkdownBundle?: string;
  userPrompt: string;
  existingEnhancedPrompt: string;
}

const NEXUS_PROGRESS_INSTRUCTION = `You are running inside Nexus Code. Describe your progress in clear phases: Planning, Reading context, Editing files, Running tests, Reviewing changes, Final summary. When modifying a file, mention the exact path. When running a command, mention the command. Keep progress updates concise.`;

export function buildAugmentedPrompt(input: PromptAugmentationInput): string {
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
  parts.push('');
  parts.push(NEXUS_PROGRESS_INSTRUCTION);

  return parts.join('\n');
}
