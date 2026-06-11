import type { SerializedChatMessage } from '../core/chat/ChatHistory';

/**
 * Builds the prompt sent to the AI to generate a compact conversation summary.
 * The resulting summary is stored and injected into future prompts so the agent
 * retains context across long conversations without repeating the full history.
 */
export function buildCompactPrompt(messages: SerializedChatMessage[]): string {
  const formatted = messages
    .map(m => {
      if (m.role === 'user') {
        return `**User:** ${m.prompt}`;
      }
      const content = m.content?.slice(0, 3_000) ?? '';
      return `**Assistant:** ${content}`;
    })
    .join('\n\n');

  return `You are a conversation summarizer. Your task is to create a compact, structured summary of the following conversation that will be injected at the beginning of future prompts to preserve context.

## Conversation to summarize:

${formatted}

## Instructions:

Create a concise summary in the following structured format. Be specific and include concrete details (file names, decisions made, errors fixed, etc.). Omit sections that are not relevant.

\`\`\`markdown
## Summary
[1–3 sentence overview of what was discussed and accomplished]

## Key Decisions
- [Decision 1 and rationale]
- [Decision 2 and rationale]

## Technical Context
- [Technology/framework/pattern in use]
- [Files or components being worked on]
- [Constraints or requirements established]

## Completed Work
- [Item 1 that was finished]
- [Item 2 that was finished]

## Open Questions / Next Steps
- [Unresolved issue or next task]
\`\`\`

Output ONLY the markdown block content (without the triple backticks). Be concise — aim for under 600 words.`;
}
