import { describe, it, expect } from 'vitest';
import { buildPlannerPrompt, type AgentPlannerInput } from '../AgentPlanner';
import { formatProjectContextSections, type AgentProjectContext } from '../AgentContextBuilder';
import type { AgentSession } from '../AgentSession';

function plannerInput(overrides: Partial<AgentPlannerInput> = {}): AgentPlannerInput {
  return {
    session: { id: 'sess-1' } as AgentSession,
    prompt: 'Add a feature',
    workspaceRoot: '/ws',
    providerId: 'claude',
    ...overrides,
  };
}

describe('buildPlannerPrompt — project context injection', () => {
  it('includes project rules and knowledge base sections when projectContext is provided', () => {
    const projectContext: AgentProjectContext = {
      workspaceInfo: 'Workspace: demo\nRoot: /ws',
      rules: 'Always use spawn with shell:false.',
      knowledgeBaseContext: 'Prior task: added provider X.',
    };
    const prompt = buildPlannerPrompt(plannerInput({ projectContext }));

    expect(prompt).toContain('# Workspace');
    expect(prompt).toContain('Workspace: demo');
    expect(prompt).toContain('# Project Rules');
    expect(prompt).toContain('Always use spawn with shell:false.');
    expect(prompt).toContain('# Project Knowledge Base');
    expect(prompt).toContain('Prior task: added provider X.');
    // Context sections come before the user task
    expect(prompt.indexOf('# Project Rules')).toBeLessThan(prompt.indexOf('# User Task'));
  });

  it('omits context sections when projectContext is absent or empty', () => {
    expect(buildPlannerPrompt(plannerInput())).not.toContain('# Project Rules');
    expect(buildPlannerPrompt(plannerInput({ projectContext: {} }))).not.toContain('# Project Rules');
    expect(buildPlannerPrompt(plannerInput({ projectContext: { rules: '   ' } }))).not.toContain('# Project Rules');
  });

  it('keeps conversation context and user task sections', () => {
    const prompt = buildPlannerPrompt(plannerInput({
      conversationContext: 'earlier discussion',
      projectContext: { rules: 'rule 1' },
    }));
    expect(prompt).toContain('# Previous Conversation Context');
    expect(prompt).toContain('earlier discussion');
    expect(prompt).toContain('# User Task');
    expect(prompt).toContain('Add a feature');
  });
});

describe('formatProjectContextSections', () => {
  it('truncates oversized sections to the per-section cap', () => {
    const formatted = formatProjectContextSections(
      { projectMap: 'x'.repeat(10_000) },
      { maxSectionChars: 100 },
    );
    expect(formatted).toContain('# Project Map');
    expect(formatted).toContain('…(truncated)');
    expect(formatted.length).toBeLessThan(200);
  });

  it('restricts output to the requested sections', () => {
    const ctx: AgentProjectContext = {
      rules: 'rule content',
      knowledgeBaseContext: 'kb content',
      projectMap: 'map content',
    };
    const formatted = formatProjectContextSections(ctx, { include: ['rules', 'knowledgeBaseContext'] });
    expect(formatted).toContain('# Project Rules');
    expect(formatted).toContain('# Project Knowledge Base');
    expect(formatted).not.toContain('# Project Map');
  });

  it('returns empty string for undefined context', () => {
    expect(formatProjectContextSections(undefined)).toBe('');
  });
});
