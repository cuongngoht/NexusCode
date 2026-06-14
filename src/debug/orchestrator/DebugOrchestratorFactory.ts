import type { IEventBus } from '../../core/events/IEventBus';
import type { RunAgentUseCase } from '../../application/usecases/RunAgentUseCase';
import { DebugOrchestrator } from './DebugOrchestrator';
import { DebugChain } from './DebugChain';
import { ParseDebugInputStep } from '../steps/ParseDebugInputStep';
import { ProjectProfileLoadStep } from '../steps/ProjectProfileLoadStep';
import { Bm25RetrievalStep } from '../steps/Bm25RetrievalStep';
import { StrategyRetrievalStep } from '../steps/StrategyRetrievalStep';
import { ToolSelectionStep } from '../steps/ToolSelectionStep';
import { ReActInvestigationStep } from '../steps/ReActInvestigationStep';
import { DebugPlanStep } from '../steps/DebugPlanStep';
import { ApprovalGateStep } from '../steps/ApprovalGateStep';
import { ApplyFixStep } from '../steps/ApplyFixStep';
import { VerificationStep } from '../steps/VerificationStep';
import { DebugSummaryStep } from '../steps/DebugSummaryStep';

export interface DebugOrchestratorDeps {
  eventBus: IEventBus;
  runUseCase?: RunAgentUseCase;
}

export function createDefaultDebugOrchestrator(deps: DebugOrchestratorDeps): DebugOrchestrator {
  return new DebugOrchestrator(
    new DebugChain([
      new ParseDebugInputStep(),
      new ProjectProfileLoadStep(),
      new Bm25RetrievalStep(),
      new StrategyRetrievalStep(),
      new ToolSelectionStep(),
      new ReActInvestigationStep(),
      new DebugPlanStep(),
      new ApprovalGateStep(),
      new ApplyFixStep(deps.runUseCase),
      new VerificationStep(),
      new DebugSummaryStep(),
    ]),
    deps.eventBus,
  );
}
