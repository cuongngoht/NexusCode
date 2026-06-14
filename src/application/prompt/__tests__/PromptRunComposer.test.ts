import { describe, it, expect } from 'vitest';
import { PromptRunComposer } from '../PromptRunComposer';
import type { ResolvedPromptSources } from '../PromptSourceResolver';

const composer = new PromptRunComposer();

describe('PromptRunComposer', () => {
  it('composes command, skill, agent, and user prompt in order', () => {
    const sources: ResolvedPromptSources = {
      commands: [{ id: 'plan', content: 'Plan the work.' }],
      skills: [{ id: 'api-design', content: 'Design the API carefully.' }],
      agents: [{ id: 'software-architect', content: 'You are a software architect.' }],
    };
    const result = composer.compose(sources, 'Implement autocomplete reload');

    expect(result).toContain('# Nexus Commands');
    expect(result).toContain('## /plan');
    expect(result).toContain('Plan the work.');

    expect(result).toContain('# Nexus Skills');
    expect(result).toContain('## #api-design');
    expect(result).toContain('Design the API carefully.');

    expect(result).toContain('# Nexus Agents');
    expect(result).toContain('## @software-architect');
    expect(result).toContain('You are a software architect.');

    expect(result).toContain('# User Task');
    expect(result).toContain('Implement autocomplete reload');

    // Verify order: Commands before Skills before Agents before User Task
    const commandsIdx = result.indexOf('# Nexus Commands');
    const skillsIdx = result.indexOf('# Nexus Skills');
    const agentsIdx = result.indexOf('# Nexus Agents');
    const userTaskIdx = result.indexOf('# User Task');

    expect(commandsIdx).toBeLessThan(skillsIdx);
    expect(skillsIdx).toBeLessThan(agentsIdx);
    expect(agentsIdx).toBeLessThan(userTaskIdx);
  });

  it('composes with no sources — only User Task section', () => {
    const sources: ResolvedPromptSources = {
      commands: [],
      skills: [],
      agents: [],
    };
    const result = composer.compose(sources, 'Just a plain prompt');

    expect(result).not.toContain('# Nexus Commands');
    expect(result).not.toContain('# Nexus Skills');
    expect(result).not.toContain('# Nexus Agents');
    expect(result).toContain('# User Task');
    expect(result).toContain('Just a plain prompt');
  });

  it('handles multiple commands under # Nexus Commands', () => {
    const sources: ResolvedPromptSources = {
      commands: [
        { id: 'plan', content: 'Plan first.' },
        { id: 'review', content: 'Then review.' },
      ],
      skills: [],
      agents: [],
    };
    const result = composer.compose(sources, 'Do something');

    expect(result).toContain('## /plan');
    expect(result).toContain('Plan first.');
    expect(result).toContain('## /review');
    expect(result).toContain('Then review.');

    const planIdx = result.indexOf('## /plan');
    const reviewIdx = result.indexOf('## /review');
    expect(planIdx).toBeLessThan(reviewIdx);
  });
});
