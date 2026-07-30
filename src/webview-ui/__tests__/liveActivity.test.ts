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

  it('appendOutputBatch records lastOutputElapsed (primary rAF path)', () => {
    let state = runningState();
    state = { ...state, elapsed: 9 };
    state = act(state, {
      type: 'appendOutputBatch',
      chunks: [{ type: 'stdout', chunk: 'batched line\n' }],
    });
    expect(lastAssistant(state)!.lastOutputElapsed).toBe(9);
    expect(lastAssistant(state)!.lines).toHaveLength(1);
  });

  it('activity attaches to a running pipeline step, not message-level', () => {
    let state = runningState();
    // stepIndex > 0 appends onto the existing taskStarted assistant message
    state = act(state, {
      type: 'extMsg',
      msg: {
        type: 'stepStarted',
        stepLabel: 'scan',
        stepIndex: 1,
        totalSteps: 2,
        provider: 'claude',
        mode: 'ask',
      },
    });
    state = act(state, {
      type: 'extMsg',
      msg: { type: 'activityStarted', activityKind: 'read', label: 'Reading map' },
    });

    const msg = lastAssistant(state)!;
    expect(msg.steps[msg.steps.length - 1].activities).toHaveLength(1);
    expect(msg.steps[msg.steps.length - 1].activities[0].label).toBe('Reading map');
    expect(msg.activities ?? []).toHaveLength(0);
  });

  it('activityDone with no prior start still records a completed message-level chip', () => {
    const state = act(runningState(), {
      type: 'extMsg',
      msg: { type: 'activityDone', activityKind: 'bash', label: 'npm test', status: 'done' },
    });
    const acts = lastAssistant(state)!.activities!;
    expect(acts).toHaveLength(1);
    expect(acts[0]).toMatchObject({ kind: 'bash', status: 'done', label: 'npm test' });
  });

  it('agentSessionUpdated projects live phase onto the streaming message', () => {
    let state = runningState();
    expect(lastAssistant(state)!.streamingStage).toBe('planning');

    state = act(state, {
      type: 'extMsg',
      msg: {
        type: 'agentSessionUpdated',
        session: {
          id: 'sess-1',
          status: 'executing',
          originalPrompt: 'do it',
          steps: [
            { id: 's1', type: 'plan', title: 'Plan', status: 'completed' },
            { id: 's2', type: 'edit', title: 'Apply edits', status: 'running' },
          ],
          createdAt: 1,
          updatedAt: 2,
        },
      },
    });

    const msg = lastAssistant(state)!;
    expect(msg.streamingStage).toBe('editing');
    expect(msg.streamingLabel).toBe('Apply edits');
  });

  it('completeRunningActivities marks message-level chips done on taskCompleted', () => {
    let state = runningState();
    state = act(state, {
      type: 'extMsg',
      msg: { type: 'activityStarted', activityKind: 'read', label: 'Reading' },
    });
    state = act(state, {
      type: 'extMsg',
      msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 },
    });
    expect(lastAssistant(state)!.activities![0].status).toBe('done');
    expect(lastAssistant(state)!.isStreaming).toBe(false);
  });
});
