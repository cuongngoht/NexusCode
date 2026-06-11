import type { SerializedChatMessage } from '../core/chat/ChatHistory';

/**
 * Deterministic fallback for when AI compact generation fails or no provider is
 * available. Extracts key content from messages without calling an LLM.
 */
export function buildFallbackCompactSummary(messages: SerializedChatMessage[]): string {
  const userPrompts: string[] = [];
  const assistantSnippets: string[] = [];

  for (const m of messages) {
    if (m.role === 'user') {
      userPrompts.push(`- ${m.prompt.slice(0, 200).replace(/\n/g, ' ')}`);
    } else {
      const snippet = m.content?.split('\n').find(l => l.trim().length > 20);
      if (snippet) assistantSnippets.push(`- ${snippet.trim().slice(0, 200)}`);
    }
  }

  const parts: string[] = ['## Summary', `This conversation has ${messages.length} messages.`, ''];

  if (userPrompts.length > 0) {
    parts.push('## User Requests');
    parts.push(...userPrompts.slice(0, 8));
    parts.push('');
  }

  if (assistantSnippets.length > 0) {
    parts.push('## Assistant Responses (excerpts)');
    parts.push(...assistantSnippets.slice(0, 5));
    parts.push('');
  }

  return parts.join('\n');
}
