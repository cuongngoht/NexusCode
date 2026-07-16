# Architecture Memory

Generated: 2026-07-16T10:51:22.691Z
Workspace: /Users/cuongngoht/Repo/NexusCode
Detected style: Clean architecture (heuristic)

## Layer Mapping

| Layer | Paths |
|-------|-------|
| interface | media/review, media/webview, src/cli, src/review, src/settings, src/webview, src/cli, src/review, src/settings, src/webview, src/webview/handlers |
| infrastructure | src/analytics, src/context, src/git, src/infrastructure, src/mcp, src/providers, src/runner, src/analytics, src/context, src/core/runner, src/debug/adapters, src/git, src/infrastructure, src/mcp, src/mcp/adapters, src/providers, src/runner |
| application | src/application, src/application, src/application/usecases |
| support | src/config, src/config |
| core | src/core, src/core |

## Layer Summary

| Layer | Files |
|-------|-------|
| core | 28 |
| application | 102 |
| infrastructure | 160 |
| interface | 51 |
| support | 3 |
| unknown | 172 |

## Dependency Violations (46 errors, 0 warnings)

### Errors (46)

- `src/application/code-review/materializeReviewOutput.ts` → `src/infrastructure/stream/LineDecoder.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/code-review/materializeReviewOutput.ts` → `src/providers/grok/GrokStreamAdapter.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/pipeline/ArchitectureMemoryStep.ts` → `src/context/architecture-memory/index.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/pipeline/ArchitectureMemoryStep.ts` → `src/context/architecture-memory/search/ArchitectureRagFacade.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/pipeline/FileIntelligenceContextStep.ts` → `src/context/file-intelligence/FileIntelligenceStore.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/pipeline/FileIntelligenceContextStep.ts` → `src/context/file-intelligence/FileIntelligenceIgnoreFilter.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/pipeline/FileIntelligenceContextStep.ts` → `src/context/file-intelligence/FileIntelligenceContextSelector.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/pipeline/FileIntelligenceContextStep.ts` → `src/context/file-intelligence/FileIntelligenceContextBuilder.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/pipeline/FileIntelligenceContextStep.ts` → `src/context/file-intelligence/FileIntelligenceRagFacade.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/pipeline/createPreSteps.ts` → `src/context/file-intelligence/FileIntelligenceStore.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/pipeline/createPreSteps.ts` → `src/context/file-intelligence/FileIntelligenceIgnoreFilter.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/pipeline/review/ReviewFileContextStep.ts` → `src/git/gitBranch.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/prompt/PromptSourceResolver.ts` → `src/context/commandPromptLibrary.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/prompt/PromptSourceResolver.ts` → `src/context/skillPromptLibrary.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/prompt/PromptSourceResolver.ts` → `src/context/agentPromptLibrary.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/stream/AgentStreamPipelineFactory.ts` → `src/infrastructure/stream/SseDecoder.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/stream/AgentStreamPipelineFactory.ts` → `src/infrastructure/stream/LineDecoder.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/stream/AgentStreamPipelineFactory.ts` → `src/infrastructure/stream/PlainTextDecoder.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/stream/AgentStreamPipelineFactory.ts` → `src/providers/codex/CodexSseAdapter.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/stream/AgentStreamPipelineFactory.ts` → `src/providers/codex/CodexJsonlAdapter.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/stream/AgentStreamPipelineFactory.ts` → `src/providers/grok/GrokJsonLineDecoder.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/stream/AgentStreamPipelineFactory.ts` → `src/providers/grok/GrokEventAdapter.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/stream/AgentStreamPipelineFactory.ts` → `src/providers/antigravity/AntigravityStreamAdapter.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/stream/AgentStreamPipelineFactory.ts` → `src/providers/base/WrappedParserAdapter.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/stream/AgentStreamPipelineFactory.ts` → `src/providers/claude/ClaudeOutputParser.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/stream/AgentStreamPipelineFactory.ts` → `src/providers/aider/AiderOutputParser.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/stream/AgentStreamPipelineFactory.ts` → `src/providers/copilot/CopilotOutputParser.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/subagents/SubagentExecutor.ts` → `src/core/runner/IProcessRunner.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/BuildArchitectureMemoryUseCase.ts` → `src/context/architecture-memory/index.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/BuildArchitectureMemoryUseCase.ts` → `src/context/architecture-memory/ArchitectureStyleDetector.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/BuildProjectMapUseCase.ts` → `src/context/project-map/NexusFileTreeScanner.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/BuildProjectMapUseCase.ts` → `src/context/project-map/NexusMarkerDetector.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/BuildProjectMapUseCase.ts` → `src/context/project-map/NexusProjectUnitDetector.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/BuildProjectMapUseCase.ts` → `src/context/project-map/NexusProjectMapBuilder.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/BuildProjectMapUseCase.ts` → `src/context/project-map/NexusProjectMapWriter.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/BuildProjectMapUseCase.ts` → `src/context/project-map/types.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/BuildProjectMapUseCase.ts` → `src/context/project-memory/index.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/RunAgentUseCase.ts` → `src/core/runner/IProcessRunner.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/RunAgentUseCase.ts` → `src/mcp/McpToolUseCase.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/SummarizeProjectMapUseCase.ts` → `src/context/project-map/summary/types.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/SummarizeProjectMapUseCase.ts` → `src/context/project-map/summary/ProjectMapSummaryPromptBuilder.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/SummarizeProjectMapUseCase.ts` → `src/infrastructure/ai/ProjectMapAiRunner.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/SummarizeProjectMapUseCase.ts` → `src/context/project-map/summary/AiJsonExtractor.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/SummarizeProjectMapUseCase.ts` → `src/context/project-map/summary/ProjectMapSummaryValidator.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/SummarizeProjectMapUseCase.ts` → `src/context/project-map/summary/ProjectMapMarkdownRenderer.ts` (application → infrastructure)
  _application must not import from infrastructure_
