import { describe, it, expect } from 'vitest';
import { reducer, createInitialState } from './messages';
import type { AppAction, AppState } from './messages';

function s(): AppState { return createInitialState(); }
const act = (state: AppState, action: AppAction) => reducer(state, action);

describe('reducer — extension messages', () => {
  it('taskStarted: sets isRunning, resets elapsed, adds assistant message', () => {
    const next = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    expect(next.isRunning).toBe(true);
    expect(next.elapsed).toBe(0);
    const conv = next.conversations.find(c => c.id === next.activeConvId)!;
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].role).toBe('assistant');
  });

  it('stdout: appends lines to last assistant message', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    state = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'line1\nline2\n' } });
    const conv = state.conversations.find(c => c.id === state.activeConvId)!;
    const msg = conv.messages[0];
    expect(msg.role).toBe('assistant');
    if (msg.role === 'assistant') {
      expect(msg.lines).toHaveLength(2);
      expect(msg.lines[0].kind).toBe('stdout');
    }
  });

  it('stderr: appends lines as stderr kind', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    state = act(state, { type: 'extMsg', msg: { type: 'stderr', chunk: 'warn\n' } });
    const conv = state.conversations.find(c => c.id === state.activeConvId)!;
    const msg = conv.messages[0];
    if (msg.role === 'assistant') {
      expect(msg.lines[0].kind).toBe('stderr');
    }
  });

  it('taskCompleted exit 0: isRunning false, isStreaming false', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });
    expect(state.isRunning).toBe(false);
    const msg = state.conversations[0].messages[0];
    if (msg.role === 'assistant') {
      expect(msg.isStreaming).toBe(false);
      expect(msg.exitCode).toBe(0);
    }
  });

  it('taskCompleted exit 1: exitCode stored', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 1 } });
    const msg = state.conversations[0].messages[0];
    if (msg.role === 'assistant') expect(msg.exitCode).toBe(1);
  });

  it('taskStopped: isRunning false, isStreaming false', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskStopped', taskId: '1' } });
    expect(state.isRunning).toBe(false);
    const msg = state.conversations[0].messages[0];
    if (msg.role === 'assistant') expect(msg.isStreaming).toBe(false);
  });

  it('taskError: stores errorText, isRunning false', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskError', taskId: '1', message: 'boom' } });
    expect(state.isRunning).toBe(false);
    const msg = state.conversations[0].messages[0];
    if (msg.role === 'assistant') expect(msg.errorText).toBe('boom');
  });

  it('gitStatus: stored on active conversation', () => {
    const state = act(s(), { type: 'extMsg', msg: { type: 'gitStatus', changes: [{ status: 'M', path: 'a.ts' }] } });
    const conv = state.conversations.find(c => c.id === state.activeConvId)!;
    expect(conv.gitChanges).toHaveLength(1);
  });

  it('availableProviders: stored in state', () => {
    const state = act(s(), { type: 'extMsg', msg: { type: 'availableProviders', providers: ['claude'] } });
    expect(state.availableProviders).toEqual(['claude']);
  });
});

describe('reducer — local actions', () => {
  it('tick: increments elapsed', () => {
    expect(act(s(), { type: 'tick' }).elapsed).toBe(1);
  });

  it('sendUserMessage: adds user message, sets title on first message', () => {
    const state = act(s(), { type: 'sendUserMessage', prompt: 'hello world', provider: 'auto', mode: 'edit', timestamp: 0 });
    const conv = state.conversations.find(c => c.id === state.activeConvId)!;
    expect(conv.messages[0].role).toBe('user');
    expect(conv.title).toBe('hello world');
  });

  it('sendUserMessage: does not overwrite title on subsequent messages', () => {
    let state = act(s(), { type: 'sendUserMessage', prompt: 'first', provider: 'auto', mode: 'edit', timestamp: 0 });
    state = act(state, { type: 'sendUserMessage', prompt: 'second', provider: 'auto', mode: 'edit', timestamp: 1 });
    const conv = state.conversations.find(c => c.id === state.activeConvId)!;
    expect(conv.title).toBe('first');
  });

  it('newConversation: prepends a new conversation and makes it active', () => {
    const state = act(s(), { type: 'newConversation' });
    expect(state.conversations).toHaveLength(2);
    expect(state.conversations[0].id).toBe(state.activeConvId);
  });

  it('selectConversation: switches active conversation', () => {
    let state = act(s(), { type: 'newConversation' });
    const oldId = state.conversations[1].id;
    state = act(state, { type: 'selectConversation', id: oldId });
    expect(state.activeConvId).toBe(oldId);
    expect(state.showHistory).toBe(false);
  });

  it('toggleHistory: flips showHistory', () => {
    const on = act(s(), { type: 'toggleHistory' });
    expect(on.showHistory).toBe(true);
    expect(act(on, { type: 'toggleHistory' }).showHistory).toBe(false);
  });
});
