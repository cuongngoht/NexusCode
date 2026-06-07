import type { TaskMode } from '../core/types';

export class McpToolIntentPrompt {
  build(mode: TaskMode): string {
    return [
      '## Nexus Tool Access',
      '',
      'Nexus can fetch fresh documentation when needed.',
      'You cannot call tools directly.',
      'Do not invent tool results.',
      '',
      'When external docs are required, output exactly one tool intent block:',
      '',
      '<NEXUS_TOOL_INTENT>',
      '{',
      '  "group": "docs",',
      '  "query": "short documentation query",',
      '  "reason": "why this context is needed"',
      '}',
      '</NEXUS_TOOL_INTENT>',
      '',
      'Available groups:',
      '- docs: fetch relevant documentation',
      '- samples: fetch code samples',
      '- library-api: fetch library API docs',
      '- microsoft-docs: fetch Microsoft official docs',
      '',
      `Current mode: ${mode}`,
      '',
      'Only request tool context when it will materially improve the answer.',
    ].join('\n');
  }
}
