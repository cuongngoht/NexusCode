import { describe, it, expect } from 'vitest';
import { reducer, createInitialState } from '../messages';
import type { AppAction, AppState, AssistantMessage } from '../messages';

function s(): AppState { return createInitialState(); }
const act = (state: AppState, action: AppAction) => reducer(state, action);

/** Helper: create a running state with an assistant message ready to receive output. */
function runningState(): AppState {
  return act(s(), {
    type: 'extMsg',
    msg: { type: 'taskStarted', taskId: '1', provider: 'claude', mode: 'edit' },
  });
}

/** Helper: get the last assistant message from the active (or run) conversation. */
function lastAssistant(state: AppState): AssistantMessage | undefined {
  const convId = state.activeRunConversationId ?? state.activeConvId;
  const conv = state.conversations.find(c => c.id === convId);
  if (!conv) return undefined;
  const last = conv.messages[conv.messages.length - 1];
  return last?.role === 'assistant' ? (last as AssistantMessage) : undefined;
}

describe('appendOutputBatch', () => {
  it('appends multiple chunks in one state update when isRunning is true', () => {
    const state = runningState();

    const next = act(state, {
      type: 'appendOutputBatch',
      chunks: [
        { type: 'stdout', chunk: 'line1\nline2\n' },
        { type: 'stderr', chunk: 'warn1\n' },
        { type: 'stdout', chunk: 'line3\n' },
      ],
    });

    const msg = lastAssistant(next)!;
    expect(msg.lines).toHaveLength(4);
    expect(msg.lines[0]).toEqual({ kind: 'stdout', text: 'line1' });
    expect(msg.lines[1]).toEqual({ kind: 'stdout', text: 'line2' });
    expect(msg.lines[2]).toEqual({ kind: 'stderr', text: 'warn1' });
    expect(msg.lines[3]).toEqual({ kind: 'stdout', text: 'line3' });
  });

  it('is ignored (state unchanged) when isRunning is false', () => {
    const state = s(); // isRunning starts as false

    const next = act(state, {
      type: 'appendOutputBatch',
      chunks: [{ type: 'stdout', chunk: 'line1\n' }],
    });

    expect(next).toBe(state);
  });

  it('is ignored after taskCompleted sets isRunning to false', () => {
    let state = runningState();
    state = act(state, { type: 'extMsg', msg: { type: 'taskCompleted', taskId: '1', exitCode: 0 } });
    expect(state.isRunning).toBe(false);

    const next = act(state, {
      type: 'appendOutputBatch',
      chunks: [{ type: 'stdout', chunk: 'late output\n' }],
    });

    expect(next).toBe(state);
  });

  it('empty chunk list produces no change (returns same state reference when no lines added)', () => {
    const state = runningState();

    const next = act(state, {
      type: 'appendOutputBatch',
      chunks: [],
    });

    // No lines added — state reference should be unchanged
    expect(next).toBe(state);
  });

  it('whitespace-only chunks produce no output lines', () => {
    const state = runningState();

    const next = act(state, {
      type: 'appendOutputBatch',
      chunks: [{ type: 'stdout', chunk: '   \n\n  \n' }],
    });

    // All chunks filter out to empty after split+trim — no lines added
    expect(next).toBe(state);
  });

  it('correctly labels stdout and stderr lines', () => {
    const state = runningState();

    const next = act(state, {
      type: 'appendOutputBatch',
      chunks: [
        { type: 'stdout', chunk: 'normal output\n' },
        { type: 'stderr', chunk: 'error output\n' },
      ],
    });

    const msg = lastAssistant(next)!;
    expect(msg.lines[0].kind).toBe('stdout');
    expect(msg.lines[1].kind).toBe('stderr');
  });
});

describe('output truncation (MAX_LINES = 2000)', () => {
  it('does not truncate when lines are below MAX_LINES', () => {
    const state = runningState();
    // 100 lines — well below the 2000 limit
    const chunk = Array.from({ length: 100 }, (_, i) => `line${i}`).join('\n');

    const next = act(state, {
      type: 'appendOutputBatch',
      chunks: [{ type: 'stdout', chunk }],
    });

    const msg = lastAssistant(next)!;
    expect(msg.lines).toHaveLength(100);
    expect(msg.lines[0].text).toBe('line0');
  });

  it('truncates output to 1901 lines (1 marker + 1900 recent) when exceeding 2000', () => {
    const state = runningState();
    // 2001 lines
    const chunk = Array.from({ length: 2001 }, (_, i) => `line${i}`).join('\n');

    const next = act(state, {
      type: 'appendOutputBatch',
      chunks: [{ type: 'stdout', chunk }],
    });

    const msg = lastAssistant(next)!;
    // 1 marker + 1900 kept = 1901
    expect(msg.lines).toHaveLength(1901);
  });

  it('truncation marker is at index 0 and contains the hidden line count', () => {
    const state = runningState();
    // 2001 lines: 2001 - 1900 = 101 dropped
    const chunk = Array.from({ length: 2001 }, (_, i) => `line${i}`).join('\n');

    const next = act(state, {
      type: 'appendOutputBatch',
      chunks: [{ type: 'stdout', chunk }],
    });

    const msg = lastAssistant(next)!;
    expect(msg.lines[0].kind).toBe('stdout');
    expect(msg.lines[0].text).toContain('101');
    expect(msg.lines[0].text).toContain('earlier lines hidden');
  });

  it('preserves the most recent TRUNCATE_TO (1900) lines after truncation', () => {
    const state = runningState();
    // 2001 lines: last line index = 2000 → text = 'line2000'
    const chunk = Array.from({ length: 2001 }, (_, i) => `line${i}`).join('\n');

    const next = act(state, {
      type: 'appendOutputBatch',
      chunks: [{ type: 'stdout', chunk }],
    });

    const msg = lastAssistant(next)!;
    // After marker at [0], lines [1..1900] are the last 1900 lines
    // Last line in input = 'line2000' (index 2000)
    // First kept line = index 2001 - 1900 = 101 → 'line101'
    expect(msg.lines[1].text).toBe('line101');
    expect(msg.lines[1900].text).toBe('line2000');
  });

  it('truncates via stdout extMsg as well (same truncateLines function)', () => {
    // Verify that regular stdout events (not just appendOutputBatch) also truncate
    let state = runningState();
    // Add 1999 lines first via batch
    const firstChunk = Array.from({ length: 1999 }, (_, i) => `line${i}`).join('\n');
    state = act(state, {
      type: 'appendOutputBatch',
      chunks: [{ type: 'stdout', chunk: firstChunk }],
    });

    // Add 2 more via a regular stdout event (total 2001 → triggers truncation)
    state = act(state, {
      type: 'extMsg',
      msg: { type: 'stdout', chunk: 'extra1\nextra2\n' },
    });

    const msg = lastAssistant(state)!;
    // 1999 + 2 = 2001 → truncated to 1901
    expect(msg.lines).toHaveLength(1901);
    expect(msg.lines[0].text).toContain('101');
  });
});
