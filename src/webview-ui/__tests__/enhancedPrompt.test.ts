import { describe, it, expect } from 'vitest';
import { reducer, createInitialState } from '../messages';
import type { AppAction, AppState, AssistantMessage } from '../messages';

function s(): AppState { return createInitialState(); }
const act = (state: AppState, action: AppAction) => reducer(state, action);

/** Helper: get the last assistant message from the active conversation. */
function lastAssistant(state: AppState): AssistantMessage | undefined {
  const conv = state.conversations.find(c => c.id === state.activeConvId);
  if (!conv) return undefined;
  const last = conv.messages[conv.messages.length - 1];
  return last?.role === 'assistant' ? (last as AssistantMessage) : undefined;
}

describe('taskStarted — enhancedPromptSnapshot', () => {
  it('sets enhancedPromptSnapshot when enhancedPrompt is provided', () => {
    // First, add a user message so the reducer can extract originalPrompt
    let state = act(s(), {
      type: 'sendUserMessage',
      prompt: 'fix the bug',
      provider: 'claude',
      mode: 'edit',
      timestamp: 1000,
    });

    state = act(state, {
      type: 'extMsg',
      msg: {
        type: 'taskStarted',
        taskId: '1',
        provider: 'claude',
        mode: 'edit',
        enhancedPrompt: 'Enhanced: fix the bug with context',
      },
    });

    const msg = lastAssistant(state);
    expect(msg).toBeDefined();
    expect(msg?.enhancedPromptSnapshot).toBeDefined();
    expect(msg?.enhancedPromptSnapshot?.enhancedPrompt).toBe('Enhanced: fix the bug with context');
  });

  it('sets enhancedPromptSnapshot.originalPrompt from the last user message', () => {
    let state = act(s(), {
      type: 'sendUserMessage',
      prompt: 'fix the bug',
      provider: 'claude',
      mode: 'edit',
      timestamp: 1000,
    });

    state = act(state, {
      type: 'extMsg',
      msg: {
        type: 'taskStarted',
        taskId: '1',
        provider: 'claude',
        mode: 'edit',
        enhancedPrompt: 'Enhanced: fix the bug with context',
      },
    });

    const msg = lastAssistant(state);
    expect(msg?.enhancedPromptSnapshot?.originalPrompt).toBe('fix the bug');
  });

  it('sets enhancedPromptSnapshot.sections from the event', () => {
    const sections = [
      { title: 'Context', content: 'project context here' },
      { title: 'Rules', content: 'coding rules here' },
    ];

    let state = act(s(), {
      type: 'sendUserMessage',
      prompt: 'add tests',
      provider: 'claude',
      mode: 'test',
      timestamp: 1000,
    });

    state = act(state, {
      type: 'extMsg',
      msg: {
        type: 'taskStarted',
        taskId: '1',
        provider: 'claude',
        mode: 'test',
        enhancedPrompt: 'Enhanced add tests...',
        enhancedPromptSections: sections,
      },
    });

    const msg = lastAssistant(state);
    expect(msg?.enhancedPromptSnapshot?.sections).toEqual(sections);
  });

  it('sets enhancedPromptSnapshot.sections to empty array when not provided', () => {
    let state = act(s(), {
      type: 'sendUserMessage',
      prompt: 'write docs',
      provider: 'claude',
      mode: 'ask',
      timestamp: 1000,
    });

    state = act(state, {
      type: 'extMsg',
      msg: {
        type: 'taskStarted',
        taskId: '1',
        provider: 'claude',
        mode: 'ask',
        enhancedPrompt: 'Enhanced write docs',
      },
    });

    const msg = lastAssistant(state);
    expect(msg?.enhancedPromptSnapshot?.sections).toEqual([]);
  });

  it('sets enhancedPromptSnapshot.wasTruncated to false', () => {
    let state = act(s(), {
      type: 'sendUserMessage',
      prompt: 'analyze code',
      provider: 'claude',
      mode: 'ask',
      timestamp: 1000,
    });

    state = act(state, {
      type: 'extMsg',
      msg: {
        type: 'taskStarted',
        taskId: '1',
        provider: 'claude',
        mode: 'ask',
        enhancedPrompt: 'Enhanced analyze code...',
      },
    });

    const msg = lastAssistant(state);
    expect(msg?.enhancedPromptSnapshot?.wasTruncated).toBe(false);
  });

  it('sets enhancedPromptSnapshot.generatedAt to a positive timestamp', () => {
    const before = Date.now();

    let state = act(s(), {
      type: 'sendUserMessage',
      prompt: 'check this',
      provider: 'claude',
      mode: 'ask',
      timestamp: 1000,
    });

    state = act(state, {
      type: 'extMsg',
      msg: {
        type: 'taskStarted',
        taskId: '1',
        provider: 'claude',
        mode: 'ask',
        enhancedPrompt: 'Enhanced check this',
      },
    });

    const after = Date.now();
    const msg = lastAssistant(state);
    expect(msg?.enhancedPromptSnapshot?.generatedAt).toBeGreaterThanOrEqual(before);
    expect(msg?.enhancedPromptSnapshot?.generatedAt).toBeLessThanOrEqual(after);
  });

  it('leaves enhancedPromptSnapshot undefined when enhancedPrompt is not provided', () => {
    let state = act(s(), {
      type: 'sendUserMessage',
      prompt: 'simple question',
      provider: 'claude',
      mode: 'ask',
      timestamp: 1000,
    });

    state = act(state, {
      type: 'extMsg',
      msg: {
        type: 'taskStarted',
        taskId: '1',
        provider: 'claude',
        mode: 'ask',
        // no enhancedPrompt field
      },
    });

    const msg = lastAssistant(state);
    expect(msg?.enhancedPromptSnapshot).toBeUndefined();
  });

  it('sets originalPrompt to empty string when no user message precedes taskStarted', () => {
    // taskStarted without any prior sendUserMessage
    const state = act(s(), {
      type: 'extMsg',
      msg: {
        type: 'taskStarted',
        taskId: '1',
        provider: 'claude',
        mode: 'ask',
        enhancedPrompt: 'Enhanced prompt with no prior user message',
      },
    });

    const msg = lastAssistant(state);
    expect(msg?.enhancedPromptSnapshot?.originalPrompt).toBe('');
  });

  it('snapshot is updated on an existing streaming message when taskStarted follows stepStarted', () => {
    // Pipeline mode: stepStarted first creates the AssistantMessage, then taskStarted patches it
    let state = act(s(), {
      type: 'sendUserMessage',
      prompt: 'scan workspace',
      provider: 'claude',
      mode: 'scan-project',
      timestamp: 1000,
    });

    // stepStarted creates the AssistantMessage
    state = act(state, {
      type: 'extMsg',
      msg: {
        type: 'stepStarted',
        stepLabel: 'scan',
        stepIndex: 0,
        totalSteps: 2,
        provider: 'claude',
        mode: 'scan-project',
      },
    });

    // taskStarted patches the existing streaming AssistantMessage
    state = act(state, {
      type: 'extMsg',
      msg: {
        type: 'taskStarted',
        taskId: '1',
        provider: 'claude',
        mode: 'scan-project',
        enhancedPrompt: 'Pipeline enhanced: scan workspace',
      },
    });

    const msg = lastAssistant(state);
    expect(msg?.enhancedPromptSnapshot?.enhancedPrompt).toBe('Pipeline enhanced: scan workspace');
    expect(msg?.enhancedPromptSnapshot?.originalPrompt).toBe('scan workspace');
  });
});
