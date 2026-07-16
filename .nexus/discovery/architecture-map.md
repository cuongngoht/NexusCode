# Architecture Map

**Style:** Clean Architecture / Hexagonal
**Project Type:** vscode-extension
**Language:** TypeScript

## Layers

- `core`
- `application`
- `infrastructure`

## Orchestrators

- src/application/nexus/NexusOrchestrator.test.ts
- src/application/nexus/NexusOrchestrator.ts
- src/application/subagents/SubagentOrchestrator.test.ts
- src/application/subagents/SubagentOrchestrator.ts
- src/context/project-map/NexusDiscoveryOrchestrator.ts
- src/debug/orchestrator/DebugOrchestrator.ts
- src/webview/handlers/ChatReviewOrchestrator.ts

## Handlers

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
- … and 4 more

## Controllers

- src/auto-review/AutoReviewController.ts
- src/webview/ChatController.ts

## Use Cases

- src/application/usecases/BuildArchitectureMemoryUseCase.ts
- src/application/usecases/BuildProjectMapUseCase.ts
- src/application/usecases/DetectAgentsUseCase.ts
- src/application/usecases/RunAgentUseCase.ts
- src/application/usecases/SummarizeProjectMapUseCase.ts
- src/mcp/McpToolUseCase.ts

## Services

- src/analytics/AnalyticsService.ts
- src/application/permissions/PermissionService.ts
- src/config/ConfigService.ts
- src/context/file-intelligence/FileIntelligenceService.ts
- src/context/file-intelligence/ProjectMemoryService.ts
- src/context/file-intelligence/__tests__/FileIntelligenceService.test.ts
- src/context/history-search/HistorySearchService.ts
- src/context/history-search/__tests__/historySearchService.test.ts
- src/context/project-memory/ProjectMemoryStatusService.ts
- src/context/project-memory/__tests__/ProjectMemoryStatusService.test.ts

## Repositories

- src/context/history-search/index/HistoryIndexRepository.ts
- src/context/history-search/index/MementoHistoryIndexRepository.ts
- src/context/project-memory/ProjectMemoryManifestRepository.ts
- src/context/project-memory/search/ProjectMemoryIndexRepository.ts

## Adapters

- src/core/stream/IProviderStreamAdapter.ts
- src/debug/adapters/DebugSearchAdapter.ts
- src/debug/adapters/InternalWorkspaceSearchAdapter.ts
- src/mcp/adapters/IMcpClientAdapter.ts
- src/mcp/adapters/StdioMcpClientAdapter.ts
- src/mcp/adapters/StreamableHttpMcpClientAdapter.ts
- src/providers/antigravity/AntigravityStreamAdapter.test.ts
- src/providers/antigravity/AntigravityStreamAdapter.ts
- src/providers/base/WrappedParserAdapter.ts
- src/providers/codex/CodexJsonlAdapter.test.ts
- src/providers/codex/CodexJsonlAdapter.ts
- src/providers/codex/CodexSseAdapter.test.ts
- src/providers/codex/CodexSseAdapter.ts
- src/providers/grok/GrokEventAdapter.test.ts
- src/providers/grok/GrokEventAdapter.ts
- … and 2 more

## Stores

- src/analytics/AnalyticsStore.ts
- src/application/agent-mode/AgentSessionStore.ts
- src/application/code-review/CodeReviewStore.ts
- src/application/code-review/PendingReviewStore.ts
- src/application/nexus/NexusPlanStore.ts
- src/application/permissions/PermissionStore.ts
- src/application/subagents/SubagentResultStore.test.ts
- src/application/subagents/SubagentResultStore.ts
- src/artifacts/ArtifactStore.ts
- src/auto-review/AutoReviewStateStore.ts
- src/auto-review/baseline/ReviewBaselineStore.ts
- src/context/file-intelligence/FileIntelligenceStore.ts
- src/context/file-intelligence/JsonFileIntelligenceStore.ts
- src/context/file-intelligence/__tests__/FileIntelligenceStore.test.ts
- src/context/research/__tests__/activeResearchStore.test.ts
- … and 5 more

## Routers

- src/application/AgentRouter.ts
- src/application/routing/ModelRouter.test.ts
- src/application/routing/ModelRouter.ts
- src/application/subagents/SubagentRouter.test.ts
- src/application/subagents/SubagentRouter.ts
- src/mcp/McpToolRouter.test.ts
- src/mcp/McpToolRouter.ts

## Entry Points

- src/extension.ts

## Detected Frameworks

- react
- vite
- fluent-ui