- `src/application/usecases/SummarizeProjectMapUseCase.ts` → `src/context/project-map/summary/ProjectMapSummaryWriter.ts` (application → infrastructure)
  _application must not import from infrastructure_

## Design Patterns Detected

### Adapter (13 files)
- src/application/stream/AgentStreamPipelineFactory.ts
- src/core/stream/IProviderStreamAdapter.ts
- src/debug/adapters/DebugSearchAdapter.ts
- src/debug/adapters/InternalWorkspaceSearchAdapter.ts
- src/mcp/adapters/IMcpClientAdapter.ts
- src/mcp/adapters/StdioMcpClientAdapter.ts
- src/mcp/adapters/StreamableHttpMcpClientAdapter.ts
- src/providers/antigravity/AntigravityStreamAdapter.ts
- src/providers/base/WrappedParserAdapter.ts
- src/providers/codex/CodexJsonlAdapter.ts
- src/providers/codex/CodexSseAdapter.ts
- src/providers/grok/GrokEventAdapter.ts
- src/providers/grok/GrokStreamAdapter.ts

### Builder (18 files)
- src/application/code-review/CodeReviewContextBuilder.ts
- src/application/code-review/CodeReviewPromptBuilder.ts
- src/application/subagents/SubagentContextBuilder.ts
- src/context/architecture-memory/ArchitectureMemoryBuilder.ts
- src/context/architecture-memory/ArchitecturePromptBuilder.ts
- src/context/architecture-memory/DependencyGraphBuilder.ts
- src/context/architecture-memory/search/ArchitectureIndexBuilder.ts
- src/context/file-intelligence/FileIntelligenceContextBuilder.ts
- src/context/history-search/index/HistoryIndexBuilder.ts
- src/context/history-search/rag/RagContextBuilder.ts
- src/context/project-map/NexusProjectMapBuilder.ts
- src/context/project-map/summary/ProjectMapSummaryPromptBuilder.ts
- src/context/project-memory/search/ProjectMemoryIndexBuilder.ts
- src/context/promptAugmentationBuilder.ts
- src/context/promptBuilder.ts
- src/context/research/researchPromptBuilder.ts
- src/debug/react/ReActPromptBuilder.ts
- src/debug/search/DebugQueryBuilder.ts

