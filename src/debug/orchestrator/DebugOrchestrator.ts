import type { IEventBus } from '../../core/events/IEventBus';
import type { DebugChain } from './DebugChain';
import type { DebugChainContext } from './DebugChainContext';
import type { ProviderId, TaskMode } from '../../core/types';
import { hasNoEditFlag } from '../DebugInputParser';

export interface DebugOrchestratorInput {
  workspaceRoot: string;
  originalPrompt: string;
  enhancedPrompt?: string;
  providerId: string;
  mode: string;
  model?: string;
  autoApprove?: boolean;
  taskId?: string;
  maxBm25Results?: number;
  maxInvestigationRounds?: number;
  maxFileBytes?: number;
  addRegressionTest?: boolean;
  rerunAfterFix?: boolean;
  bm25Enabled?: boolean;
  reactEnabled?: boolean;
}

export class DebugOrchestrator {
  private activeCtx: DebugChainContext | null = null;

  constructor(
    private readonly chain: DebugChain,
    private readonly eventBus: IEventBus,
  ) {}

  async run(input: DebugOrchestratorInput): Promise<void> {
    const ctx = this.createContext(input);
    this.activeCtx = ctx;
    try {
      await this.chain.run(ctx);
    } finally {
      this.activeCtx = null;
    }
  }

  async stop(): Promise<void> {
    if (this.activeCtx) {
      this.activeCtx.cancelled = true;
    }
    // Best-effort: long-running sync operations (spawnSync, fs reads) inside
    // ReAct/BM25/Verify will finish their current op; subsequent steps/rounds
    // will see the flag and early-exit. No zombie processes are left because
    // we use spawnSync (which blocks until done or its internal timeout).
  }

  private createContext(input: DebugOrchestratorInput): DebugChainContext {
    const noEdit = hasNoEditFlag(input.originalPrompt);

    return {
      workspaceRoot: input.workspaceRoot,
      originalPrompt: input.originalPrompt,
      enhancedPrompt: input.enhancedPrompt,
      providerId: (input.providerId as ProviderId) ?? 'nexus',
      mode: (input.mode as TaskMode) ?? 'debug',
      model: input.model,
      eventBus: this.eventBus,
      state: 'idle',
      projectExcludeFromIndex: [],
      selectedFiles: [],
      bm25Results: [],
      strategyResults: [],
      toolResults: [],
      evidence: [],
      suspectedTools: [],
      packageManager: null,
      packageScripts: {},
      gitChangedFiles: [],
      noEdit,
      addRegressionTest: input.addRegressionTest ?? true,
      rerunAfterFix: input.rerunAfterFix ?? true,
      autoApprove: input.autoApprove ?? false,
      approved: false,
      maxBm25Results: input.maxBm25Results ?? 12,
      maxInvestigationRounds: input.maxInvestigationRounds ?? 4,
      maxFileBytes: input.maxFileBytes ?? 200_000,
      taskId: input.taskId,
      cancelled: false,
      bm25Enabled: input.bm25Enabled ?? true,
      reactEnabled: input.reactEnabled ?? true,
    };
  }
}
