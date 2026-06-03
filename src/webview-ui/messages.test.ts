import { describe, it, expect } from 'vitest';
import { reducer, createInitialState, serializeHistory } from './messages';
import type { AppAction, AppState, ProviderInfo } from './messages';
import type { ChatHistoryState } from '../core/chat/ChatHistory';

function s(): AppState { return createInitialState(); }
const act = (state: AppState, action: AppAction) => reducer(state, action);
const claudeInfo: ProviderInfo = {
  id: 'claude',
  displayName: 'Claude',
  cliLabel: 'Claude CLI',
  installed: true,
  version: '1.2.3',
  executablePath: '/usr/local/bin/claude',
  supportsModelSelection: true,
  defaultModel: 'sonnet',
  models: [{ id: 'sonnet', label: 'sonnet', source: 'seeded' }],
};

describe('reducer — extension messages', () => {
  it('taskStarted: sets isRunning, resets elapsed, adds assistant message', () => {
    const next = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit', model: 'sonnet' } });
    expect(next.isRunning).toBe(true);
    expect(next.elapsed).toBe(0);
    const conv = next.conversations.find(c => c.id === next.activeConvId)!;
    expect(conv.messages).toHaveLength(1);
    expect(conv.messages[0].role).toBe('assistant');
    if (conv.messages[0].role === 'assistant') {
      expect(conv.messages[0].model).toBe('sonnet');
    }
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
    const state = act(s(), {
      type: 'extMsg',
      msg: { type: 'availableProviders', providers: ['claude'], detection: [claudeInfo] },
    });
    expect(state.availableProviders).toEqual(['claude']);
    expect(state.providerDetection[0].models[0].id).toBe('sonnet');
  });
});

describe('reducer — local actions', () => {
  it('tick: increments elapsed', () => {
    expect(act(s(), { type: 'tick' }).elapsed).toBe(1);
  });

  it('sendUserMessage: adds user message, sets title on first message', () => {
    const state = act(s(), {
      type: 'sendUserMessage',
      prompt: 'hello world',
      provider: 'claude',
      mode: 'edit',
      model: 'sonnet',
      timestamp: 0,
    });
    const conv = state.conversations.find(c => c.id === state.activeConvId)!;
    expect(conv.messages[0].role).toBe('user');
    if (conv.messages[0].role === 'user') {
      expect(conv.messages[0].model).toBe('sonnet');
    }
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

  it('setModel: stores selected model', () => {
    const state = act(s(), { type: 'setModel', value: 'sonnet' });
    expect(state.selectedModel).toBe('sonnet');
  });

  it('setProvider: clears selected model', () => {
    let state = act(s(), { type: 'setModel', value: 'sonnet' });
    state = act(state, { type: 'setProvider', value: 'codex' });
    expect(state.selectedModel).toBeUndefined();
  });

  it('deleteConversation: removes target, keeps others, updates active if needed', () => {
    let state = act(s(), { type: 'newConversation' });
    const [newer, older] = [state.conversations[0], state.conversations[1]];
    state = act(state, { type: 'deleteConversation', id: newer.id });
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0].id).toBe(older.id);
    expect(state.activeConvId).toBe(older.id);
  });

  it('deleteConversation: never leaves 0 conversations', () => {
    const state = act(s(), { type: 'deleteConversation', id: s().activeConvId });
    expect(state.conversations).toHaveLength(1);
  });

  it('clearHistory: resets to single empty conversation', () => {
    let state = act(s(), { type: 'newConversation' });
    state = act(state, { type: 'newConversation' });
    expect(state.conversations).toHaveLength(3);
    state = act(state, { type: 'clearHistory' });
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0].messages).toHaveLength(0);
  });

  it('saveKey increments on taskCompleted', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    const before = state.saveKey;
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });
    expect(state.saveKey).toBe(before + 1);
  });

  it('saveKey increments on taskStopped', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' } });
    const before = state.saveKey;
    state = act(state, { type: 'extMsg', msg: { type: 'taskStopped', taskId: '1' } });
    expect(state.saveKey).toBe(before + 1);
  });

  it('saveKey increments on newConversation, deleteConversation, clearHistory', () => {
    let state = s();
    state = act(state, { type: 'newConversation' });
    expect(state.saveKey).toBe(1);
    state = act(state, { type: 'deleteConversation', id: state.conversations[0].id });
    expect(state.saveKey).toBe(2);
    state = act(state, { type: 'clearHistory' });
    expect(state.saveKey).toBe(3);
  });

  it('tick does NOT increment saveKey', () => {
    const state = act(s(), { type: 'tick' });
    expect(state.saveKey).toBe(0);
  });
});

describe('history serialization roundtrip', () => {
  it('serializeHistory → historyLoaded restores conversations', () => {
    let state = s();
    state = act(state, {
      type: 'sendUserMessage',
      prompt: 'hello',
      provider: 'claude',
      mode: 'ask',
      timestamp: 1000,
    });
    state = act(state, { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' } });
    state = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'response\n' } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });

    const history = serializeHistory(state);
    expect(history.version).toBe(1);
    expect(history.conversations).toHaveLength(1);
    expect(history.conversations[0].messages).toHaveLength(2);

    const fresh = act(s(), { type: 'extMsg', msg: { type: 'historyLoaded', history } });
    expect(fresh.conversations).toHaveLength(1);
    const conv = fresh.conversations[0];
    expect(conv.messages).toHaveLength(2);
    expect(conv.messages[0].role).toBe('user');
    if (conv.messages[1].role === 'assistant') {
      expect(conv.messages[1].isStreaming).toBe(false);
      expect(conv.messages[1].lines[0].text).toBe('response');
    }
  });

  it('historyLoaded with empty conversations keeps initial state', () => {
    const history: ChatHistoryState = { version: 1, activeConversationId: 'x', conversations: [] };
    const state = act(s(), { type: 'extMsg', msg: { type: 'historyLoaded', history } });
    expect(state.conversations).toHaveLength(1);
  });

  it('serializeHistory: streaming assistant message is excluded', () => {
    let state = act(s(), { type: 'sendUserMessage', prompt: 'hi', provider: 'claude', mode: 'ask', timestamp: 1 });
    state = act(state, { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' } });
    state = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'partial\n' } });
    // Task still running — assistant message isStreaming = true
    const history = serializeHistory(state);
    expect(history.conversations[0].messages).toHaveLength(1); // only user message
    expect(history.conversations[0].messages[0].role).toBe('user');
  });
});