### Controller (2 files)
- src/auto-review/AutoReviewController.ts
- src/webview/ChatController.ts

### Factory (3 files)
- src/application/code-review/synthesis/ReviewDimensionFactory.ts
- src/application/stream/AgentStreamPipelineFactory.ts
- src/debug/orchestrator/DebugOrchestratorFactory.ts

### Handler (19 files)
- src/webview/handlers/AgentPromptHandler.ts
- src/webview/handlers/AnalyticsHandler.ts
- src/webview/handlers/ArtifactHandler.ts
- src/webview/handlers/AttachmentHandler.ts
- src/webview/handlers/CodeBlockHandler.ts
- src/webview/handlers/CodeReviewCommandHandler.ts
- src/webview/handlers/CommandPromptHandler.ts
- src/webview/handlers/CompactCommandHandler.ts
- src/webview/handlers/DiffHandler.ts
- src/webview/handlers/HistoryHandler.ts
- src/webview/handlers/HistorySearchHandler.ts
- src/webview/handlers/LoginHandler.ts
- src/webview/handlers/NavigationHandler.ts
- src/webview/handlers/ProjectMemoryHandler.ts
- src/webview/handlers/ProviderHandler.ts
- src/webview/handlers/ResearchCommandHandler.ts
- src/webview/handlers/ReviewHandler.ts
- src/webview/handlers/RunTaskHandler.ts
- src/webview/handlers/SkillPromptHandler.ts

### Loader (6 files)
- src/context/architecture-memory/ArchitectureConfigLoader.ts
- src/context/architecture-memory/ArchitectureMemoryLoader.ts
- src/context/planLoader.ts
- src/context/research/researchFolderLoader.ts
- src/context/research/researchOrchestratorLoader.ts
- src/context/rulesLoader.ts

### Orchestrator (5 files)
- src/application/nexus/NexusOrchestrator.ts
- src/application/subagents/SubagentOrchestrator.ts
- src/context/project-map/NexusDiscoveryOrchestrator.ts
- src/debug/orchestrator/DebugOrchestrator.ts
- src/webview/handlers/ChatReviewOrchestrator.ts

### Pipeline (1 file)
- src/application/stream/AgentStreamPipeline.ts

### Policy (13 files)
- src/application/agent-mode/AgentModePolicy.ts
- src/application/code-review/CodeReviewArchitecturePolicy.ts
- src/application/code-review/CodeReviewPolicy.ts
- src/application/nexus/ModeCapabilityPolicy.ts
- src/application/nexus/NexusRoutingPolicy.ts
- src/application/permissions/PermissionPolicy.ts
- src/application/routing/FallbackPolicy.ts
- src/application/subagents/SubagentPresetPolicy.ts
- src/context/file-intelligence/FileIntelligenceFreshnessPolicy.ts
- src/context/file-intelligence/FileIntelligenceMergePolicy.ts
- src/debug/tools/SafeCommandPolicy.ts
- src/mcp/McpExecutionPolicy.ts
- src/mcp/McpPresetSelectionPolicy.ts

### Registry (5 files)
- src/application/AgentRegistry.ts
- src/application/subagents/SubagentRegistry.ts
- src/debug/tools/DebugToolRegistry.ts
- src/mcp/McpPresetRegistry.ts
- src/provider-hub/ProviderSpecRegistry.ts

