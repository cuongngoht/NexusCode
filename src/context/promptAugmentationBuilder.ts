export interface PromptAugmentationInput {
  agentMarkdownBundle?: string;
  skillMarkdownBundle?: string;
  userPrompt: string;
  existingEnhancedPrompt: string;
}

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

  return parts.join('\n');
}
