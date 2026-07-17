import { describe, it, expect } from 'vitest';
import { reducer, createInitialState } from '../messages';
import type { AppAction, AppState, AssistantMessage } from '../messages';

function s(): AppState { return createInitialState(); }
const act = (state: AppState, action: AppAction) => reducer(state, action);

/** Running state with an assistant message but NO pipeline steps (single-shot / agent run). */
function runningState(): AppState {
  return act(s(), {
    type: 'extMsg',
    msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'ask' },
  });
}

function lastAssistant(state: AppState): AssistantMessage | undefined {
  const convId = state.activeRunConversationId ?? state.activeConvId;
  const conv = state.conversations.find(c => c.id === convId);
  const last = conv?.messages[conv.messages.length - 1];
  return last?.role === 'assistant' ? (last as AssistantMessage) : undefined;
}

describe('live activity fallback (no running pipeline step)', () => {
  it('activityStarted populates the message-level activities array', () => {
    const state = runningState();
    expect(lastAssistant(state)!.steps).toHaveLength(0);

    const next = act(state, {
      type: 'extMsg',
      msg: { type: 'activityStarted', activityKind: 'read', label: 'Reading foo.ts' },
    });

    const msg = lastAssistant(next)!;
    expect(msg.activities).toBeDefined();
    expect(msg.activities).toHaveLength(1);
    expect(msg.activities![0]).toMatchObject({ kind: 'read', status: 'running', label: 'Reading foo.ts' });
  });

  it('activityDone resolves the matching running message-level activity', () => {
    let state = runningState();
    state = act(state, {
      type: 'extMsg',
      msg: { type: 'activityStarted', activityKind: 'edit', label: 'Editing bar.ts' },
    });
    state = act(state, {
      type: 'extMsg',
      msg: { type: 'activityDone', activityKind: 'edit', label: 'Editing bar.ts', status: 'done' },
    });

    const acts = lastAssistant(state)!.activities!;
    expect(acts).toHaveLength(1);
    expect(acts[0].status).toBe('done');
  });

  it('updates lastOutputElapsed so the heartbeat knows when output last moved', () => {
    let state = runningState();
    state = { ...state, elapsed: 7 };
    state = act(state, {
      type: 'extMsg',
      msg: { type: 'activityStarted', activityKind: 'search', label: 'Searching' },
    });
    expect(lastAssistant(state)!.lastOutputElapsed).toBe(7);
  });

  it('stdout records lastOutputElapsed', () => {
    let state = runningState();
    state = { ...state, elapsed: 4 };
    state = act(state, { type: 'extMsg', msg: { type: 'stdout', chunk: 'hello\n' } });
    expect(lastAssistant(state)!.lastOutputElapsed).toBe(4);
  });

  it('tick advances elapsed on the streaming message while running', () => {
    const state = runningState();
    expect(lastAssistant(state)!.elapsed).toBeUndefined();
    const next = act(state, { type: 'tick' });
    expect(next.elapsed).toBe(1);
    expect(lastAssistant(next)!.elapsed).toBe(1);
  });
});
