import type { DebugChainContext } from './DebugChainContext';

export type DebugStepStatus =
  | 'continue'
  | 'stop'
  | 'error'
  | 'await-approval';

export interface DebugStepResult {
  status: DebugStepStatus;
  message?: string;
}

export interface DebugStep {
  readonly name: string;
  run(ctx: DebugChainContext): Promise<DebugStepResult>;
}