### Repository (4 files)
- src/context/history-search/index/HistoryIndexRepository.ts
- src/context/history-search/index/MementoHistoryIndexRepository.ts
- src/context/project-memory/ProjectMemoryManifestRepository.ts
- src/context/project-memory/search/ProjectMemoryIndexRepository.ts

### Resolver (3 files)
- src/application/code-review/ReviewTargetResolver.ts
- src/application/prompt/PromptSourceResolver.ts
- src/application/prompt/ProviderAliasResolver.ts

### Service (7 files)
- src/analytics/AnalyticsService.ts
- src/application/permissions/PermissionService.ts
- src/config/ConfigService.ts
- src/context/file-intelligence/FileIntelligenceService.ts
- src/context/file-intelligence/ProjectMemoryService.ts
- src/context/history-search/HistorySearchService.ts
- src/context/project-memory/ProjectMemoryStatusService.ts

### Strategy (16 files)
- src/context/history-search/HistorySearchStrategy.ts
- src/context/history-search/bm25/Bm25HistorySearchStrategy.ts
- src/debug/strategies/BuildErrorStrategy.ts
- src/debug/strategies/CSharpErrorStrategy.ts
- src/debug/strategies/ConfigFileStrategy.ts
- src/debug/strategies/DebugSearchStrategy.ts
- src/debug/strategies/GenericRuntimeErrorStrategy.ts
- src/debug/strategies/GitDiffStrategy.ts
- src/debug/strategies/GoErrorStrategy.ts
- src/debug/strategies/JavaErrorStrategy.ts
- src/debug/strategies/PythonErrorStrategy.ts
- src/debug/strategies/RubyErrorStrategy.ts
- src/debug/strategies/RustErrorStrategy.ts
- src/debug/strategies/StackTraceSearchStrategy.ts
- src/debug/strategies/TestFailureStrategy.ts
- src/debug/strategies/TypeScriptErrorStrategy.ts

### Writer (5 files)
- src/context/architecture-memory/ArchitectureMemoryWriter.ts
- src/context/project-map/NexusProjectMapWriter.ts
- src/context/project-map/summary/ProjectMapSummaryWriter.ts
- src/debug/writers/DebugPlanWriter.ts
- src/debug/writers/DebugSessionWriter.ts

## Module Inventory

### core (28 files)
- src/core/agent/AgentCapabilities.ts
- src/core/agent/AgentCommand.ts
- src/core/agent/AgentOutput.ts
- src/core/agent/AgentResult.ts
- src/core/agent/AgentTask.ts
- src/core/agent/IAgent.ts
- src/core/agent/IDetectable.ts
- src/core/agent/IOutputParser.ts
- src/core/agent/IStoppable.ts
- src/core/agent/IStreamable.ts
- src/core/agent/index.ts
- src/core/chat/ChatHistory.ts
- src/core/debug/DebugContext.ts
- src/core/eventBus.ts
- src/core/events/IEventBus.ts
- src/core/pipeline/ICompensableStep.ts
- src/core/pipeline/IPipelineStep.ts
- src/core/pipeline/PipelineContext.ts
- src/core/pipeline/SagaJournal.ts
- src/core/providerDetector.ts
- src/core/providerMigration.ts
- src/core/stream/AgentStreamEvent.ts
- src/core/stream/IProviderStreamAdapter.ts [Adapter]
- src/core/stream/IStreamDecoder.ts
- src/core/stream/NexusStreamEvent.ts
- src/core/stream/NexusStreamNormalizer.ts
- src/core/tokens/TokenUsage.ts
- src/core/types.ts

