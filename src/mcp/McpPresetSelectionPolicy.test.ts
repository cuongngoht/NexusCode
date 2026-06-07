import { describe, it, expect } from 'vitest';
import { McpPresetSelectionPolicy } from './McpPresetSelectionPolicy';
import type { McpPreset } from './McpTypes';

const policy = new McpPresetSelectionPolicy();

const microsoftLearnPreset: McpPreset = {
  id: 'microsoftLearn',
  displayName: 'Microsoft Learn',
  description: 'Official Microsoft docs',
  transport: 'streamableHttp',
  endpoint: 'https://learn.microsoft.com/api/mcp',
  priority: 90,
  enabledByDefault: true,
  bestFor: ['azure', 'dotnet', '.net', 'csharp', 'c#', 'vscode', 'microsoft'],
  toolGroups: ['docs', 'samples', 'microsoft-docs'],
  risk: 'low',
};

const context7Preset: McpPreset = {
  id: 'context7',
  displayName: 'Context7',
  description: 'Library docs',
  transport: 'stdio',
  command: 'npx',
  args: ['-y', '@upstash/context7-mcp'],
  priority: 85,
  enabledByDefault: true,
  bestFor: ['react', 'nextjs', 'zod', 'prisma', 'npm', 'package', 'library'],
  toolGroups: ['docs', 'samples', 'library-api'],
  risk: 'low',
};

const allPresets = [microsoftLearnPreset, context7Preset];

describe('McpPresetSelectionPolicy', () => {
  it('selects Microsoft Learn for azure-related prompts', () => {
    const result = policy.select({
      prompt: 'How do I use Azure Blob Storage?',
      mode: 'research',
      intent: { group: 'docs', query: 'Azure Blob Storage SDK', reason: 'need azure docs' },
      enabledPresets: allPresets,
    });
    expect(result?.id).toBe('microsoftLearn');
  });

  it('selects Microsoft Learn for vscode-related prompts', () => {
    const result = policy.select({
      prompt: 'VS Code extension API',
      mode: 'ask',
      intent: { group: 'docs', query: 'vscode extension API', reason: 'need docs' },
      enabledPresets: allPresets,
    });
    expect(result?.id).toBe('microsoftLearn');
  });

  it('selects Microsoft Learn for .net prompts', () => {
    const result = policy.select({
      prompt: 'How to build a .net api?',
      mode: 'plan',
      intent: { group: 'microsoft-docs', query: '.net api docs', reason: 'need .net docs' },
      enabledPresets: allPresets,
    });
    expect(result?.id).toBe('microsoftLearn');
  });

  it('selects Context7 for react-related prompts', () => {
    const result = policy.select({
      prompt: 'How do I use React useQuery hook?',
      mode: 'ask',
      intent: { group: 'library-api', query: 'react useQuery hook', reason: 'need react docs' },
      enabledPresets: allPresets,
    });
    expect(result?.id).toBe('context7');
  });

  it('selects Context7 for npm package prompts', () => {
    const result = policy.select({
      prompt: 'What is the API for the zod library?',
      mode: 'research',
      intent: { group: 'library-api', query: 'zod schema validation', reason: 'need zod api' },
      enabledPresets: allPresets,
    });
    expect(result?.id).toBe('context7');
  });

  it('ignores disabled presets', () => {
    const result = policy.select({
      prompt: 'How do I use React?',
      mode: 'ask',
      intent: { group: 'docs', query: 'React documentation', reason: 'need react docs' },
      enabledPresets: [microsoftLearnPreset], // only MS Learn enabled
    });
    // Context7 is filtered out, so MS Learn wins (it supports 'docs' group)
    expect(result?.id).toBe('microsoftLearn');
  });

  it('returns undefined when no preset supports the group', () => {
    const result = policy.select({
      prompt: 'Some obscure query',
      mode: 'ask',
      intent: { group: 'library-api', query: 'some library', reason: 'need docs' },
      enabledPresets: [microsoftLearnPreset], // MS Learn does not support library-api
    });
    expect(result).toBeUndefined();
  });

  it('returns undefined when enabledPresets is empty', () => {
    const result = policy.select({
      prompt: 'How to use React?',
      mode: 'ask',
      intent: { group: 'docs', query: 'React', reason: 'need docs' },
      enabledPresets: [],
    });
    expect(result).toBeUndefined();
  });
});
