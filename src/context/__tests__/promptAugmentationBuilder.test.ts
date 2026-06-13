import { describe, it, expect } from 'vitest';
import { buildAugmentedPrompt } from '../promptAugmentationBuilder';

describe('buildAugmentedPrompt', () => {
  it('returns enhanced prompt with nexus progress instruction appended when no agents or skills', () => {
    const result = buildAugmentedPrompt({
      userPrompt: 'improve ChatController',
      existingEnhancedPrompt: '# Workspace\nRoot: /app\n\n# Task\nimprove ChatController',
    });
    expect(result).toContain('# Workspace\nRoot: /app\n\n# Task\nimprove ChatController');
    expect(result).toContain('You are running inside Nexus Code');
    // Enhanced prompt appears before progress instruction
    const taskPos = result.indexOf('# Task');
    const nexusPos = result.indexOf('You are running inside Nexus Code');
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
});
