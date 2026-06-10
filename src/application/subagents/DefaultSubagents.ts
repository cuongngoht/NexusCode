import type { SubagentDefinition } from './SubagentDefinition';

export const DEFAULT_SUBAGENTS: SubagentDefinition[] = [
  {
    role: 'search',
    displayName: 'Search',
    promptFile: 'subagents/search.md',
    preferredAgentIds: ['antigravity', 'grok', 'codex', 'claude', 'copilot', 'aider', 'custom'],
    applicableModes: ['ask', 'edit', 'debug', 'test', 'plan', 'research', 'brainstorm'],
  },
  {
    role: 'planner',
    displayName: 'Planner',
    promptFile: 'subagents/planner.md',
    preferredAgentIds: ['codex', 'claude', 'grok', 'antigravity', 'copilot', 'aider', 'custom'],
    applicableModes: ['edit', 'debug', 'test', 'plan', 'brainstorm'],
  },
  {
    role: 'tester',
    displayName: 'Test Analyst',
    promptFile: 'subagents/tester.md',
    preferredAgentIds: ['codex', 'claude', 'grok', 'antigravity', 'copilot', 'aider', 'custom'],
    applicableModes: ['edit', 'test', 'debug'],
  },
  {
    role: 'reviewer',
    displayName: 'Reviewer',
    promptFile: 'subagents/reviewer.md',
    preferredAgentIds: ['codex', 'claude', 'grok', 'antigravity', 'copilot', 'aider', 'custom'],
    applicableModes: ['edit', 'review', 'test'],
  },
  {
    role: 'security',
    displayName: 'Security',
    promptFile: 'subagents/security.md',
    preferredAgentIds: ['codex', 'claude', 'grok', 'antigravity', 'copilot', 'aider', 'custom'],
    applicableModes: ['edit', 'review'],
  },
  {
    role: 'debugger',
    displayName: 'Debugger',
    promptFile: 'subagents/debugger.md',
    preferredAgentIds: ['codex', 'claude', 'grok', 'antigravity', 'copilot', 'aider', 'custom'],
    applicableModes: ['debug'],
  },
  {
    role: 'docs',
    displayName: 'Docs',
    promptFile: 'subagents/docs.md',
    preferredAgentIds: ['codex', 'claude', 'grok', 'antigravity', 'copilot', 'aider', 'custom'],
    applicableModes: ['ask', 'plan', 'brainstorm'],
  },
  {
    role: 'product',
    displayName: 'Product',
    promptFile: 'subagents/product.md',
    preferredAgentIds: ['codex', 'claude', 'grok', 'antigravity', 'copilot', 'aider', 'custom'],
    applicableModes: ['plan', 'brainstorm', 'ask'],
  },
  {
    role: 'research',
    displayName: 'Research',
    promptFile: 'subagents/research.md',
    preferredAgentIds: ['antigravity', 'grok', 'codex', 'claude', 'copilot', 'aider', 'custom'],
    applicableModes: ['ask', 'research', 'plan'],
  },
];