### application (102 files)
- src/application/AgentRegistry.ts [Registry]
- src/application/AgentRouter.ts
- src/application/agent-mode/AgentBranchManager.ts
- src/application/agent-mode/AgentCheckpoint.ts
- src/application/agent-mode/AgentCommandGuard.ts
- src/application/agent-mode/AgentDiffCollector.ts
- src/application/agent-mode/AgentExecutor.ts
- src/application/agent-mode/AgentFinalReporter.ts
- src/application/agent-mode/AgentModeEvents.ts
- src/application/agent-mode/AgentModePolicy.ts [Policy]
- src/application/agent-mode/AgentPlan.ts
- src/application/agent-mode/AgentPlanner.ts
- src/application/agent-mode/AgentRecovery.ts
- src/application/agent-mode/AgentReviewRunner.ts
- src/application/agent-mode/AgentSession.ts
- src/application/agent-mode/AgentSessionStore.ts
- src/application/agent-mode/AgentStep.ts
- src/application/agent-mode/AgentTestRunner.ts
- src/application/agent-mode/AgentTimeline.ts
- src/application/agent-mode/index.ts
- src/application/agents/AgentMetadata.ts
- src/application/code-review/CodeReviewArchitecturePolicy.ts [Policy]
- src/application/code-review/CodeReviewArchitectureScore.ts
- src/application/code-review/CodeReviewCategory.ts
- src/application/code-review/CodeReviewContextBuilder.ts [Builder]
- src/application/code-review/CodeReviewExecutor.ts
- src/application/code-review/CodeReviewFinding.ts
- src/application/code-review/CodeReviewPolicy.ts [Policy]
- src/application/code-review/CodeReviewPresetSuggester.ts
- src/application/code-review/CodeReviewPromptBuilder.ts [Builder]
- src/application/code-review/CodeReviewReport.ts
- src/application/code-review/CodeReviewResultParser.ts
- src/application/code-review/CodeReviewSeverity.ts
- src/application/code-review/CodeReviewStore.ts
- src/application/code-review/CodeReviewTarget.ts
- src/application/code-review/PendingReviewStore.ts
- src/application/code-review/ReviewAgentClassifier.ts
- src/application/code-review/ReviewIntentDetector.ts
- src/application/code-review/ReviewTargetResolver.ts [Resolver]
- src/application/code-review/index.ts
- src/application/code-review/materializeReviewOutput.ts
- src/application/code-review/synthesis/ArchitectureDimension.ts
- src/application/code-review/synthesis/BaseReviewDimension.ts
- src/application/code-review/synthesis/CodeReviewSynthesizer.ts
- src/application/code-review/synthesis/CorrectnessDimension.ts
- src/application/code-review/synthesis/IReviewDimension.ts
- src/application/code-review/synthesis/ReviewDimensionFactory.ts [Factory]
- src/application/code-review/synthesis/SecurityDimension.ts
- src/application/code-review/synthesis/TestDimension.ts
- src/application/nexus/AgentCapabilityMatrix.ts
- _(and 52 more)_

