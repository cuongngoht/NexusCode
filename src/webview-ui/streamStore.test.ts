import { describe, expect, it, beforeEach, vi } from 'vitest';
import { StreamStore } from './streamStore';
import type { NexusStreamEvent } from '../core/stream/NexusStreamEvent';

const BASE = {
  timestamp: Date.now(),
  provider: 'claude',
  mode: 'edit',
  model: 'claude-3-5-sonnet',
};

function makeEvent<T extends NexusStreamEvent>(event: T): T {
  return event;
}

describe('StreamStore', () => {
  let store: StreamStore;

  beforeEach(() => {
    store = new StreamStore();
  });

  describe('task.started', () => {
    it('resets state and sets isRunning', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      const state = store.getState();
      expect(state.taskId).toBe('t1');
      expect(state.provider).toBe('claude');
      expect(state.mode).toBe('edit');
      expect(state.model).toBe('claude-3-5-sonnet');
      expect(state.isRunning).toBe(true);
      expect(state.isComplete).toBe(false);
      expect(state.hasFailed).toBe(false);
      expect(state.assistantText).toBe('');
      expect(state.steps).toHaveLength(0);
    });

    it('clears previous state on new task', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      store.dispatch(makeEvent({ kind: 'step.delta', taskId: 't1', ...BASE, text: 'hello' }));
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't2', ...BASE }));
      expect(store.getState().assistantText).toBe('');
      expect(store.getState().taskId).toBe('t2');
    });
  });

  describe('task.completed', () => {
    it('sets isComplete and exitCode', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      store.dispatch(makeEvent({ kind: 'task.completed', taskId: 't1', ...BASE, exitCode: 0 }));
      const state = store.getState();
      expect(state.isRunning).toBe(false);
      expect(state.isComplete).toBe(true);
      expect(state.exitCode).toBe(0);
    });
  });

  describe('task.failed', () => {
    it('sets hasFailed and pushes error', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      store.dispatch(makeEvent({ kind: 'task.failed', taskId: 't1', ...BASE, error: 'timeout' }));
      const state = store.getState();
      expect(state.isRunning).toBe(false);
      expect(state.hasFailed).toBe(true);
      expect(state.errors).toContain('timeout');
    });
  });

  describe('step.delta', () => {
    it('accumulates assistantText', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      store.dispatch(makeEvent({ kind: 'step.delta', taskId: 't1', ...BASE, text: 'Hello' }));
      store.dispatch(makeEvent({ kind: 'step.delta', taskId: 't1', ...BASE, text: ' world' }));
      expect(store.getState().assistantText).toBe('Hello world');
    });
  });

  describe('step.started / step.completed', () => {
    it('adds a running step', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      store.dispatch(makeEvent({ kind: 'step.started', taskId: 't1', ...BASE, label: 'scan', index: 0, total: 2 }));
      const { steps, phase } = store.getState();
      expect(steps).toHaveLength(1);
      expect(steps[0].label).toBe('scan');
      expect(steps[0].status).toBe('running');
      expect(phase).toBe('scan');
    });

    it('marks step as done', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      store.dispatch(makeEvent({ kind: 'step.started', taskId: 't1', ...BASE, label: 'scan', index: 0, total: 1 }));
      store.dispatch(makeEvent({ kind: 'step.completed', taskId: 't1', ...BASE, label: 'scan' }));
      const { steps } = store.getState();
      expect(steps[0].status).toBe('done');
    });
  });

  describe('tool.started / tool.completed', () => {
    it('adds a running tool to the last running step', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      store.dispatch(makeEvent({ kind: 'step.started', taskId: 't1', ...BASE, label: 'analyze', index: 0, total: 1 }));
      store.dispatch(makeEvent({ kind: 'tool.started', taskId: 't1', ...BASE, toolName: 'read_file', toolKind: 'read' }));
      const { steps } = store.getState();
      expect(steps[0].tools).toHaveLength(1);
      expect(steps[0].tools[0]).toMatchObject({ name: 'read_file', kind: 'read', status: 'running' });
    });

    it('marks tool as done', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      store.dispatch(makeEvent({ kind: 'step.started', taskId: 't1', ...BASE, label: 'analyze', index: 0, total: 1 }));
      store.dispatch(makeEvent({ kind: 'tool.started', taskId: 't1', ...BASE, toolName: 'read_file', toolKind: 'read' }));
      store.dispatch(makeEvent({ kind: 'tool.completed', taskId: 't1', ...BASE, toolName: 'read_file', status: 'done' }));
      const { steps } = store.getState();
      expect(steps[0].tools[0].status).toBe('done');
    });

    it('marks tool as error', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      store.dispatch(makeEvent({ kind: 'step.started', taskId: 't1', ...BASE, label: 'analyze', index: 0, total: 1 }));
      store.dispatch(makeEvent({ kind: 'tool.started', taskId: 't1', ...BASE, toolName: 'bash_exec', toolKind: 'bash' }));
      store.dispatch(makeEvent({ kind: 'tool.completed', taskId: 't1', ...BASE, toolName: 'bash_exec', status: 'error' }));
      const { steps } = store.getState();
      expect(steps[0].tools[0].status).toBe('error');
    });
  });

  describe('file.changed', () => {
    it('appends fileChanges', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      store.dispatch(makeEvent({ kind: 'file.changed', taskId: 't1', ...BASE, path: 'src/index.ts', changeType: 'modified' }));
      store.dispatch(makeEvent({ kind: 'file.changed', taskId: 't1', ...BASE, path: 'src/new.ts', changeType: 'added' }));
      const { fileChanges } = store.getState();
      expect(fileChanges).toHaveLength(2);
      expect(fileChanges[0]).toMatchObject({ path: 'src/index.ts', changeType: 'modified' });
      expect(fileChanges[1]).toMatchObject({ path: 'src/new.ts', changeType: 'added' });
    });

    it('does not duplicate the same path+changeType', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      store.dispatch(makeEvent({ kind: 'file.changed', taskId: 't1', ...BASE, path: 'src/index.ts', changeType: 'modified' }));
      store.dispatch(makeEvent({ kind: 'file.changed', taskId: 't1', ...BASE, path: 'src/index.ts', changeType: 'modified' }));
      expect(store.getState().fileChanges).toHaveLength(1);
    });
  });

  describe('provider.raw', () => {
    it('appends raw chunks to rawLog', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      store.dispatch(makeEvent({ kind: 'provider.raw', taskId: 't1', ...BASE, chunk: 'chunk1\n', stream: 'stdout' }));
      store.dispatch(makeEvent({ kind: 'provider.raw', taskId: 't1', ...BASE, chunk: 'chunk2\n', stream: 'stdout' }));
      expect(store.getState().rawLog).toEqual(['chunk1\n', 'chunk2\n']);
    });
  });

  describe('stream.warning', () => {
    it('appends to warnings', () => {
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      store.dispatch(makeEvent({ kind: 'stream.warning', taskId: 't1', ...BASE, message: 'rate limited' }));
      expect(store.getState().warnings).toContain('rate limited');
    });
  });

  describe('subscribe / unsubscribe', () => {
    it('calls listener on dispatch', () => {
      const listener = vi.fn();
      store.subscribe(listener);
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('returns an unsubscribe function that removes the listener', () => {
      const listener = vi.fn();
      const unsub = store.subscribe(listener);
      unsub();
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      expect(listener).not.toHaveBeenCalled();
    });

    it('calls multiple listeners', () => {
      const l1 = vi.fn();
      const l2 = vi.fn();
      store.subscribe(l1);
      store.subscribe(l2);
      store.dispatch(makeEvent({ kind: 'task.started', taskId: 't1', ...BASE }));
      expect(l1).toHaveBeenCalledTimes(1);
      expect(l2).toHaveBeenCalledTimes(1);
    });
  });
});
