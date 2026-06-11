import { describe, it, expect } from 'vitest';
import { reducer, createInitialState } from '../messages';
import type { AppAction, AppState, UserMessage } from '../messages';

function s(): AppState { return createInitialState(); }
const act = (state: AppState, action: AppAction) => reducer(state, action);

/** Helper: creates a state with a user message and returns the state plus the user message id. */
function stateWithUserMessage(prompt = 'fix the bug', provider: AppState['provider'] = 'claude'): {
  state: AppState;
  convId: string;
  userMsgId: string;
} {
  const state = act(s(), {
    type: 'sendUserMessage',
    prompt,
    provider,
    mode: 'edit',
    model: 'sonnet',
    timestamp: 1000,
  });
  const convId = state.activeConvId;
  const conv = state.conversations.find(c => c.id === convId)!;
  const userMsg = conv.messages[0] as UserMessage;
  return { state, convId, userMsgId: userMsg.id };
}

describe('retryMessage reducer', () => {
  it('sets pendingRetry with prompt from the user message', () => {
    const { state, userMsgId } = stateWithUserMessage('fix the bug');

    const next = act(state, { type: 'retryMessage', userMessageId: userMsgId, useCurrentSettings: false });

    expect(next.pendingRetry).toBeDefined();
    expect(next.pendingRetry?.prompt).toBe('fix the bug');
  });

  it('sets pendingRetry.sourceMessageId to the user message id', () => {
    const { state, userMsgId } = stateWithUserMessage();

    const next = act(state, { type: 'retryMessage', userMessageId: userMsgId, useCurrentSettings: false });

    expect(next.pendingRetry?.sourceMessageId).toBe(userMsgId);
  });

  it('stores pendingRetry.provider from the original user message (useCurrentSettings: false)', () => {
    const { state, userMsgId } = stateWithUserMessage('prompt', 'claude');

    // Current provider is 'nexus' (initial), but message was sent with 'claude'
    const next = act(state, { type: 'retryMessage', userMessageId: userMsgId, useCurrentSettings: false });

    // The implementation stores userMsg.provider in pendingRetry.provider regardless of useCurrentSettings
    expect(next.pendingRetry?.provider).toBe('claude');
    expect(next.pendingRetry?.useCurrentSettings).toBe(false);
  });

  it('stores pendingRetry.provider from the original user message (useCurrentSettings: true)', () => {
    const { state, userMsgId } = stateWithUserMessage('prompt', 'claude');

    // The implementation always stores userMsg.provider; useCurrentSettings is just a stored flag
    const next = act(state, { type: 'retryMessage', userMessageId: userMsgId, useCurrentSettings: true });

    expect(next.pendingRetry?.provider).toBe('claude');
    expect(next.pendingRetry?.useCurrentSettings).toBe(true);
  });

  it('stores pendingRetry.mode from the original user message', () => {
    const { state, userMsgId } = stateWithUserMessage();

    const next = act(state, { type: 'retryMessage', userMessageId: userMsgId, useCurrentSettings: false });

    expect(next.pendingRetry?.mode).toBe('edit');
  });

  it('stores pendingRetry.model from the original user message', () => {
    const { state, userMsgId } = stateWithUserMessage();

    const next = act(state, { type: 'retryMessage', userMessageId: userMsgId, useCurrentSettings: false });

    expect(next.pendingRetry?.model).toBe('sonnet');
  });

  it('leaves state unchanged when userMessageId does not exist', () => {
    const { state } = stateWithUserMessage();

    const next = act(state, { type: 'retryMessage', userMessageId: 'nonexistent', useCurrentSettings: false });

    expect(next).toBe(state);
    expect(next.pendingRetry).toBeUndefined();
  });

  it('leaves state unchanged when active conversation has no matching message', () => {
    // Create two conversations; the second (newer) is active and has no messages
    let state = s();
    state = act(state, {
      type: 'sendUserMessage',
      prompt: 'hello',
      provider: 'claude',
      mode: 'ask',
      timestamp: 1000,
    });
    const conv1Id = state.activeConvId;
    const conv1 = state.conversations.find(c => c.id === conv1Id)!;
    const msgInConv1 = (conv1.messages[0] as UserMessage).id;

    // Create a new conversation (now active, empty)
    state = act(state, { type: 'newConversation' });

    // Try to retry the message from conv1 — the active conversation is now empty
    const next = act(state, { type: 'retryMessage', userMessageId: msgInConv1, useCurrentSettings: false });

    // Should not find the message in the NEW (empty) active conversation → state unchanged
    expect(next.pendingRetry).toBeUndefined();
  });
});

describe('clearPendingRetry reducer', () => {
  it('clears pendingRetry after it was set', () => {
    const { state, userMsgId } = stateWithUserMessage();

    let next = act(state, { type: 'retryMessage', userMessageId: userMsgId, useCurrentSettings: false });
    expect(next.pendingRetry).toBeDefined();

    next = act(next, { type: 'clearPendingRetry' });
    expect(next.pendingRetry).toBeUndefined();
  });

  it('is idempotent when pendingRetry is already undefined', () => {
    const state = s();
    expect(state.pendingRetry).toBeUndefined();

    const next = act(state, { type: 'clearPendingRetry' });
    expect(next.pendingRetry).toBeUndefined();
  });
});
