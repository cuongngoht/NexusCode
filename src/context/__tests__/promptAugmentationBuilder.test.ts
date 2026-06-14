import { describe, it, expect } from 'vitest';
import { buildAugmentedPrompt } from '../promptAugmentationBuilder';

describe('buildAugmentedPrompt', () => {
  it('returns enhanced prompt with nexus progress instruction appended when no agents or skills', () => {
    const result = buildAugmentedPrompt({
      userPrompt: 'improve ChatController',
      existingEnhancedPrompt: '# Workspace\nRoot: /app\n\n# Task\nimprove ChatController',
    });
    expect(result).toContain('# Workspace\nRoot: /app\n\n# Task\nimprove ChatController');
    expect(result).toContain('You are running inside Nexus AI Code');
    // Enhanced prompt appears before progress instruction
    const taskPos = result.indexOf('# Task');
    const nexusPos = result.indexOf('You are running inside Nexus AI Code');
    expect(taskPos).toBeLessThan(nexusPos);
  });

  it('prepends agent bundle before enhanced prompt', () => {
    const result = buildAugmentedPrompt({
      agentMarkdownBundle: '# Nexus Agent Instructions\n\n## @senior-developer\nBe a senior dev.',
      userPrompt: 'improve ChatController',
      existingEnhancedPrompt: '# Task\nimprove ChatController',
    });
    expect(result).toContain('# Nexus Agent Instructions');
    expect(result).toContain('## @senior-developer');
    expect(result).toContain('# Task\nimprove ChatController');
    // Agent bundle appears before enhanced prompt
    const agentPos = result.indexOf('# Nexus Agent Instructions');
    const taskPos = result.indexOf('# Task');
    expect(agentPos).toBeLessThan(taskPos);
  });

  it('prepends skill bundle before enhanced prompt', () => {
    const result = buildAugmentedPrompt({
      skillMarkdownBundle: '# Nexus Skill Instructions\n\n## #refactor\nFocus on clean code.',
      userPrompt: 'improve ChatController',
      existingEnhancedPrompt: '# Task\nimprove ChatController',
    });
    expect(result).toContain('# Nexus Skill Instructions');
    expect(result).toContain('## #refactor');
    expect(result).toContain('# Task\nimprove ChatController');
    // Skill bundle appears before enhanced prompt
    const skillPos = result.indexOf('# Nexus Skill Instructions');
    const taskPos = result.indexOf('# Task');
    expect(skillPos).toBeLessThan(taskPos);
  });

  it('orders: agents first, skills second, task last', () => {
    const result = buildAugmentedPrompt({
      agentMarkdownBundle: '# Nexus Agent Instructions\n\n## @senior-developer\nBe senior.',
      skillMarkdownBundle: '# Nexus Skill Instructions\n\n## #refactor\nRefactor well.',
      userPrompt: 'improve ChatController',
      existingEnhancedPrompt: '# Task\nimprove ChatController',
    });
    const agentPos = result.indexOf('## @senior-developer');
    const skillPos = result.indexOf('## #refactor');
    const taskPos = result.indexOf('# Task');
    expect(agentPos).toBeLessThan(skillPos);
    expect(skillPos).toBeLessThan(taskPos);
  });

  it('includes separator lines between sections', () => {
    const result = buildAugmentedPrompt({
      agentMarkdownBundle: 'AGENT_BUNDLE',
      skillMarkdownBundle: 'SKILL_BUNDLE',
      userPrompt: 'task',
      existingEnhancedPrompt: 'TASK',
    });
    expect(result).toContain('---');
  });

  it('does NOT append MCP instruction when mcpEnabled is false or omitted', () => {
    const withoutFlag = buildAugmentedPrompt({
      userPrompt: 'review',
      existingEnhancedPrompt: 'TASK',
    });
    const withFalse = buildAugmentedPrompt({
      userPrompt: 'review',
      existingEnhancedPrompt: 'TASK',
      mcpEnabled: false,
    });
    expect(withoutFlag).not.toContain('NEXUS_TOOL_INTENT');
    expect(withFalse).not.toContain('NEXUS_TOOL_INTENT');
  });

  it('appends MCP tool instruction after progress instruction when mcpEnabled is true', () => {
    const result = buildAugmentedPrompt({
      userPrompt: 'review',
      existingEnhancedPrompt: 'TASK',
      mcpEnabled: true,
    });
    expect(result).toContain('NEXUS_TOOL_INTENT');
    expect(result).toContain('docs');
    expect(result).toContain('library-api');
    // MCP instruction appears after the progress instruction
    const progressPos = result.indexOf('You are running inside Nexus AI Code');
    const mcpPos = result.indexOf('NEXUS_TOOL_INTENT');
    expect(progressPos).toBeLessThan(mcpPos);
  });

  it('MCP instruction appears at the end even when agent and skill bundles are present', () => {
    const result = buildAugmentedPrompt({
      agentMarkdownBundle: 'AGENT',
      skillMarkdownBundle: 'SKILL',
      userPrompt: 'task',
      existingEnhancedPrompt: 'TASK',
      mcpEnabled: true,
    });
    const taskPos   = result.indexOf('TASK');
    const mcpPos    = result.indexOf('NEXUS_TOOL_INTENT');
    expect(taskPos).toBeLessThan(mcpPos);
  });
});
