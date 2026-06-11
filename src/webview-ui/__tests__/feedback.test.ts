import { describe, it, expect } from 'vitest';
import { reducer, createInitialState } from '../messages';
import type { AppAction, AppState, AssistantMessage } from '../messages';

function s(): AppState { return createInitialState(); }
const act = (state: AppState, action: AppAction) => reducer(state, action);

/** Helper: start a task and get the assistant message created in the active conversation. */
function stateWithAssistantMessage(): { state: AppState; convId: string; msgId: string } {
  let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' } });
  state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });
  const convId = state.activeConvId;
  const conv = state.conversations.find(c => c.id === convId)!;
  const assistantMsg = conv.messages[conv.messages.length - 1] as AssistantMessage;
  return { state, convId, msgId: assistantMsg.id };
}

describe('setFeedback reducer', () => {
  it('sets good feedback on a completed assistant message', () => {
    const { state, convId, msgId } = stateWithAssistantMessage();

    const next = act(state, { type: 'setFeedback', conversationId: convId, messageId: msgId, rating: 'good' });

    const conv = next.conversations.find(c => c.id === convId)!;
    const msg = conv.messages.find(m => m.id === msgId) as AssistantMessage;
    expect(msg.feedback?.rating).toBe('good');
    expect(msg.feedback?.ratedAt).toBeGreaterThan(0);
  });

  it('sets bad feedback on a completed assistant message', () => {
    const { state, convId, msgId } = stateWithAssistantMessage();

    const next = act(state, { type: 'setFeedback', conversationId: convId, messageId: msgId, rating: 'bad' });

    const conv = next.conversations.find(c => c.id === convId)!;
    const msg = conv.messages.find(m => m.id === msgId) as AssistantMessage;
    expect(msg.feedback?.rating).toBe('bad');
  });

  it('toggles from good to null', () => {
    const { state, convId, msgId } = stateWithAssistantMessage();

    let next = act(state, { type: 'setFeedback', conversationId: convId, messageId: msgId, rating: 'good' });
    next = act(next, { type: 'setFeedback', conversationId: convId, messageId: msgId, rating: null });

    const conv = next.conversations.find(c => c.id === convId)!;
    const msg = conv.messages.find(m => m.id === msgId) as AssistantMessage;
    expect(msg.feedback?.rating).toBeNull();
  });

  it('increments saveKey when feedback changes', () => {
    const { state, convId, msgId } = stateWithAssistantMessage();
    const beforeKey = state.saveKey;

    const next = act(state, { type: 'setFeedback', conversationId: convId, messageId: msgId, rating: 'good' });

    expect(next.saveKey).toBe(beforeKey + 1);
  });

  it('does not change state when messageId does not exist', () => {
    const { state, convId } = stateWithAssistantMessage();

    const next = act(state, { type: 'setFeedback', conversationId: convId, messageId: 'nonexistent-id', rating: 'good' });

    expect(next).toBe(state);
  });

  it('does not change state when conversationId does not exist', () => {
    const { state, msgId } = stateWithAssistantMessage();

    const next = act(state, { type: 'setFeedback', conversationId: 'nonexistent-conv', messageId: msgId, rating: 'good' });

    // No changes because the conversation was not found (changed flag stays false)
    expect(next).toBe(state);
  });

  it('does not apply feedback to a user message', () => {
    let state = act(s(), {
      type: 'sendUserMessage',
      prompt: 'hello',
      provider: 'claude',
      mode: 'ask',
      timestamp: 1000,
    });
    const convId = state.activeConvId;
    const conv = state.conversations.find(c => c.id === convId)!;
    const userMsgId = conv.messages[0].id;

    state = act(state, { type: 'setFeedback', conversationId: convId, messageId: userMsgId, rating: 'good' });

    // User messages don't have role 'assistant', so the setFeedback is a no-op
    const userMsg = state.conversations.find(c => c.id === convId)!.messages[0];
    expect(userMsg.role).toBe('user');
    expect((userMsg as never as AssistantMessage).feedback).toBeUndefined();
  });

  it('feedback persists across multiple setFeedback calls on different messages', () => {
    // Start two tasks to get two assistant messages
    let state = act(s(), { type: 'extMsg', msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskStarted', taskId: '2', provider: 'claude', mode: 'ask' } });
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '2', exitCode: 0 } });

    const convId = state.activeConvId;
    const conv = state.conversations.find(c => c.id === convId)!;
    const [msg1, msg2] = conv.messages as AssistantMessage[];

    state = act(state, { type: 'setFeedback', conversationId: convId, messageId: msg1.id, rating: 'good' });
    state = act(state, { type: 'setFeedback', conversationId: convId, messageId: msg2.id, rating: 'bad' });

    const updatedConv = state.conversations.find(c => c.id === convId)!;
    const [updated1, updated2] = updatedConv.messages as AssistantMessage[];
    expect(updated1.feedback?.rating).toBe('good');
    expect(updated2.feedback?.rating).toBe('bad');
  });
});
