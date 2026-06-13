import { useEffect, useState } from 'react';
import type { NexusStreamEvent } from '../core/stream/NexusStreamEvent';

export interface TimelineStep {
  label: string;
  status: 'running' | 'done' | 'error';
  tools: Array<{ name: string; kind?: string; status: 'running' | 'done' | 'error' }>;
}

export interface StreamState {
  taskId: string | null;
  provider: string;
  mode: string;
  model?: string;
  phase: string;
  steps: TimelineStep[];
  assistantText: string;
  fileChanges: Array<{ path: string; changeType: 'modified' | 'added' | 'deleted' }>;
  errors: string[];
  warnings: string[];
  rawLog: string[];
  isRunning: boolean;
  isComplete: boolean;
  hasFailed: boolean;
  exitCode?: number;
}

const INITIAL_STATE: StreamState = {
  taskId: null,
  provider: '',
  mode: '',
  model: undefined,
  phase: '',
  steps: [],
  assistantText: '',
  fileChanges: [],
  errors: [],
  warnings: [],
  rawLog: [],
  isRunning: false,
  isComplete: false,
  hasFailed: false,
  exitCode: undefined,
};

function createInitialState(): StreamState {
  return { ...INITIAL_STATE };
}

export class StreamStore {
  private _state: StreamState = createInitialState();
  private _listeners = new Set<() => void>();
  // Stores diffs by path for later use
  private _diffs = new Map<string, string>();

  getState(): StreamState {
    return this._state;
  }

  getDiff(path: string): string | undefined {
    return this._diffs.get(path);
  }

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  private _notify(): void {
    this._listeners.forEach(l => l());
  }

  dispatch(event: NexusStreamEvent): void {
    const s = this._state;

    switch (event.kind) {
      case 'task.started': {
        this._diffs.clear();
        this._state = {
          ...createInitialState(),
          taskId: event.taskId,
          provider: event.provider,
          mode: event.mode,
          model: event.model,
          isRunning: true,
        };
        break;
      }

      case 'task.completed': {
        this._state = {
          ...s,
          isRunning: false,
          isComplete: true,
          exitCode: event.exitCode,
        };
        break;
      }

      case 'task.failed': {
        this._state = {
          ...s,
          isRunning: false,
          hasFailed: true,
          errors: [...s.errors, event.error],
        };
        break;
      }

      case 'step.started': {
        const newStep: TimelineStep = { label: event.label, status: 'running', tools: [] };
        this._state = {
          ...s,
          phase: event.label,
          steps: [...s.steps, newStep],
        };
        break;
      }

      case 'step.delta': {
        this._state = {
          ...s,
          assistantText: s.assistantText + event.text,
        };
        break;
      }

      case 'step.completed': {
        const updatedSteps = s.steps.map(step =>
          step.label === event.label && step.status === 'running'
            ? { ...step, status: 'done' as const }
            : step,
        );
        this._state = { ...s, steps: updatedSteps };
        break;
      }

      case 'tool.started': {
        const tool = { name: event.toolName, kind: event.toolKind, status: 'running' as const };
        // Add tool to the last running step; if none, create a synthetic step
        const steps = [...s.steps];
        const lastRunningIdx = steps.reduceRight((found, step, idx) =>
          found === -1 && step.status === 'running' ? idx : found, -1);
        if (lastRunningIdx !== -1) {
          steps[lastRunningIdx] = {
            ...steps[lastRunningIdx],
            tools: [...steps[lastRunningIdx].tools, tool],
          };
        }
        this._state = { ...s, phase: event.toolName, steps };
        break;
      }

      case 'tool.completed': {
        const steps = s.steps.map(step => {
          const toolIdx = step.tools.findLastIndex(t => t.name === event.toolName && t.status === 'running');
          if (toolIdx === -1) return step;
          const tools = [...step.tools];
          tools[toolIdx] = { ...tools[toolIdx], status: event.status };
          return { ...step, tools };
        });
        this._state = { ...s, steps };
        break;
      }

      case 'file.changed': {
        // Avoid duplicates for the same path+changeType
        const existing = s.fileChanges.find(
          fc => fc.path === event.path && fc.changeType === event.changeType,
        );
        if (!existing) {
          this._state = {
            ...s,
            fileChanges: [...s.fileChanges, { path: event.path, changeType: event.changeType }],
          };
        }
        break;
      }

      case 'diff.ready': {
        this._diffs.set(event.path, event.diff);
        // State doesn't change visually — the diff is available via getDiff()
        break;
      }

      case 'token.usage': {
        // Not tracked in StreamState for MVP
        break;
      }

      case 'provider.raw': {
        this._state = {
          ...s,
          rawLog: [...s.rawLog, event.chunk],
        };
        break;
      }

      case 'stream.warning': {
        this._state = {
          ...s,
          warnings: [...s.warnings, event.message],
        };
        break;
      }

      default: {
        // Exhaustive — do nothing for unhandled variants
        break;
      }
    }

    this._notify();
  }
}

// Module-level singleton
export const streamStore = new StreamStore();

// React hook — subscribes to the store and re-renders on changes
export function useStreamStore(): StreamState {
  const [state, setState] = useState<StreamState>(() => streamStore.getState());
  useEffect(() => {
    // Sync immediately in case store changed between render and effect
    setState(streamStore.getState());
    return streamStore.subscribe(() => setState(streamStore.getState()));
  }, []);
  return state;
}
