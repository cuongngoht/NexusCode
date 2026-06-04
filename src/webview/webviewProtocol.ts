import { ProviderId, TaskMode, GitFileChange, GitReviewContext } from '../core/types';
import type { ProviderDetectionResult } from '../core/providerDetector';
import type { ChatHistoryState } from '../core/chat/ChatHistory';

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
  | { type: 'availableProviders'; providers: string[]; detection: ProviderDetectionResult[]; needsSetup: boolean; savedProvider?: string }
  | { type: 'stepStarted'; stepLabel: string; stepIndex: number; totalSteps: number; provider: string; mode: string; model?: string }
  | { type: 'stepCompleted'; stepLabel: string }
  | { type: 'stepError'; stepLabel: string; error: string }
  | { type: 'activityStarted'; activityKind: string; label: string }
  | { type: 'activityDone'; activityKind: string; label: string; status: 'done' | 'error' }
  | { type: 'historyLoaded'; history: ChatHistoryState }
  | { type: 'historyError'; message: string }
  | { type: 'reviewContext'; context: GitReviewContext }
  | { type: 'reviewContextError'; message: string };

// Messages sent from the webview to the extension
export type WebviewMessage =
  | { type: 'runTask'; prompt: string; provider: ProviderId; mode: TaskMode; model?: string; conversationId: string; baseBranch?: string }
  | { type: 'stopTask' }
  | { type: 'openSourceControl' }
  | { type: 'openSettings' }
  | { type: 'openAbout' }
  | { type: 'ready' }
  | { type: 'saveProvider'; provider: ProviderId }
  | { type: 'saveHistory'; history: ChatHistoryState }
  | { type: 'getReviewContext'; baseBranch?: string }
  | { type: 'openReviewAgentFile' };
