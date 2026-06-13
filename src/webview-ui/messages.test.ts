import { describe, it, expect } from 'vitest';
import { reducer, createInitialState, serializeHistory, aggregateConversationTokenUsage } from './messages';
import type { AgentModeCapability, AgentRecommendation, AppAction, AppState, ProviderInfo } from './messages';
import type { ChatHistoryState } from '../core/chat/ChatHistory';
import type { TokenRunUsage } from '../core/tokens/TokenUsage';

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
const capabilityMatrix: AgentModeCapability[] = [
  {
    agentId: 'claude',
    mode: 'edit',
    fit: 'best',
    reason: 'Strong edit support.',
  },
];
const recommendations: AgentRecommendation[] = [
  {
    mode: 'edit',
    recommended: 'claude',
    alternatives: [],
    limited: [],
    unavailable: ['codex', 'antigravity', 'copilot', 'aider', 'custom'],
  },
];

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

  it('availableProviders: stores capability matrix and recommendations', () => {
    const state = act(s(), {
      type: 'extMsg',
      msg: {
        type: 'availableProviders',
        providers: ['claude'],
        detection: [claudeInfo],
        needsSetup: false,
        capabilityMatrix,
        recommendations,
      },
    });

    expect(state.agentCapabilityMatrix).toEqual(capabilityMatrix);
    expect(state.agentRecommendations).toEqual(recommendations);
  });

  it('availableProviders: saved provider restore still works with capability data', () => {
    const state = act(s(), {
      type: 'extMsg',
      msg: {
        type: 'availableProviders',
        providers: ['claude'],
        detection: [claudeInfo],
        needsSetup: false,
        savedProvider: 'claude',
        capabilityMatrix,
        recommendations,
      },
    });

    expect(state.provider).toBe('claude');
    expect(state.agentRecommendations[0].recommended).toBe('claude');
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

describe('brainstorm mode', () => {
  it('setMode: supports brainstorm mode', () => {
    const state = act(s(), { type: 'setMode', value: 'brainstorm' });
    expect(state.mode).toBe('brainstorm');
  });

  it('history serialization preserves brainstorm mode', () => {
    let state = s();

    state = act(state, {
      type: 'sendUserMessage',
      prompt: 'brainstorm feature ideas',
      provider: 'auto',
      mode: 'brainstorm',
      timestamp: 1000,
    });

    const history = serializeHistory(state);
    expect(history.conversations[0].messages[0].mode).toBe('brainstorm');

    const restored = act(s(), {
      type: 'extMsg',
      msg: { type: 'historyLoaded', history },
    });

    const msg = restored.conversations[0].messages[0];
    expect(msg.role).toBe('user');
    if (msg.role === 'user') {
      expect(msg.mode).toBe('brainstorm');
    }
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

const sampleUsage: TokenRunUsage = {
  taskId: 'task_1',
  provider: 'claude',
  providerLabel: 'Claude',
  mode: 'ask',
  model: 'sonnet',
  inputTokens: 500,
  outputTokens: 200,
  totalTokens: 700,
  originalPromptTokens: 100,
  enhancedPromptTokens: 500,
  contextOverheadTokens: 400,
  source: 'estimated',
  tokenizer: 'gpt-tokenizer/o200k_base',
  startedAt: 1000,
  completedAt: 2000,
};

describe('token usage — reducer and aggregation', () => {
  it('tokenUsageUpdated attaches usage to latest assistant message', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' } });
    state = act(state, { type: 'extMsg', msg: { type: 'tokenUsageUpdated', taskId: '1', phase: 'final', usage: sampleUsage } });
    const conv = state.conversations.find(c => c.id === state.activeConvId)!;
    const msg = conv.messages[0];
    expect(msg.role).toBe('assistant');
    if (msg.role === 'assistant') {
      expect(msg.tokenUsage).toEqual(sampleUsage);
    }
  });

  it('conversation tokenUsage aggregates after tokenUsageUpdated', () => {
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' } });
    state = act(state, { type: 'extMsg', msg: { type: 'tokenUsageUpdated', taskId: '1', phase: 'final', usage: sampleUsage } });
    const conv = state.conversations.find(c => c.id === state.activeConvId)!;
    expect(conv.tokenUsage.runs).toBe(1);
    expect(conv.tokenUsage.totalTokens).toBe(700);
    expect(conv.tokenUsage.inputTokens).toBe(500);
    expect(conv.tokenUsage.outputTokens).toBe(200);
  });

  it('aggregation groups by provider correctly', () => {
    const codexUsage: TokenRunUsage = {
      ...sampleUsage,
      taskId: 'task_2',
      provider: 'codex',
      providerLabel: 'Codex',
      inputTokens: 300,
      outputTokens: 100,
      totalTokens: 400,
    };
    // First run with claude
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' } });
    state = act(state, { type: 'extMsg', msg: { type: 'tokenUsageUpdated', taskId: '1', phase: 'final', usage: sampleUsage } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });
    // Second run with codex
    state = act(state, { type: 'extMsg', msg: { type: 'taskStarted', taskId: '2', provider: 'codex', mode: 'ask' } });
    state = act(state, { type: 'extMsg', msg: { type: 'tokenUsageUpdated', taskId: '2', phase: 'final', usage: codexUsage } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '2', exitCode: 0 } });
    const conv = state.conversations.find(c => c.id === state.activeConvId)!;
    expect(conv.tokenUsage.runs).toBe(2);
    expect(conv.tokenUsage.byProvider['claude'].totalTokens).toBe(700);
    expect(conv.tokenUsage.byProvider['codex'].totalTokens).toBe(400);
  });

  it('history serialization preserves assistant tokenUsage', () => {
    let state = act(s(), { type: 'sendUserMessage', prompt: 'hello', provider: 'claude', mode: 'ask', timestamp: 1000 });
    state = act(state, { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' } });
    state = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'response\n' } });
    state = act(state, { type: 'extMsg', msg: { type: 'tokenUsageUpdated', taskId: '1', phase: 'final', usage: sampleUsage } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });

    const history = serializeHistory(state);
    const assistantMsg = history.conversations[0].messages.find(m => m.role === 'assistant');
    expect(assistantMsg).toBeDefined();
    if (assistantMsg?.role === 'assistant') {
      expect(assistantMsg.tokenUsage).toEqual(sampleUsage);
    }
  });

  it('history deserialization rebuilds conversation tokenUsage', () => {
    let state = act(s(), { type: 'sendUserMessage', prompt: 'hello', provider: 'claude', mode: 'ask', timestamp: 1000 });
    state = act(state, { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' } });
    state = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'response\n' } });
    state = act(state, { type: 'extMsg', msg: { type: 'tokenUsageUpdated', taskId: '1', phase: 'final', usage: sampleUsage } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });

    const history = serializeHistory(state);
    const fresh = act(s(), { type: 'extMsg', msg: { type: 'historyLoaded', history } });
    const conv = fresh.conversations[0];
    expect(conv.tokenUsage.runs).toBe(1);
    expect(conv.tokenUsage.totalTokens).toBe(700);
    expect(conv.tokenUsage.byProvider['claude']).toBeDefined();
  });

  it('aggregateConversationTokenUsage: skips messages without tokenUsage', () => {
    const usage = aggregateConversationTokenUsage([
      { id: '1', role: 'user', prompt: 'hi', provider: 'claude', mode: 'ask', timestamp: 1 },
      { id: '2', role: 'assistant', providerLabel: 'Claude', mode: 'ask', lines: [], isStreaming: false, steps: [] },
    ]);
    expect(usage.runs).toBe(0);
    expect(usage.totalTokens).toBe(0);
  });
});

// ── Test A: selectConversation increments saveKey ─────────────────────────
describe('Test A — selectConversation persists active conversation', () => {
  it('increments saveKey so autosave fires', () => {
    let state = act(s(), { type: 'newConversation' });
    const oldId = state.conversations[1].id;
    const beforeKey = state.saveKey;
    state = act(state, { type: 'selectConversation', id: oldId });
    expect(state.saveKey).toBe(beforeKey + 1);
  });
});

// ── Test B: serializeHistory preserves updatedAt ──────────────────────────
describe('Test B — serializeHistory does not reset updatedAt', () => {
  it('preserves existing updatedAt of an unchanged conversation', () => {
    const FIXED_TIME = 1_700_000_000_000;
    let state = act(s(), {
      type: 'extMsg',
      msg: {
        type: 'historyLoaded',
        history: {
          version: 1,
          activeConversationId: 'c1',
          conversations: [
            {
              id: 'c1',
              title: 'T',
              createdAt: FIXED_TIME,
              updatedAt: FIXED_TIME,
              messages: [],
            },
          ],
        },
      },
    });
    const history = serializeHistory(state);
    expect(history.conversations[0].updatedAt).toBe(FIXED_TIME);
  });

  it('preserves updatedAt set by touchConversation when task completes', () => {
    const T1 = 1_000_000;
    let state = act(s(), { type: 'sendUserMessage', prompt: 'hi', provider: 'claude', mode: 'ask', timestamp: T1 });
    state = act(state, { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });
    const conv = state.conversations.find(c => c.id === state.activeConvId)!;
    // updatedAt should have been set (≥ T1)
    expect(conv.updatedAt).toBeGreaterThanOrEqual(T1);
    // serializing again should not change updatedAt
    const history = serializeHistory(state);
    expect(history.conversations[0].updatedAt).toBe(conv.updatedAt);
  });
});

// ── Test C: sendUserMessage only touches active conversation ──────────────
describe('Test C — sendUserMessage only modifies active conversation', () => {
  it('does not mutate the other conversation', () => {
    let state = act(s(), { type: 'newConversation' });
    const backgroundId = state.conversations[1].id;
    const backgroundBefore = state.conversations[1];
    state = act(state, { type: 'sendUserMessage', prompt: 'hello', provider: 'claude', mode: 'ask', timestamp: 100 });
    const backgroundAfter = state.conversations.find(c => c.id === backgroundId)!;
    expect(backgroundAfter).toBe(backgroundBefore); // same reference — not mutated
  });
});

// ── Test D: task output routes to run conversation, not active ───────────
describe('Test D — runtime events go to the conversation that started the run', () => {
  it('task output stays in the run conversation even after user switches', () => {
    // Conversation A starts a task
    let state = act(s(), { type: 'sendUserMessage', prompt: 'run me', provider: 'claude', mode: 'ask', timestamp: 1 });
    const convA = state.activeConvId;
    state = act(state, { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' } });

    // User creates a new conversation B and switches to it
    state = act(state, { type: 'newConversation' });
    const convB = state.activeConvId;
    expect(convB).not.toBe(convA);

    // Stdout arrives while B is active — should go to A (where the run started)
    state = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'result\n' } });

    const a = state.conversations.find(c => c.id === convA)!;
    const b = state.conversations.find(c => c.id === convB)!;
    const aLast = a.messages[a.messages.length - 1];
    expect(aLast.role).toBe('assistant');
    if (aLast.role === 'assistant') {
      expect(aLast.lines.some(l => l.text === 'result')).toBe(true);
    }
    expect(b.messages).toHaveLength(0);
  });

  it('taskCompleted touches the run conversation, not the active one', () => {
    let state = act(s(), { type: 'sendUserMessage', prompt: 'run me', provider: 'claude', mode: 'ask', timestamp: 1 });
    const convA = state.activeConvId;
    state = act(state, { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' } });

    state = act(state, { type: 'newConversation' });
    const beforeUpdatedAt = state.conversations.find(c => c.id === convA)?.updatedAt;

    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });

    const aAfter = state.conversations.find(c => c.id === convA)!;
    expect(aAfter.updatedAt).toBeGreaterThanOrEqual(beforeUpdatedAt ?? 0);
    // saveKey incremented
    expect(state.saveKey).toBeGreaterThan(0);
  });
});

// ── Approval gate reducer tests ───────────────────────────────────────────
describe('approval gate — planReadyForApproval and planRejected', () => {
  function withStreamingMsg(): AppState {
    let state = act(s(), { type: 'extMsg', msg: { type: 'stepStarted', stepLabel: 'plan', stepIndex: 0, totalSteps: 2, provider: 'nexus', mode: 'edit' } });
    state = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'plan content\n' } });
    return state;
  }

  it('planReadyForApproval: sets pendingPlanApproval=true, planSaved=true, stops streaming', () => {
    let state = withStreamingMsg();
    state = act(state, {
      type: 'extMsg',
      msg: { type: 'planReadyForApproval', taskId: 'task-1', planPath: '/tmp/plan.md', plan: 'do x', mode: 'edit', model: 'sonnet' },
    });

    const conv = state.conversations.find(c => c.id === state.activeConvId)!;
    const msg = conv.messages[conv.messages.length - 1];
    expect(msg.role).toBe('assistant');
    if (msg.role === 'assistant') {
      expect(msg.pendingPlanApproval).toBe(true);
      expect(msg.planSaved).toBe(true);
      expect(msg.planPath).toBe('/tmp/plan.md');
      expect(msg.isStreaming).toBe(false);
    }
  });

  it('planRejected: clears pendingPlanApproval, sets rejectedPlan=true', () => {
    let state = withStreamingMsg();
    state = act(state, {
      type: 'extMsg',
      msg: { type: 'planReadyForApproval', taskId: 'task-1', planPath: '/tmp/plan.md', plan: 'do x', mode: 'edit' },
    });
    state = act(state, {
      type: 'extMsg',
      msg: { type: 'planRejected', planPath: '/tmp/plan.md' },
    });

    const conv = state.conversations.find(c => c.id === state.activeConvId)!;
    const msg = conv.messages[conv.messages.length - 1];
    if (msg.role === 'assistant') {
      expect(msg.pendingPlanApproval).toBe(false);
      expect(msg.rejectedPlan).toBe(true);
    }
  });

  it('planReadyForApproval: planPreview stores plan content', () => {
    let state = withStreamingMsg();
    state = act(state, {
      type: 'extMsg',
      msg: { type: 'planReadyForApproval', taskId: 'task-1', plan: 'step 1\nstep 2', mode: 'edit' },
    });

    const conv = state.conversations.find(c => c.id === state.activeConvId)!;
    const msg = conv.messages[conv.messages.length - 1];
    if (msg.role === 'assistant') {
      expect(msg.planPreview).toBe('step 1\nstep 2');
    }
  });
});

// ── Test E: assistant timestamp roundtrips through serialize/deserialize ──
describe('Test E — assistant message timestamp survives serialize/deserialize', () => {
  it('timestamp on assistant message is preserved through history roundtrip', () => {
    let state = act(s(), { type: 'sendUserMessage', prompt: 'hello', provider: 'claude', mode: 'ask', timestamp: 1000 });
    state = act(state, { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' } });
    state = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'response\n' } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });

    const beforeHistory = serializeHistory(state);
    const assistantInHistory = beforeHistory.conversations[0].messages.find(m => m.role === 'assistant');
    expect(assistantInHistory?.timestamp).toBeGreaterThan(0);

    const restored = act(s(), { type: 'extMsg', msg: { type: 'historyLoaded', history: beforeHistory } });
    const restoredConv = restored.conversations[0];
    const restoredAssistant = restoredConv.messages.find(m => m.role === 'assistant');
    expect(restoredAssistant?.role).toBe('assistant');
    if (restoredAssistant?.role === 'assistant') {
      expect(restoredAssistant.timestamp).toBe(assistantInHistory?.timestamp);
    }
  });
});
