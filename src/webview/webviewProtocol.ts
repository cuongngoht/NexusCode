import { ProviderId, TaskMode, GitFileChange } from '../core/types';
import type { ProviderDetectionResult } from '../core/providerDetector';

export type { ProviderDetectionResult };

// Messages sent from the extension to the webview
export type ExtensionMessage =
  | { type: 'stdout'; chunk: string }
  | { type: 'stderr'; chunk: string }
  | { type: 'taskStarted'; taskId: string; provider: string; mode: string; model?: string }
  | { type: 'taskCompleted'; taskId: string; exitCode: number }
  | { type: 'taskStopped'; taskId: string }
  | { type: 'taskError'; taskId: string; message: string }
  | { type: 'gitStatus'; changes: GitFileChange[]; message?: string }
  | { type: 'availableProviders'; providers: string[]; detection: ProviderDetectionResult[] }
  | { type: 'stepStarted'; stepLabel: string; stepIndex: number; totalSteps: number; provider: string; mode: string; model?: string }
  | { type: 'stepCompleted'; stepLabel: string }
  | { type: 'stepError'; stepLabel: string; error: string };

// Messages sent from the webview to the extension
export type WebviewMessage =
  | { type: 'runTask'; prompt: string; provider: ProviderId; mode: TaskMode; model?: string }
  | { type: 'stopTask' }
  | { type: 'openSourceControl' }
  | { type: 'ready' };
