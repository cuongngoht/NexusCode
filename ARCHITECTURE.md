# Nexus AI Code — Architecture & Design (2026)

> **Current version focus**: Clean Architecture + heavy use of OOP/OOD patterns for maintainability and extensibility.
> Primary language: TypeScript. VS Code Extension (engine ≥ 1.85).

This document reflects the **actual evolved architecture** (post the original simplified agents.md from v0.1.5). It emphasizes:

- Dependency rule (outer → inner only)
- SOLID principles in practice
- Key design patterns (Strategy, Factory, Registry, Adapter, Pipeline, Policy, Observer)
- How to extend the system (add agent, new mode, new streaming transport, etc.)
- Current reality of multiple orchestration subsystems

## 1. Layers (Clean Architecture)

```
Interface (webview, settings, cli, extension.ts entry)
          ↓
Application (use cases, orchestrators, routers, registries, pipeline steps)
          ↓
Domain / Core (pure entities, value objects, interfaces, events — minimal or zero I/O)
          ↑
Infrastructure (providers/*, runner, mcp, analytics, context builders, stream decoders, project-map, debug strategies, git, etc.)
```

**Core rule**: Code in `src/core/` must not import from `application/`, `providers/`, `webview/`, `context/`, `provider-hub/`, `debug/` (feature), etc. Only other `core/` or stdlib (with exceptions for placed infrastructure like detectors that have been migrated).

**Current state of purity**:
- Most of `core/` (AgentTask, IAgent, AgentCapabilities, events, pipeline contracts, stream events, types) is pure.
- `ProviderDetector` + heavy I/O was successfully **moved to `provider-hub/`** (2026 refactor).
- `PipelineContext` correctly imports `DebugContext` from `core/debug/` (pure type definition; feature code only re-exports).

## 2. Key Patterns (OOP / OOD)

### Agents & Providers (Strategy + Registry + Template)
- `IAgent` (core/agent/IAgent.ts) — the central contract.
- `BaseAgent` provides common `isAvailable()`, `buildCommand` template with `doBuildCommand` + cwd hooks.
- All concrete agents (`ClaudeAgent`, `GrokAgent`, `CodexAgent`, `NexusAgent`, `CustomAgent`, ...) extend BaseAgent.
- `AgentRegistry` (simple Map-based) + `AgentRouter` (with capability matching + 'auto' mode).
- Adding an agent:
  1. Implement (usually extend BaseAgent) in `providers/<id>/`.
  2. Add `ProviderSpec` entry in `provider-hub/ProviderSpecRegistry.ts`.
  3. Register instance in `extension.ts` → `createAgentRegistry()`.
  4. (If streaming) ensure transport + adapter is registered (see below).
  5. Update policies (ModeCapabilityPolicy, NexusRoutingPolicy) if the agent has special capabilities or priority in stages.
  6. Update UI lists / i18n / docs as needed.

### Streaming & Per-Provider Output Interpretation (Adapter + Factory + Registry — the "Stream Interpretation Strategy")
Modern agents emit very different formats (JSON lines with `thought`/`text`, tool events, SSE, plain, etc.).

- `IProviderStreamAdapter` + `IStreamDecoder` (core/stream/).
- `AgentStreamPipeline` composes one decoder + one adapter → normalized `AgentStreamEvent[]` (content_delta, reasoning_delta, tool_call, tool_result, stream_error, etc.).
- `AgentStreamPipelineFactory` (application/stream/) now uses an **internal registry** (`adapterFactories` Map) + `static register(transport, factory)`.
  - Built-ins are seeded at module load.
  - New transports/agents can call `AgentStreamPipelineFactory.register(...)` without editing the factory switch.
- Legacy side-channel `IOutputParser` (for `ParsedActivity` chips) is intentionally kept for robustness (see RunAgentUseCase comments). New rich events are the primary channel.

This pattern makes supporting a brand new CLI response format a matter of:
- New `*StreamAdapter.ts`
- One `register(...)` call
- Wire the transport string in the agent's `buildCommand()` → `new AgentCommand(..., transport)`

### Pipeline Steps (Strategy + Template for pre-processing)
- `IPipelineStep` + `PipelineContext` (mutable enrichment bag).
- `createPreSteps(mode)` (switch today) returns the list for that mode.
- Used by `RunTaskHandler` before calling `RunAgentUseCase` or `NexusOrchestrator`.
- Current modes with special pre-steps: scan-project, brainstorm, debug, review.

**Extensibility note**: For many new modes, prefer adding a new pre-step implementation and extending the switch (or migrate to a step registry later).

### Orchestration Layers (multiple, intentional)
The system evolved several cooperating orchestrators because different flows have very different needs:

- **RunAgentUseCase** — single agent execution + MCP follow-up + token metering + dual-path emission (raw stdout + stream pipeline + legacy parser).
- **NexusOrchestrator** (`application/nexus/`) — multi-stage flows (search → plan → code) with approval gate, using `MODE_FLOW` and priority tables.
- **SubagentOrchestrator** + planner/executor/registry — dynamic sub-agents, DAG planning, preset policies, intent classification.
- **DebugOrchestrator** + DebugChain + ReActLoop + many Strategy classes (`debug/strategies/*`, `debug/steps/*`) — specialized investigation loop.
- **RunTaskHandler** (webview/handlers/) — top-level coordinator that builds `PipelineContext`, runs pre-steps + subagents + RAG, then delegates to the above.

