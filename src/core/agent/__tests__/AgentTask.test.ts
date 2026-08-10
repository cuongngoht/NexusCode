import { describe, it, expect } from 'vitest';
import { AgentTask } from '../AgentTask';
import { AgentResult } from '../AgentResult';

const makeTask = () =>
  new AgentTask(
    'original prompt',
    'enhanced prompt',
    'claude',
    'edit',
    'claude-opus',
    '/workspace',
    ['skill-a'],
    ['agent-b'],
    [{ title: 'Skill Instructions', content: 'BUNDLE' }],
  );

describe('AgentTask.withEnhancedPrompt', () => {
  // Identity is load-bearing: ~10 listeners filter on `event.task.id === task.id`, and
  // the webview keys its streaming message off it. A fresh id for an MCP follow-up round
  // strands all of them on round 1's output, which is just the bare intent tag.
  it('preserves the task id', () => {
    const task = makeTask();
    expect(task.withEnhancedPrompt('new').id).toBe(task.id);
  });

  it('preserves startedAt so elapsed time spans the whole turn', () => {
    const task = makeTask();
    expect(task.withEnhancedPrompt('new').startedAt).toBe(task.startedAt);
  });

  it('replaces only the enhanced prompt', () => {
    const next = makeTask().withEnhancedPrompt('MCP CONTEXT APPENDED');
    expect(next.enhancedPrompt).toBe('MCP CONTEXT APPENDED');
    expect(next.prompt).toBe('original prompt');
  });

  it('carries every field the follow-up run needs', () => {
    const next = makeTask().withEnhancedPrompt('new');
    expect(next.agentId).toBe('claude');
    expect(next.mode).toBe('edit');
    expect(next.model).toBe('claude-opus');
    expect(next.cwd).toBe('/workspace');
    expect(next.skillIds).toEqual(['skill-a']);
    expect(next.mentionedAgentIds).toEqual(['agent-b']);
    expect(next.enhancedPromptSections).toEqual([{ title: 'Skill Instructions', content: 'BUNDLE' }]);
  });

  it('resets status to pending so the next round can start cleanly', () => {
    const task = makeTask();
    task.start();
    task.complete(new AgentResult(0, 'out', '', 10));
    expect(task.status).toBe('completed');

    const next = task.withEnhancedPrompt('new');
    expect(next.status).toBe('pending');
    expect(next.result).toBeUndefined();
  });

  it('does not mutate the original task', () => {
    const task = makeTask();
    task.withEnhancedPrompt('new');
    expect(task.enhancedPrompt).toBe('enhanced prompt');
  });
});