### infrastructure (160 files)
- src/analytics/AnalyticsAggregator.ts
- src/analytics/AnalyticsExporter.ts
- src/analytics/AnalyticsService.ts [Service]
- src/analytics/AnalyticsStore.ts
- src/analytics/AnalyticsTypes.ts
- src/analytics/CostEstimator.ts
- src/analytics/ProductivityEstimator.ts
- src/context/ConversationCompactor.ts
- src/context/agentMentionParser.ts
- src/context/agentPromptLibrary.ts
- src/context/architecture-memory/ArchitectureConfigLoader.ts [Loader]
- src/context/architecture-memory/ArchitectureMarkdownRenderer.ts
- src/context/architecture-memory/ArchitectureMemoryBuilder.ts [Builder]
- src/context/architecture-memory/ArchitectureMemoryLoader.ts [Loader]
- src/context/architecture-memory/ArchitectureMemoryValidator.ts
- src/context/architecture-memory/ArchitectureMemoryWriter.ts [Writer]
- src/context/architecture-memory/ArchitecturePromptBuilder.ts [Builder]
- src/context/architecture-memory/ArchitectureStyleDetector.ts
- src/context/architecture-memory/BoundaryDetector.ts
- src/context/architecture-memory/DependencyGraphBuilder.ts [Builder]
- src/context/architecture-memory/LayerDetector.ts
- src/context/architecture-memory/ModuleDetector.ts
- src/context/architecture-memory/PatternDetector.ts
- src/context/architecture-memory/index.ts
- src/context/architecture-memory/search/ArchitectureDocument.ts
- src/context/architecture-memory/search/ArchitectureIndexBuilder.ts [Builder]
- src/context/architecture-memory/search/ArchitectureRagFacade.ts
- src/context/architecture-memory/types.ts
- src/context/commandPromptLibrary.ts
- src/context/compactPrompt.ts
- src/context/compactSummaryFormatter.ts
- src/context/conversationContext.ts
- src/context/file-intelligence/FileIntelligenceConfidenceScorer.ts
- src/context/file-intelligence/FileIntelligenceContextBuilder.ts [Builder]
- src/context/file-intelligence/FileIntelligenceContextSelector.ts
- src/context/file-intelligence/FileIntelligenceFreshnessPolicy.ts [Policy]
- src/context/file-intelligence/FileIntelligenceIgnoreFilter.ts
- src/context/file-intelligence/FileIntelligenceMergePolicy.ts [Policy]
- src/context/file-intelligence/FileIntelligenceRagFacade.ts
- src/context/file-intelligence/FileIntelligenceService.ts [Service]
- src/context/file-intelligence/FileIntelligenceStore.ts
- src/context/file-intelligence/FileIntelligenceUpdater.ts
- src/context/file-intelligence/FileTouchCollector.ts
- src/context/file-intelligence/JsonFileIntelligenceStore.ts
- src/context/file-intelligence/ProjectMemoryService.ts [Service]
- src/context/file-intelligence/index.ts
- src/context/file-intelligence/types.ts
- src/context/history-search/HistoryRagFacade.ts
- src/context/history-search/HistorySearchService.ts [Service]
- src/context/history-search/HistorySearchStrategy.ts [Strategy]
- _(and 110 more)_

### interface (51 files)
- src/cli/commands/doctorCommand.ts
- src/cli/commands/mapCommand.ts
- src/cli/commands/modelCommand.ts
- src/cli/commands/providerCommand.ts
- src/cli/commands/runCommand.ts
- src/cli/console/NexusConsole.ts
- src/cli/console/NexusConsoleBanner.ts
- src/cli/console/NexusConsoleCommands.ts
- src/cli/console/NexusConsoleCompleter.ts
- src/cli/console/NexusConsoleInput.ts
- src/cli/console/NexusConsoleModelScanner.ts
- src/cli/console/NexusConsolePromptRunner.ts
- src/cli/console/NexusConsoleState.ts
- src/cli/index.ts
- src/review/ReviewHtml.ts
- src/review/ReviewPanel.ts
- src/settings/AboutHtml.ts
- src/settings/AboutPanel.ts
- src/settings/SettingsHtml.ts
- src/settings/SettingsPanel.ts
- src/webview/ChatController.ts [Controller]
- src/webview/ChatHistoryStore.ts
- src/webview/ChatPanel.ts
- src/webview/ChatViewProvider.ts
- src/webview/DashboardViewProvider.ts
- src/webview/IChatHistoryStore.ts
- src/webview/LauncherViewProvider.ts
- src/webview/getHtml.ts
- src/webview/handlers/AgentPromptHandler.ts [Handler]
- src/webview/handlers/AnalyticsHandler.ts [Handler]
- src/webview/handlers/ArtifactHandler.ts [Handler]
- src/webview/handlers/AttachmentHandler.ts [Handler]
- src/webview/handlers/ChatReviewOrchestrator.ts [Orchestrator]
- src/webview/handlers/CodeBlockHandler.ts [Handler]
- src/webview/handlers/CodeReviewCommandHandler.ts [Handler]
- src/webview/handlers/CommandPromptHandler.ts [Handler]
- src/webview/handlers/CompactCommandHandler.ts [Handler]
- src/webview/handlers/DiffHandler.ts [Handler]
- src/webview/handlers/EventForwarder.ts
- src/webview/handlers/HistoryHandler.ts [Handler]
- src/webview/handlers/HistorySearchHandler.ts [Handler]
- src/webview/handlers/LoginHandler.ts [Handler]
- src/webview/handlers/NavigationHandler.ts [Handler]
- src/webview/handlers/ProjectMemoryHandler.ts [Handler]
- src/webview/handlers/ProviderHandler.ts [Handler]
- src/webview/handlers/ResearchCommandHandler.ts [Handler]
- src/webview/handlers/ReviewHandler.ts [Handler]
- src/webview/handlers/RunTaskHandler.ts [Handler]
- src/webview/handlers/SkillPromptHandler.ts [Handler]
- src/webview/handlers/workspaceUtils.ts
- _(and 1 more)_

