import type { TaskMode, ProviderId } from '../../core/types';
import type { IEventBus } from '../../core/events/IEventBus';
import type { DebugSignal } from '../DebugContext';
import type { DebugState } from './DebugState';
import type { DebugSearchResult } from '../search/DebugSearchResult';
import type { DetectedLanguage } from '../language/LanguageDetector';

export interface DebugPlan {
  rootCause: string;
  confidence: number;
  evidence: string[];
  candidateFiles: string[];
  filesLikelyToChange: string[];
  minimalFix: string;
  regressionTest: string;
  verificationCommand?: string;
  risk: 'low' | 'medium' | 'high';
  rawMarkdown: string;
}

export interface DebugChainContext {
  workspaceRoot: string;
  originalPrompt: string;
  enhancedPrompt?: string;
  providerId: ProviderId;
  mode: TaskMode;
  model?: string;
  eventBus: IEventBus;
  state: DebugState;
  projectProfileMarkdown?: string;
  projectScanJson?: unknown;
  projectExcludeFromIndex: string[];
  signal?: DebugSignal;
  selectedFiles: string[];
  bm25Results: DebugSearchResult[];
  strategyResults: DebugSearchResult[];
  toolResults: DebugSearchResult[];
  evidence: string[];
  suspectedTools: string[];
  selectedTool?: string;
  failingCommand?: string;
  verificationCommand?: string;
  packageManager: string | null;
  packageScripts: Record<string, string>;
  gitChangedFiles: string[];
  noEdit: boolean;
  addRegressionTest: boolean;
  rerunAfterFix: boolean;
  autoApprove: boolean;
  approved: boolean;
  maxBm25Results: number;
  maxInvestigationRounds: number;
  maxFileBytes: number;
  plan?: DebugPlan;
  taskId?: string;
  /** Detected primary language of the error / project. */
  detectedLanguage?: DetectedLanguage;
  /** Detected primary framework (e.g. 'react', 'django', 'spring', 'rails'). */
  detectedFramework?: string;
  /** Best-effort cancellation flag. Set by DebugOrchestrator.stop(). */
  cancelled?: boolean;
  /** Feature flags from config (control heavy steps). */
  bm25Enabled?: boolean;
  reactEnabled?: boolean;
  /** Populated by DebugChain during execution for accurate step progress in UI. */
  currentStepIndex?: number;
  totalDebugSteps?: number;
}