**Trade-off accepted**: Duplication of "orchestrator + steps/policies" concepts exists for isolation of concerns (debug vs coding agent vs research). Shared contracts (PipelineContext, IEventBus, NexusEvent) reduce some drift.

### Other strong patterns
- **Registry + Policy** everywhere (McpPreset*, Subagent*, ProviderSpec*, FallbackPolicy, etc.).
- **EventBus** (Observer) — decouples long-running execution from UI, analytics, history, etc.
- **Factory** (AgentStream..., DebugOrchestratorFactory, createPreSteps, prompt builders).
- **Adapter** (MCP stdio/http, stream decoders, many prompt/context compactors).
- **Composition over deep inheritance** in many places (handlers, steps, policies).

## 3. Composition Root & Wiring

`extension.ts:activate` is the composition root.

**Improvements applied (2026)**:
- Extracted `createAgentRegistry()`, `createMcpToolUseCase()`, `createProjectMapUseCases()`, `createSubagentOrchestrator()`, `createAnalyticsService()`.
- `ChatController` further delegates to many `*Handler` classes in `webview/handlers/`.
- `AgentStreamPipelineFactory` supports runtime registration.

Still a fair amount of `new` remains (project map builders, analytics, etc.). Future: a more complete `bootstrap/createServices(context)` returning a bag of collaborators would be a natural next step if the surface grows further.

## 4. State & Persistence

- Conversation history: `context.workspaceState` via `ChatHistoryStore` (max 50 convos).
- Last provider: `context.globalState`.
- Analytics: `globalStorageUri` (AnalyticsStore).
- RAG / history search index also uses workspace/global mementos (BM25 + custom index).
- Config: `vscode.workspace.getConfiguration('nexus')`.

## 5. How to Add Things (Practical Guide)

### New CLI Agent / Provider
See section 2 (Agents). Also add to:
- `provider-hub/ProviderSpecRegistry.ts`
- Possibly a custom output normalizer/parser under `output/parsers/` (legacy) or (preferred) a stream adapter.
- Update capability / routing policies if it should win "auto" for certain modes.
- Test via `nexus doctor` / settings UI.

### New Streaming Transport / Response Shape
1. Implement `IProviderStreamAdapter` (and optionally `flush()`).
2. `AgentStreamPipelineFactory.register('my-transport', (cmd) => ({ decoder: ..., adapter: new MyAdapter() }))`.
3. In your Agent's `doBuildCommand`: return `new AgentCommand(exec, args, ..., 'my-transport')`.
4. Done — no changes to factory internals.

### New Pre-processing Step or Mode
- Implement `IPipelineStep`.
- Extend `createPreSteps` switch.
- Add to `PipelineContext` shape if new enrichment data is needed.
- Wire special behavior in `RunTaskHandler` / prompt builder.
- Update Nexus policies if the mode participates in multi-stage flows.
- Add i18n step label under `pipeline.steps`.

### New Top-Level Feature (e.g. another orchestrator)
- Keep new code out of `core/`.
- Prefer adding a `*Handler` in webview/handlers for UI-triggered work.
- Emit well-typed `NexusEvent`s.
- Register command / view in activate (use the extracted helpers pattern).

## 6. Testing Strategy

- Domain/core: pure unit tests (no mocks needed for most).
- Application: mock `IAgent`, `IProcessRunner`, `IEventBus`.
- Webview reducer + messages: vitest, fully isolated.
- Many fine-grained tests for policies, parsers, subagent pieces, debug strategies, history search.

Run: `npm run compile` (must be clean) + `npm run test:webview`.

## 7. Invariants & Gotchas (Keep These)

1. Never import from outer layers into `src/core/`.
2. `shell: false` + `CommandGuard` for every spawn.
3. `saveKey` in webview state drives autosave — only increment on meaningful mutations.
4. Streaming assistant messages are **never** serialized to history.
5. ProviderId and AgentId values must stay in sync.
6. Pipeline step `label` is a **semantic key** (translated via i18n at UI layer).
7. Dual output paths (pipeline events vs legacy parser) are intentional — raw content fidelity wins.
8. Before committing: `npm run compile`.

## 8. File Tree Highlights (Key Areas)

```
src/
  core/                          # Domain contracts + pure types
  application/
    usecases/
    nexus/                       # multi-stage flows + policies
    stream/                      # AgentStreamPipelineFactory + registry
    subagents/                   # full sub-agent subsystem
    pipeline/                    # createPreSteps + concrete steps
  provider-hub/                  # ProviderSpecRegistry, ProviderDetector (post-migration), health, models
  providers/*/                   # concrete agents + their *StreamAdapter
  webview/
    handlers/                    # RunTaskHandler (coordinator), many feature handlers
  debug/                         # specialized debug orchestrator + ReAct + strategies
  context/                       # prompt builders, RAG/history-search, project-map, research...
  mcp/, analytics/, git/, runner/, infrastructure/...
```

## 9. Future Opportunities (Lower Priority)

- Full DI / Service Locator or a single `bootstrap()` returning a typed context bag.
- Registry-based pre-step and mode policy contribution (remove more switches).
- Unify more of the orchestrator concepts or make a clear "flow executor" interface.
- Stronger static layer linting (eslint import boundaries).

---

**Maintained as living documentation.** When you add a major subsystem, update this file and the "Adding..." sections.

Last major update: 2026 (ProviderDetector move + Stream registry + composition helpers + this doc).
