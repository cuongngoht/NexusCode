import { describe, it, expect } from 'vitest';
import { reducer, createInitialState } from '../messages';
import type { AppAction, AppState, AssistantMessage } from '../messages';

function s(): AppState { return createInitialState(); }
const act = (state: AppState, action: AppAction) => reducer(state, action);

/** Helper: get the last assistant message from the run conversation. */
function lastAssistant(state: AppState): AssistantMessage | undefined {
  const convId = state.activeRunConversationId ?? state.activeConvId;
  const conv = state.conversations.find(c => c.id === convId);
  if (!conv) return undefined;
  const last = conv.messages[conv.messages.length - 1];
  return last?.role === 'assistant' ? (last as AssistantMessage) : undefined;
}

describe('stopTask guard — isStopping state', () => {
  it('stopTask action sets isStopping to true', () => {
    const state = act(s(), { type: 'stopTask' });
    expect(state.isStopping).toBe(true);
  });

  it('stopTask does not change isRunning', () => {
    // When not running, isRunning stays false after stopTask
    const notRunning = s();
    expect(notRunning.isRunning).toBe(false);
    const after = act(notRunning, { type: 'stopTask' });
    expect(after.isRunning).toBe(false);
  });

  it('taskCompleted resets isStopping to false', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    state = act(state, { type: 'stopTask' });
    expect(state.isStopping).toBe(true);

    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });
    expect(state.isStopping).toBe(false);
  });

  it('taskCompleted resets isRunning to false', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    expect(state.isRunning).toBe(true);

    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });
    expect(state.isRunning).toBe(false);
  });

  it('taskStopped resets isStopping to false', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    state = act(state, { type: 'stopTask' });
    expect(state.isStopping).toBe(true);

    state = act(state, { type: 'extMsg', msg: { type: 'taskStopped', taskId: '1' } });
    expect(state.isStopping).toBe(false);
  });

  it('taskStopped resets isRunning to false', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    expect(state.isRunning).toBe(true);

    state = act(state, { type: 'extMsg', msg: { type: 'taskStopped', taskId: '1' } });
    expect(state.isRunning).toBe(false);
  });

  it('taskError resets isStopping to false', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    state = act(state, { type: 'stopTask' });
    expect(state.isStopping).toBe(true);

    state = act(state, { type: 'extMsg', msg: { type: 'taskError', taskId: '1', message: 'something went wrong' } });
    expect(state.isStopping).toBe(false);
  });

  it('taskError resets isRunning to false', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    expect(state.isRunning).toBe(true);

    state = act(state, { type: 'extMsg', msg: { type: 'taskError', taskId: '1', message: 'something went wrong' } });
    expect(state.isRunning).toBe(false);
  });
});

describe('stdout/stderr guard — chunks dropped when isRunning is false', () => {
  it('stdout chunk is ignored when isRunning is false (initial state)', () => {
    const state = s();
    expect(state.isRunning).toBe(false);

    const before = state.conversations;
    const next = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'should be ignored\n' } });

    // State unchanged — same conversations reference
    expect(next.conversations).toBe(before);
  });

  it('stderr chunk is ignored when isRunning is false', () => {
    const state = s();
    const before = state.conversations;
    const next = act(state, { type: 'extMsg', msg: { type: 'stderr', chunk: 'error ignored\n' } });

    expect(next.conversations).toBe(before);
  });

  it('stdout arriving after taskCompleted is dropped (race condition guard)', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    state = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'first output\n' } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });
    expect(state.isRunning).toBe(false);

    const convsBefore = state.conversations;
    const next = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'late output\n' } });

    expect(next.conversations).toBe(convsBefore);
  });

  it('stdout arriving after taskStopped is dropped', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskStopped', taskId: '1' } });
    expect(state.isRunning).toBe(false);

    const convsBefore = state.conversations;
    const next = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'too late\n' } });

    expect(next.conversations).toBe(convsBefore);
  });

  it('stdout is accepted while task is running', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });

    state = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'output line\n' } });

    const msg = lastAssistant(state)!;
    expect(msg.lines).toHaveLength(1);
    expect(msg.lines[0].text).toBe('output line');
  });

  it('isStopping does not prevent stdout from being appended (stopTask only flags UI, not data)', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    // stopTask sets isStopping but isRunning stays true until the process actually stops
    state = act(state, { type: 'stopTask' });
    expect(state.isStopping).toBe(true);
    expect(state.isRunning).toBe(true);

    // Output still arrives before the process actually terminates
    state = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'final output\n' } });

    const msg = lastAssistant(state)!;
    expect(msg.lines).toHaveLength(1);
    expect(msg.lines[0].text).toBe('final output');
  });
});
