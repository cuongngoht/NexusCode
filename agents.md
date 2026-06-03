# NexusCode — Agent Architecture

> **Project**: `nexus-code` v0.1.5 — VS Code Extension (engine ≥ 1.85.0)
>
> **What it does**: A chat panel inside VS Code that routes user prompts to any installed CLI coding agent (Claude Code, Codex CLI, Gemini CLI, Copilot CLI, Aider, Custom). The extension spawns the CLI as a child process, streams output back to the webview in real time, and persists conversation history per workspace.

---

## Table of Contents

1. [VS Code Extension Overview](#vs-code-extension-overview)
2. [Clean Architecture Layers](#clean-architecture-layers)
3. [Domain Layer](#domain-layer)
4. [Application Layer](#application-layer)
5. [Infrastructure Layer](#infrastructure-layer)
6. [Interface Layer](#interface-layer)
7. [Chat History](#chat-history)
8. [Pipeline Step Pattern](#pipeline-step-pattern)
9. [Output Parser Pattern](#output-parser-pattern)
10. [Adding a New Agent](#adding-a-new-agent)
11. [i18n Rules](#i18n-rules)
12. [VS Code Extension Best Practices](#vs-code-extension-best-practices)
13. [Full File Tree](#full-file-tree)
14. [Build Commands](#build-commands)

---

## VS Code Extension Overview

```
User opens VS Code
      │
      ▼
extension.ts (activate)          ← composition root — wires all dependencies
      │
      ├── ChatViewProvider        ← WebviewViewProvider registered at 'nexus.chatView'
      │     └── ChatController    ← bridges webview messages ↔ use cases
      │
      ├── SettingsPanel           ← WebviewPanel for provider config
      └── AboutPanel              ← WebviewPanel for version info
```

**Key VS Code APIs in use:**

| API                                          | Where                           | Purpose                                                                                |
| -------------------------------------------- | ------------------------------- | -------------------------------------------------------------------------------------- |
| `vscode.window.registerWebviewViewProvider`  | `extension.ts`                  | Mount the React chat panel in the sidebar                                              |
| `vscode.workspace.getConfiguration('nexus')` | `ChatController`, `CustomAgent` | Read extension settings                                                                |
| `context.globalState` (Memento)              | `ChatController`                | Persist last-used provider across workspaces                                           |
| `context.workspaceState` (Memento)           | `ChatHistoryStore`              | Persist conversation history per workspace                                             |
| `vscode.commands.registerCommand`            | `extension.ts`                  | `nexus.openChat`, `nexus.openSettings`, `nexus.openAbout`, `nexus.summarizeProjectMap` |
| `vscode.workspace.workspaceFolders`          | `ChatController`                | Get workspace root for process CWD and context building                                |

**Webview security model:**

- `enableScripts: true` — required for React
- `localResourceRoots` — locked to `media/` and `media/webview/`
- All communication via `postMessage` — typed in `webviewProtocol.ts`
- `retainContextWhenHidden: true` — preserves React state when panel is hidden

---

## Clean Architecture Layers

```
┌─────────────────────────────────────────────────┐
│            Interface Layer                      │  VS Code Webview + React UI
├─────────────────────────────────────────────────┤
│           Application Layer                     │  Use Cases, Router, Registry, Pipeline
├─────────────────────────────────────────────────┤
│              Domain Layer                       │  Interfaces, Entities, Value Objects
├─────────────────────────────────────────────────┤
│           Infrastructure Layer                  │  Concrete Agents, Process Execution
└─────────────────────────────────────────────────┘
         dependency arrows point inward only
```

**Dependency rule**: outer layers import inner layers. Inner layers never import outer layers.

| Layer          | Location                                        | Allowed imports                  |
| -------------- | ----------------------------------------------- | -------------------------------- |
| Domain         | `src/core/`                                     | Nothing (zero I/O, zero VS Code) |
| Application    | `src/application/`                              | Domain only                      |
| Infrastructure | `src/providers/`, `src/runner/`, `src/context/` | Domain + Node.js                 |
| Interface      | `src/webview/`, `src/extension.ts`              | All layers + VS Code API         |

---

## Domain Layer

All files in `src/core/` have **zero external dependencies** — no Node.js I/O, no VS Code API.

### `src/core/agent/IAgent.ts`

The contract every agent must satisfy:

```typescript
export interface IAgent {
  readonly id: AgentId;
  readonly displayName: string;
  readonly capabilities: AgentCapabilities;
  readonly seededModels: ReadonlyArray<ProviderModel>;
  readonly defaultModel?: string;
  readonly outputParser?: IOutputParser;
  isAvailable(): Promise<boolean>;
  buildCommand(task: AgentTask): AgentCommand;
  parseOutput(raw: string): AgentOutput;
}
```

> `seededModels` — fallback list when the CLI cannot enumerate models dynamically.
> `outputParser` — optional. When present, streamed stdout is parsed into `ParsedActivity[]` for live UI rendering.

---

### `src/core/agent/AgentTask.ts`

Entity with identity. Owns its own state transitions.

```typescript
export type AgentId    = 'claude' | 'codex' | 'gemini' | 'copilot' | 'aider' | 'custom' | 'auto';
export type TaskMode   = 'ask' | 'research' | 'scan-project' | 'plan' | 'edit' | 'debug' | 'test' | 'review';
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export class AgentTask {
  constructor(
    readonly prompt: string,
    readonly enhancedPrompt: string,
    readonly agentId: AgentId,
    readonly mode: TaskMode,
    readonly model?: string,
    readonly cwd?: string,   // workspace root, passed to ProcessRunner
  ) { ... }

  start():  void
  cancel(): void
  complete(result: AgentResult): void
}
```

---

### `src/core/agent/IOutputParser.ts`

For agents that emit structured progress lines (file edits, shell commands, etc.):

```typescript
export type ActivityKind =
  | "read"
  | "edit"
  | "bash"
  | "write"
  | "todo"
  | "search"
  | "tool_call"
  | "plain";
export type ActivityStatus = "running" | "done" | "error";

export interface ParsedActivity {
  kind: ActivityKind;
  status: ActivityStatus;
  label: string;
  raw: string;
}

export interface IOutputParser {
  parse(chunk: string): ParsedActivity[];
}
```

---

### `src/core/agent/` — other interfaces (ISP)

```typescript
IDetectable  → detect(): Promise<DetectionResult>
IStreamable  → onStdout / onStderr / onComplete
IStoppable   → stop(): Promise<void>
```

A simple read-only agent implements only `IAgent`. A long-running interactive agent also implements `IStreamable + IStoppable`.

---

### `src/core/pipeline/PipelineContext.ts`

Mutable context passed through the pipeline for a single task run:

```typescript
export type PipelineContext = {
  readonly workspaceRoot: string;
  readonly originalPrompt: string;
  readonly mode: TaskMode;
  readonly model: string | undefined;
  readonly providerId: ProviderId;
  readonly enableEnhancement: boolean;
  // Enriched by pre-steps:
  projectMap?: string;
  conversationContext?: string; // last 8 messages, max 12k chars
  enhancedPrompt: string;
};
```

---

### `src/core/chat/ChatHistory.ts`

Serializable DTOs for workspace-persisted conversation history:

```typescript
export interface SerializedUserMessage    { role: 'user';      prompt: string; ... }
export interface SerializedAssistantMessage { role: 'assistant'; content: string; ... }
export type SerializedChatMessage = SerializedUserMessage | SerializedAssistantMessage;

export interface SerializedConversation {
  id: string; title: string; createdAt: number; updatedAt: number;
  messages: SerializedChatMessage[];
  gitChanges?: { status: string; path: string }[];
}

export interface ChatHistoryState {
  version: 1;
  activeConversationId: string;
  conversations: SerializedConversation[];
}
```

---

### `src/core/events/IEventBus.ts`

Decouples task execution from the UI. Used internally by `RunAgentUseCase` and forwarded to the webview by `ChatController`.

```typescript
export type NexusEvent =
  | { kind: 'task_started';   task: AgentTask }
  | { kind: 'stdout';         task: AgentTask; chunk: string }
  | { kind: 'stderr';         task: AgentTask; chunk: string }
  | { kind: 'task_completed'; task: AgentTask; result: AgentResult }
  | { kind: 'task_stopped';   task: AgentTask }
  | { kind: 'task_error';     task: AgentTask; error: string }
  | { kind: 'step_started';   stepLabel: string; stepIndex: number; totalSteps: number; ... }
  | { kind: 'step_completed'; stepLabel: string }
  | { kind: 'step_error';     stepLabel: string; error: string }
  | { kind: 'activity_started'; activityKind: string; label: string }
  | { kind: 'activity_done';    activityKind: string; label: string; status: 'done' | 'error' };
```

---

### `src/core/types.ts`

Shared value types used by both extension and webview sides:

```typescript
export type ProviderId =
  | "codex"
  | "claude"
  | "gemini"
  | "copilot"
  | "aider"
  | "custom"
  | "auto";
// ProviderId (UI-facing) and AgentId (core) must have identical values — keep in sync
```

---

## Application Layer

### `src/application/usecases/RunAgentUseCase.ts`

Single entry point for executing one task end-to-end. Emits all lifecycle events.

```
execute(task)
  → router.resolve(agentId, mode)   picks available IAgent
  → agent.buildCommand(task)         AgentCommand (value object)
  → task.start()
  → eventBus.emit('task_started')
  → runner.run(command, { onStdout, onStderr })
  → task.complete(result)
  → eventBus.emit('task_completed')
```

### `src/application/AgentRouter.ts`

Picks the right agent. If `agentId === 'auto'`, finds the first available agent whose `capabilities.supports(required)` is true for the given mode.

### `src/core/providerDetector.ts`

Separate from `AgentRouter` — detects installed CLIs and their versions for the Settings UI. Results are **cached for 30 s** to avoid repeated slow PATH lookups.

```typescript
export class ProviderDetector {
  detectAll(): Promise<ProviderDetectionResult[]>; // cached, used on 'ready'
  detectOne(id): Promise<ProviderDetectionResult>; // uncached, used on-demand
  invalidate(): void; // force re-detect
}
```

Each provider has a `ProviderSpec` in the `SPECS` array: `binary`, `versionArgs`, `versionPattern`, `seededModels`.

---

## Infrastructure Layer

### `src/providers/base/BaseAgent.ts`

Shared `isAvailable()` using cross-platform `which` / `where` via `spawnSync`:

```typescript
async isAvailable(): Promise<boolean> {
  const cmd = process.platform === 'win32' ? 'where' : 'which';
  const result = spawnSync(cmd, [this.executableName], { timeout: 5000, shell: false });
  return result.status === 0;
  // Never throws — router safely tries the next candidate
}
```

Subclasses must declare:

- `abstract readonly id: AgentId`
- `abstract readonly displayName: string`
- `abstract readonly capabilities: AgentCapabilities`
- `abstract readonly seededModels: ReadonlyArray<ProviderModel>`
- `abstract readonly executableName: string`
- `abstract buildCommand(task: AgentTask): AgentCommand`
- `abstract parseOutput(raw: string): AgentOutput`

Optionally override `readonly outputParser?: IOutputParser` (default: `undefined`).

---

### `src/runner/processRunner.ts`

Spawns the CLI using `spawn` (not `exec`) with `shell: false` for security:

```typescript
const child = spawn(command.executable, [...command.args], {
  cwd: options.cwd,
  shell: false, // never use shell: true — avoids injection
  env: {
    ...process.env,
    ...command.env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
  },
});
```

Stop sequence: `SIGTERM` → wait 3 s → `SIGKILL`.

**Stderr noise filtering**: internal diagnostic lines (`[ClassName]`, stack traces, `at file://`) are filtered before being forwarded to the UI.

### `src/runner/commandGuard.ts`

Validates the executable name before every spawn. Rejects shell metacharacters: `; & | \` $ < > \ !`

---

### `src/webview/ChatHistoryStore.ts`

Persists conversation history to `context.workspaceState` (per-workspace Memento):

```typescript
const HISTORY_KEY = "nexus.chatHistory.v1";
const MAX_CONVERSATIONS = 50;

export class ChatHistoryStore {
  load(): ChatHistoryState | null; // safe fallback on corrupt data
  save(history): Promise<void>; // trims to 50 newest by updatedAt
  clear(): Promise<void>;
}
```

---

## Interface Layer

### `src/webview/webviewProtocol.ts` — Message contract

**Extension → Webview:**

| Message                                                                   | When                                                 |
| ------------------------------------------------------------------------- | ---------------------------------------------------- |
| `historyLoaded`                                                           | On `ready` — sends saved conversations to hydrate UI |
| `availableProviders`                                                      | On `ready` — installed CLIs + detection results      |
| `stepStarted / stepCompleted / stepError`                                 | Pipeline steps                                       |
| `taskStarted / stdout / stderr / taskCompleted / taskStopped / taskError` | Agent execution                                      |
| `gitStatus`                                                               | After task completes (if enabled)                    |
| `activityStarted / activityDone`                                          | Per-file/per-command activity from output parser     |

**Webview → Extension:**

| Message                                        | When                                           |
| ---------------------------------------------- | ---------------------------------------------- |
| `ready`                                        | Webview first loads                            |
| `runTask`                                      | User submits prompt                            |
| `stopTask`                                     | User clicks Stop                               |
| `saveHistory`                                  | After task ends, new/delete/clear conversation |
| `saveProvider`                                 | User changes provider                          |
| `openSettings / openAbout / openSourceControl` | Toolbar actions                                |

---

### `src/webview/ChatController.ts`

Central bridge. On `ready`:

1. Loads history from `ChatHistoryStore` → posts `historyLoaded`
2. Runs `ProviderDetector.detectAll()` → posts `availableProviders`

On `runTask`:

1. Builds `conversationContext` from `_latestHistory` (last 8 messages, ≤ 12k chars)
2. Runs pre-pipeline steps
3. Calls `buildEnhancedPrompt()` with workspace context + conversation context
4. Spawns the CLI via `RunAgentUseCase`

On `saveHistory`: stores to `ChatHistoryStore`, updates `_latestHistory`.

---

### `src/webview-ui/` — React UI

**Stack**: React 18, Vite, FluentUI components, custom CSS variables.

**State**: single `useReducer` with `AppState` in `messages.ts`. All extension events arrive as `extMsg` actions.

**Key state fields:**

| Field           | Purpose                                                                    |
| --------------- | -------------------------------------------------------------------------- |
| `conversations` | All loaded conversations                                                   |
| `activeConvId`  | Which conversation is shown                                                |
| `saveKey`       | Integer that increments on save-worthy events; drives `useEffect` autosave |
| `isRunning`     | Whether a task is in progress                                              |
| `isDetecting`   | Shows skeleton while waiting for `availableProviders`                      |

**Autosave pattern** (no debounce needed — driven by discrete events):

```typescript
useEffect(() => {
  if (state.saveKey > 0 && state.saveKey !== saveKeyRef.current) {
    saveKeyRef.current = state.saveKey;
    getVsCodeApi().postMessage({
      type: "saveHistory",
      history: serializeHistory(stateRef.current),
    });
  }
}, [state.saveKey]);
```

`saveKey` increments on: `taskCompleted`, `taskStopped`, `taskError`, `newConversation`, `deleteConversation`, `clearHistory`. It does **not** increment on `tick` (elapsed timer).

---

## Chat History

Conversation history is stored per-workspace in `context.workspaceState`:

- Key: `nexus.chatHistory.v1`
- Max: 50 conversations (trimmed by `updatedAt` descending)
- Conversations are serialized with only **completed** messages; streaming messages are excluded

**Conversation context for prompts:**

- Built from the last 8 messages of the active conversation
- Limited to 12,000 characters total
- Each assistant message truncated to 2,000 characters
- Injected into the enhanced prompt under `# Previous conversation context`

**Hydration on load:**

```
'ready' →  historyStore.load()
        →  post { type: 'historyLoaded', history }
        →  reducer: deserializeConversation() for each → Conversation[]
```

---

## Pipeline Step Pattern

Pre-processing steps that run before the CLI agent. Only `scan-project` mode has a pre-step today.

### Step contract

```typescript
export interface IPipelineStep {
  readonly label: string; // semantic key, NOT a display string
  execute(ctx: PipelineContext, emit: (e: NexusEvent) => void): Promise<void>;
}
```

### Adding a new pre-step

**Step 1** — Create the step file:

```typescript
// src/application/pipeline/MyStep.ts
import type { IPipelineStep } from "../../core/pipeline/IPipelineStep";
import type { PipelineContext } from "../../core/pipeline/PipelineContext";
import type { NexusEvent } from "../../core/events/IEventBus";

export class MyStep implements IPipelineStep {
  readonly label = "my-key"; // semantic key

  async execute(
    ctx: PipelineContext,
    emit: (e: NexusEvent) => void,
  ): Promise<void> {
    emit({
      kind: "activity_started",
      activityKind: "read",
      label: "Loading data...",
    });
    // enrich ctx here, e.g. ctx.projectMap = ...
    emit({
      kind: "activity_done",
      activityKind: "read",
      label: "Loading data...",
      status: "done",
    });
  }
}
```

**Step 2** — Register in `createPreSteps.ts`:

```typescript
case 'my-mode':
  return [new MyStep(deps.myDep)];
```

**Step 3** — Add i18n keys (see [i18n Rules](#i18n-rules)):

```json
"pipeline": { "steps": { "my-key": "My Step Label" } }
```

### Event order during execution

```
step_started  (index=0)     → creates AssistantMessage in UI
activity_started / done     → live sub-progress within that step
step_completed              → marks step ✓
step_started  (analyze)     → adds run-agent step to UI
task_started                → NO new message (already exists)
stdout / stderr             → streams into message.lines
task_completed              → isStreaming = false
step_completed (analyze)    → marks final step ✓
```

---

## Output Parser Pattern

Agents that emit structured progress (Claude Code, Codex) have a dedicated parser:

```typescript
// src/providers/claude/ClaudeOutputParser.ts
export class ClaudeOutputParser implements IOutputParser {
  parse(chunk: string): ParsedActivity[] {
    // parse ANSI-escaped lines → classify as edit/bash/read/write/etc.
    // return [] for lines that are plain output
  }
}
```

Parsers are registered on the agent:

```typescript
export class ClaudeAgent extends BaseAgent {
  readonly outputParser = new ClaudeOutputParser();
  ...
}
```

`RunAgentUseCase` checks `agent.outputParser` and, if present, pipes each stdout chunk through it. Parsed activities are emitted as `activity_started` / `activity_done` events, which the webview renders as sub-steps.

---

## Adding a New Agent

Follow these steps — nothing else changes.

**Step 1** — Add id to `AgentId` in `src/core/agent/AgentTask.ts` AND `ProviderId` in `src/core/types.ts`:

```typescript
export type AgentId = "..." | "mycli" | "auto";
export type ProviderId = "..." | "mycli" | "auto";
```

**Step 2** — Create the agent:

```typescript
// src/providers/myCli/MyCliAgent.ts
import { BaseAgent } from "../base/BaseAgent";
import { AgentCapabilities, AgentCommand } from "../../core/agent";
import type { AgentTask, AgentOutput } from "../../core/agent";
import type { ProviderModel } from "../../core/types";

export class MyCliAgent extends BaseAgent {
  readonly id = "mycli" as const;
  readonly displayName = "My CLI";
  readonly capabilities = new AgentCapabilities(true, false, false, true);
  readonly seededModels: ReadonlyArray<ProviderModel> = [
    { id: "model-a", label: "Model A", source: "seeded" },
  ];
  readonly defaultModel = "model-a";
  protected readonly executableName = "mycli";

  buildCommand(task: AgentTask): AgentCommand {
    const args = task.model
      ? ["--model", task.model, task.enhancedPrompt]
      : [task.enhancedPrompt];
    return new AgentCommand("mycli", args);
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: "text" };
  }
}
```

**Step 3** — Register in `src/extension.ts` (composition root):

```typescript
registry.register(new MyCliAgent());
```

**Step 4** — Add a `ProviderSpec` to the `SPECS` array in `src/core/providerDetector.ts`.

**Step 5** — Add id to the `all` array in `getProviderOptions()` in `src/webview-ui/components/AppToolbar.tsx` if a UI entry is needed.

---

## i18n Rules

> **CRITICAL**: Every user-visible string added to `src/webview-ui/` MUST be in both i18n files.

- `src/webview-ui/i18n/vi.json` — Vietnamese, **TypeScript type master** (`Messages = typeof vi`)
- `src/webview-ui/i18n/en.json` — English, must have identical key structure
- Missing key in `en.json` = TypeScript compile error
- Access via `const t = useT()` → `t.section.key`
- Interpolation: `interp(t.toolbar.history, { count: 3 })` for `{{count}}` placeholders

**Pipeline step labels** are semantic keys (e.g., `'scan'`), not translated strings. The frontend translates:

```typescript
const stepLabels = t.pipeline.steps as Record<string, string>;
const displayLabel = stepLabels[step.label] ?? step.label;
```

---

## VS Code Extension Best Practices

These apply to all code in this project.

### Activation and lifecycle

- **Activate lazily**: `activationEvents` in `package.json` should be as specific as possible. Avoid `*`.
- **Dispose everything**: commands, providers, event listeners must be pushed to `context.subscriptions`. `ChatController` has its own `dispose()` method chained from `ChatViewProvider`.
- **Composition root is `extension.ts`**: all `new ConcreteClass()` calls happen there. Use cases and controllers are never instantiated elsewhere.

### Webview communication

- **Typed protocol**: all messages go through `webviewProtocol.ts` (extension side) and `messages.ts` (webview side). Never use raw `any` in postMessage calls.
- **Never block the extension host**: webview message handlers are `async`. Heavy work (file scanning, process spawning) is awaited without blocking the VS Code UI thread.
- **`retainContextWhenHidden: true`**: preserves React state and avoids a full re-mount when the panel is hidden.
- **One-way security**: the webview cannot call VS Code APIs directly — it must always postMessage to the extension host.

### Process spawning

- Always use `spawn` with `shell: false` — never `exec` or `shell: true`.
- Always run `CommandGuard.validate(executable)` before spawning.
- Spawn with `cwd: workspaceRoot` so the CLI runs in the right directory.
- Set `TERM` and `COLORTERM` env vars so CLIs render ANSI output correctly.
- Implement `stop()` with SIGTERM → wait → SIGKILL; never leave zombie processes.

### State persistence

| What to persist                  | API                                          | Key                    |
| -------------------------------- | -------------------------------------------- | ---------------------- |
| User preferences (last provider) | `context.globalState`                        | `nexus.lastProvider`   |
| Conversation history             | `context.workspaceState`                     | `nexus.chatHistory.v1` |
| Provider/CLI config              | `vscode.workspace.getConfiguration('nexus')` | —                      |

- `globalState` = shared across all workspaces.
- `workspaceState` = scoped to the current workspace folder.
- Always wrap `Memento.get()` in try/catch — stored data may be corrupted or from an older version.

### Security

- `CommandGuard` blocks shell metacharacters on the executable name.
- Process args are passed as an array (never concatenated as a shell string).
- Webview `localResourceRoots` is locked to `media/`.
- Never embed secrets in webview HTML; read them from `getConfiguration` when needed.

### Performance

- `ProviderDetector` caches results for 30 s to avoid blocking PATH lookups on every UI render.
- `BaseAgent.isAvailable()` uses `spawnSync` with a 5 s timeout to prevent hangs.
- Stderr noise (stack traces, internal logs) is filtered before forwarding to avoid flooding the UI.
- Conversation history is trimmed to 50 entries and only the last 8 messages are passed as context.

### Testing

- Domain layer (`src/core/`) has zero external dependencies — unit test without mocks.
- Use case tests inject mock `IAgent`, `IProcessRunner`, `IEventBus`.
- Webview reducer tests use `vitest` without any VS Code or browser APIs.
- Never mock the filesystem in tests that need to verify actual file I/O — use real temp paths.

---

## Full File Tree

```
src/
├── core/                              ← Domain layer (zero I/O, zero VS Code)
│   ├── agent/
│   │   ├── IAgent.ts                  ← main contract (includes seededModels, outputParser)
│   │   ├── IOutputParser.ts           ← streaming output → ParsedActivity[]
│   │   ├── IDetectable.ts
│   │   ├── IStreamable.ts
│   │   ├── IStoppable.ts
│   │   ├── AgentCapabilities.ts
│   │   ├── AgentCommand.ts
│   │   ├── AgentTask.ts               ← AgentId, TaskMode, TaskStatus
│   │   ├── AgentResult.ts
│   │   ├── AgentOutput.ts
│   │   └── index.ts
│   ├── chat/
│   │   └── ChatHistory.ts             ← serializable history DTOs
│   ├── events/
│   │   └── IEventBus.ts
│   ├── pipeline/
│   │   ├── IPipelineStep.ts
│   │   └── PipelineContext.ts
│   ├── runner/
│   │   └── IProcessRunner.ts
│   ├── eventBus.ts                    ← EventBus implementation (wildcard '*' listener)
│   ├── providerDetector.ts            ← ProviderDetector, SPECS, 30s cache
│   └── types.ts                       ← ProviderId, TaskMode, ProviderModel, GitFileChange
│
├── application/                       ← Application layer (use cases)
│   ├── AgentRegistry.ts
│   ├── AgentRouter.ts
│   ├── pipeline/
│   │   ├── createPreSteps.ts          ← factory: mode → IPipelineStep[]
│   │   └── ScanProjectStep.ts
│   └── usecases/
│       ├── RunAgentUseCase.ts
│       ├── DetectAgentsUseCase.ts
│       ├── BuildProjectMapUseCase.ts
│       └── SummarizeProjectMapUseCase.ts
│
├── providers/                         ← Infrastructure: concrete agents
│   ├── base/
│   │   ├── BaseAgent.ts               ← cross-platform isAvailable(), abstract base
│   │   └── DefaultOutputParser.ts
│   ├── claude/
│   │   ├── ClaudeAgent.ts
│   │   └── ClaudeOutputParser.ts
│   ├── codex/
│   │   ├── CodexAgent.ts
│   │   └── CodexOutputParser.ts
│   ├── gemini/
│   │   ├── GeminiAgent.ts
│   │   └── GeminiOutputParser.ts
│   ├── copilot/
│   │   ├── CopilotAgent.ts
│   │   └── CopilotOutputParser.ts
│   ├── aider/
│   │   └── AiderAgent.ts
│   └── custom/
│       └── CustomAgent.ts             ← reads command from vscode.workspace.getConfiguration
│
├── runner/                            ← Infrastructure: process execution
│   ├── processRunner.ts               ← spawn/SIGTERM/SIGKILL, stderr noise filter
│   └── commandGuard.ts                ← rejects shell metacharacters
│
├── context/                           ← Infrastructure: workspace context
│   ├── promptBuilder.ts               ← buildEnhancedPrompt()
│   ├── workspaceScanner.ts
│   ├── packageDetector.ts
│   ├── rulesLoader.ts
│   └── project-map/                   ← file tree scanning + AI summary
│
├── output/                            ← Infrastructure: output normalization
│   ├── outputNormalizer.ts
│   └── parsers/
│       ├── claudeParser.ts
│       ├── codexParser.ts
│       ├── geminiParser.ts
│       └── genericParser.ts
│
├── git/                               ← Infrastructure: git integration
│   ├── gitStatus.ts
│   └── gitDiff.ts
│
├── webview/                           ← Interface: VS Code ↔ React bridge
│   ├── ChatController.ts              ← handles all WebviewMessages
│   ├── ChatViewProvider.ts            ← WebviewViewProvider
│   ├── ChatPanel.ts                   ← WebviewPanel (standalone panel)
│   ├── ChatHistoryStore.ts            ← workspaceState-backed history
│   ├── getHtml.ts
│   └── webviewProtocol.ts             ← typed ExtensionMessage / WebviewMessage
│
├── webview-ui/                        ← Interface: React app (built by Vite → media/webview/)
│   ├── App.tsx
│   ├── messages.ts                    ← AppState, reducer, serialization helpers
│   ├── vscodeApi.ts
│   ├── theme.ts
│   ├── components/
│   │   ├── AppToolbar.tsx
│   │   ├── Composer.tsx
│   │   ├── MessageList.tsx
│   │   ├── AssistantMessage.tsx
│   │   └── ConversationHistory.tsx
│   └── i18n/
│       ├── vi.json                    ← Vietnamese (type master)
│       ├── en.json                    ← English (must mirror vi.json structure)
│       └── index.ts                   ← useT(), interp()
│
├── settings/                          ← Interface: Settings + About webview panels
│   ├── SettingsPanel.ts
│   ├── SettingsHtml.ts
│   ├── AboutPanel.ts
│   └── AboutHtml.ts
│
├── config/                            ← Infrastructure: extension config
│   ├── ConfigService.ts
│   ├── DefaultConfig.ts
│   └── NexusConfig.ts
│
└── extension.ts                       ← Composition root (activate / deactivate)
```

---

## Build Commands

```bash
npm run compile              # TypeScript (tsc) + Vite — full build
npm run compile:extension    # TypeScript only (tsc -p ./)
npm run compile:webview      # Vite only → media/webview/
npm run watch                # TypeScript watch
npm run watch:webview        # Vite watch
npm run test:webview         # Vitest (reducer, parsers, domain)

# Package for distribution:
npx @vscode/vsce package --no-dependencies
code --install-extension nexus-code-<version>.vsix
```

**Before every commit**: `npm run compile` must exit zero errors.

**Webview build output** (`media/webview/`) is committed and packaged in the `.vsix`. Do not gitignore it.

---

## Key Invariants

1. **Domain layer has zero external imports** — `src/core/` never imports Node.js, VS Code API, or any npm package.
2. **`extension.ts` is the only composition root** — all `new ConcreteClass()` calls happen there.
3. **`BaseAgent.isAvailable()` never throws** — always returns `boolean` so `AgentRouter` can safely iterate candidates.
4. **Value objects are immutable** — `AgentCapabilities`, `AgentCommand`, `AgentResult` have no setters.
5. **`AgentId` and `ProviderId` must have identical values** — `AgentTask.ts` and `core/types.ts` must stay in sync.
6. **Pipeline step `label` is a semantic key**, never a translated string — the frontend translates via `t.pipeline.steps[label]`.
7. **`shell: false` in all `spawn` calls** — never allow shell interpolation of user-controlled strings.
8. **i18n: `vi.json` is the TypeScript type master** — add every new key to both files or the webview build fails.
9. **`saveKey` drives autosave** — increment it on task-end and conversation mutations; never on `tick`.
10. **Streaming assistant messages are not serialized** — `serializeHistory()` skips messages where `isStreaming === true`.
