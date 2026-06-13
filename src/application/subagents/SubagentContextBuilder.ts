import type { TaskMode } from '../../core/types';
import type { SubagentRole, SubagentResult } from './SubagentResultStore';
import type { SubagentIntent } from './SubagentIntentClassifier';

export interface SubagentContextSnippet {
  file: string;
  score: number;
  text: string;
}

export interface SubagentInputPack {
  originalPrompt: string;
  mode: TaskMode;
  projectOverview?: string;
  conversationContext?: string;
  debugContext?: string;
  sourceContext?: string;
  bm25Results?: SubagentContextSnippet[];
  previousResults?: SubagentResult[];
}

export function buildSubagentSearchQuery(input: {
  role: SubagentRole;
  prompt: string;
  intent?: SubagentIntent;
  previousResults?: SubagentResult[];
}): string {
  const { role, prompt } = input;
  switch (role) {
    case 'debugger':
      return `error exception stack trace ${prompt}`;
    case 'tester':
      return `test spec coverage ${prompt}`;
    case 'reviewer':
      return `review risk code quality ${prompt}`;
    case 'security':
      return `auth token secret path command network ${prompt}`;
    case 'docs':
      return `readme documentation api guide ${prompt}`;
    case 'product':
      return `requirement acceptance criteria ux ${prompt}`;
    case 'research':
      return `compare architecture options ${prompt}`;
    default:
      return prompt;
  }
}

export function buildSubagentContextBlock(pack: SubagentInputPack): string {
  const parts: string[] = [];

  if (pack.bm25Results && pack.bm25Results.length > 0) {
    const snippets = pack.bm25Results.slice(0, 10);
    const snippetText = snippets
      .map(s => `### ${s.file}\n${s.text.slice(0, 1200)}`)
      .join('\n\n');
    parts.push(`## Relevant Project Context\n${snippetText}`);
  }

  if (pack.previousResults && pack.previousResults.length > 0) {
    const prevText = pack.previousResults
      .filter(r => !r.error && r.compactOutput)
      .map(r => `### ${r.role}\n${r.compactOutput.slice(0, 800)}`)
      .join('\n\n');
    if (prevText) {
      parts.push(`## Previous Subagent Findings\n${prevText}`);
    }
  }

  return parts.join('\n\n');
}
