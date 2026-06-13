export class RagPromptInjector {
  inject(enhancedPrompt: string, ragContext: string): string {
    if (!ragContext) return enhancedPrompt;
    return `${ragContext}\n\n<current_user_request>\n${enhancedPrompt}\n</current_user_request>`;
  }
}