### support (3 files)
- src/config/ConfigService.ts [Service]
- src/config/DefaultConfig.ts
- src/config/NexusConfig.ts

### unknown (172 files)
- src/artifacts/ArtifactPreviewer.ts
- src/artifacts/ArtifactScanner.ts
- src/artifacts/ArtifactStore.ts
- src/artifacts/ArtifactTypes.ts
- src/auto-review/AutoReviewConfig.ts
- src/auto-review/AutoReviewController.ts [Controller]
- src/auto-review/AutoReviewReport.ts
- src/auto-review/AutoReviewScheduler.ts
- src/auto-review/AutoReviewStateStore.ts
- src/auto-review/AutoReviewWatcher.ts
- src/auto-review/architecture/ArchitectureDriftDetector.ts
- src/auto-review/architecture/ArchitectureMemoryReader.ts
- src/auto-review/architecture/ArchitectureRuleMatcher.ts
- src/auto-review/baseline/ReviewBaselineStore.ts
- src/auto-review/baseline/ReviewFingerprint.ts
- src/auto-review/risk/RiskScoreEngine.ts
- src/auto-review/risk/RiskScoreTypes.ts
- src/debug/DebugContext.ts
- src/debug/DebugInputParser.ts
- src/debug/debugPrompt.ts
- src/debug/index.ts
- src/debug/language/LanguageDetector.ts
- src/debug/orchestrator/DebugChain.ts
- src/debug/orchestrator/DebugChainContext.ts
- src/debug/orchestrator/DebugOrchestrator.ts [Orchestrator]
- src/debug/orchestrator/DebugOrchestratorFactory.ts [Factory]
- src/debug/orchestrator/DebugState.ts
- src/debug/orchestrator/DebugStep.ts
- src/debug/react/ReActLoop.ts
- src/debug/react/ReActPromptBuilder.ts [Builder]
- src/debug/react/ReActTypes.ts
- src/debug/search/Bm25Index.ts
- src/debug/search/Bm25Tokenizer.ts
- src/debug/search/DebugQueryBuilder.ts [Builder]
- src/debug/search/DebugSearchResult.ts
- src/debug/search/SearchResultMerger.ts
- src/debug/search/WorkspaceFileCollector.ts
- src/debug/steps/ApplyFixStep.ts
- src/debug/steps/ApprovalGateStep.ts
- src/debug/steps/BaseDebugStep.ts
- src/debug/steps/Bm25RetrievalStep.ts
- src/debug/steps/DebugPlanStep.ts
- src/debug/steps/DebugSummaryStep.ts
- src/debug/steps/ParseDebugInputStep.ts
- src/debug/steps/ProjectProfileLoadStep.ts
- src/debug/steps/ReActInvestigationStep.ts
- src/debug/steps/StrategyRetrievalStep.ts
- src/debug/steps/ToolSelectionStep.ts
- src/debug/steps/VerificationStep.ts
- src/debug/strategies/BuildErrorStrategy.ts [Strategy]
- _(and 122 more)_
