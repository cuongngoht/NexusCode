# NexusCode — Agent Architecture

Common design blueprint for all agents in NexusCode. Every agent — current and future — must follow this contract.

---

## Table of Contents

1. [Overview](#overview)
2. [Clean Architecture Layers](#clean-architecture-layers)
3. [Domain Layer — Files](#domain-layer--files)
4. [Application Layer — Files](#application-layer--files)
5. [Infrastructure Layer — Files](#infrastructure-layer--files)
6. [Interface Layer — Files](#interface-layer--files)
7. [SOLID Principles Applied](#solid-principles-applied)
8. [Class Hierarchy](#class-hierarchy)
9. [Agent Lifecycle](#agent-lifecycle)
10. [Adding a New Agent](#adding-a-new-agent)
11. [Full File Tree](#full-file-tree)

---

## Overview

NexusCode routes user prompts to CLI-based coding agents (Claude, Codex, Gemini, etc.).
The agent system follows **Clean Architecture** so each layer is independently testable and replaceable.
**SOLID principles** enforce a stable contract that lets any agent be swapped, extended, or combined without touching unrelated code.

```text
┌─────────────────────────────────────────────────┐
│                Interface Layer                  │  ← VS Code Webview / UI
├─────────────────────────────────────────────────┤
│               Application Layer                 │  ← Use Cases, Router, Registry
├─────────────────────────────────────────────────┤
│                 Domain Layer                    │  ← Interfaces, Entities, Value Objects
├─────────────────────────────────────────────────┤
│              Infrastructure Layer               │  ← Concrete Agents, Process Runner
└─────────────────────────────────────────────────┘
           dependency arrows point inward only
```

**Dependency rule**: outer layers depend on inner layers. Inner layers never import outer layers.

---

## Clean Architecture Layers

| Layer | Location | Responsibility |
| --- | --- | --- |
| Domain | `src/core/` | Contracts, entities, value objects — no I/O |
| Application | `src/application/` | Use cases, orchestration, routing |
| Infrastructure | `src/providers/` | Concrete agents, process execution |
| Interface | `src/webview/` + `src/webview-ui/` | VS Code API, React UI |

---

## Domain Layer — Files

Contains only **interfaces**, **entities**, and **value objects**.
Zero dependencies on Node.js I/O, VS Code API, or any external library.

---

### `src/core/agent/IAgent.ts`

The core contract every agent must satisfy.

```typescript
export interface IAgent {
  readonly id: AgentId
  readonly displayName: string
  readonly capabilities: AgentCapabilities

  isAvailable(): Promise<boolean>
  buildCommand(task: AgentTask): AgentCommand
  parseOutput(raw: string): AgentOutput
}
```

---

### `src/core/agent/IDetectable.ts`

Separate detection contract — not all agents need custom detection logic.

```typescript
export interface IDetectable {
  detect(): Promise<DetectionResult>
}
```

---

### `src/core/agent/IStreamable.ts`

For agents that produce incremental output.

```typescript
export interface IStreamable {
  onStdout(handler: (chunk: string) => void): void
  onStderr(handler: (chunk: string) => void): void
  onComplete(handler: (result: AgentResult) => void): void
}
```

---

### `src/core/agent/IStoppable.ts`

For agents that support mid-task cancellation.

```typescript
export interface IStoppable {
  stop(): Promise<void>
}
```

> **Interface Segregation (ISP)**: each interface has exactly one responsibility.
> A read-only research agent implements `IAgent` only.
> A long-running file editor additionally implements `IStreamable + IStoppable`.

---

### `src/core/agent/AgentCapabilities.ts`

Immutable value object describing what an agent can do.

```typescript
export class AgentCapabilities {
  constructor(
    readonly canEditFiles: boolean,
    readonly canRunShell: boolean,
    readonly canSearchWeb: boolean,
    readonly supportsStreaming: boolean,
  ) {}

  static none(): AgentCapabilities {
    return new AgentCapabilities(false, false, false, false)
  }

  supports(required: Partial<AgentCapabilities>): boolean {
    return Object.entries(required).every(
      ([key, val]) => (this as Record<string, unknown>)[key] === val,
    )
  }
}
```

---

### `src/core/agent/AgentCommand.ts`

Immutable value object representing a shell command to run.

```typescript
export class AgentCommand {
  constructor(
    readonly executable: string,
    readonly args: ReadonlyArray<string>,
    readonly env?: Readonly<Record<string, string>>,
  ) {}
}
```

---

### `src/core/agent/AgentResult.ts`

Immutable value object holding the outcome of a completed task.

```typescript
export class AgentResult {
  constructor(
    readonly exitCode: number,
    readonly stdout: string,
    readonly stderr: string,
    readonly durationMs: number,
  ) {}

  get succeeded(): boolean {
    return this.exitCode === 0
  }
}
```

---

### `src/core/agent/AgentTask.ts`

Entity with identity. Owns its own state transitions.

```typescript
export type AgentId    = 'claude' | 'codex' | 'gemini' | 'copilot' | 'aider' | 'custom' | 'auto'
export type TaskMode   = 'edit' | 'debug' | 'test' | 'refactor' | 'research' | 'ask'
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

export class AgentTask {
  readonly id: string
  readonly startedAt: number
  private _status: TaskStatus = 'pending'
  private _result?: AgentResult

  constructor(
    readonly prompt: string,
    readonly enhancedPrompt: string,
    readonly agentId: AgentId,
    readonly mode: TaskMode,
  ) {
    this.id = `task_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
    this.startedAt = Date.now()
  }

  get status(): TaskStatus          { return this._status }
  get result(): AgentResult | undefined { return this._result }

  start():  void { this._status = 'running' }
  cancel(): void { this._status = 'cancelled' }

  complete(result: AgentResult): void {
    this._result = result
    this._status = result.succeeded ? 'completed' : 'failed'
  }
}
```

---

### `src/core/agent/index.ts`

Barrel export — all domain types come from one import path.

```typescript
export type { IAgent }       from './IAgent'
export type { IDetectable }  from './IDetectable'
export type { IStreamable }  from './IStreamable'
export type { IStoppable }   from './IStoppable'
export { AgentCapabilities } from './AgentCapabilities'
export { AgentCommand }      from './AgentCommand'
export { AgentResult }       from './AgentResult'
export { AgentTask }         from './AgentTask'
export type { AgentId, TaskMode, TaskStatus } from './AgentTask'
```

---

### `src/core/events/IEventBus.ts`

Decouples task execution from the UI.

```typescript
export type NexusEvent =
  | { kind: 'task_started';   task: AgentTask }
  | { kind: 'stdout';         task: AgentTask; chunk: string }
  | { kind: 'stderr';         task: AgentTask; chunk: string }
  | { kind: 'task_completed'; task: AgentTask; result: AgentResult }
  | { kind: 'task_error';     task: AgentTask; error: string }
  | { kind: 'git_status';     output: string }

export interface IEventBus {
  emit(event: NexusEvent): void
  on(kind: NexusEvent['kind'], handler: (event: NexusEvent) => void): void
  off(kind: NexusEvent['kind'], handler: (event: NexusEvent) => void): void
}
```

---

### `src/core/runner/IProcessRunner.ts`

Abstracts process spawning so use cases never touch Node.js directly.

```typescript
export interface RunOptions {
  onStdout?: (chunk: string) => void
  onStderr?: (chunk: string) => void
}

export interface IProcessRunner {
  run(command: AgentCommand, options?: RunOptions): Promise<AgentResult>
  stop(): Promise<void>
}
```

---

## Application Layer — Files

Orchestrates domain objects. No knowledge of how agents are implemented or how output is displayed.

---

### `src/application/AgentRegistry.ts`

Stores and retrieves agent instances by id.

```typescript
import type { IAgent, AgentId } from '../core/agent'

export class AgentRegistry {
  private readonly agents = new Map<AgentId, IAgent>()

  register(agent: IAgent): void {
    if (this.agents.has(agent.id)) {
      throw new Error(`Agent '${agent.id}' is already registered`)
    }
    this.agents.set(agent.id, agent)
  }

  get(id: AgentId): IAgent {
    const agent = this.agents.get(id)
    if (!agent) throw new Error(`Agent '${id}' not found`)
    return agent
  }

  getAll(): ReadonlyArray<IAgent> {
    return [...this.agents.values()]
  }
}
```

---

### `src/application/AgentRouter.ts`

Picks the best available agent for a given mode and required capabilities.

```typescript
import type { IAgent, AgentId, TaskMode, AgentCapabilities } from '../core/agent'
import { AgentRegistry } from './AgentRegistry'

const CAPABILITY_BY_MODE: Record<TaskMode, Partial<AgentCapabilities>> = {
  research: { canSearchWeb: true },
  ask:      { canSearchWeb: true },
  edit:     { canEditFiles: true },
  debug:    { canRunShell: true },
  test:     { canRunShell: true },
  refactor: { canEditFiles: true },
}

export class AgentRouter {
  constructor(private readonly registry: AgentRegistry) {}

  async resolve(agentId: AgentId, mode: TaskMode): Promise<IAgent> {
    if (agentId !== 'auto') {
      const agent = this.registry.get(agentId)
      if (await agent.isAvailable()) return agent
      throw new Error(`Agent '${agentId}' is not available`)
    }

    const required  = CAPABILITY_BY_MODE[mode]
    const available = await this.findAvailable(required)
    if (!available) throw new Error(`No agent available for mode '${mode}'`)
    return available
  }

  private async findAvailable(
    required: Partial<AgentCapabilities>,
  ): Promise<IAgent | undefined> {
    const candidates = this.registry
      .getAll()
      .filter(a => a.capabilities.supports(required))

    for (const agent of candidates) {
      if (await agent.isAvailable()) return agent
    }
    return undefined
  }
}
```

---

### `src/application/usecases/RunAgentUseCase.ts`

Single entry point for executing one task end-to-end.

```typescript
import type { AgentTask, AgentResult } from '../../core/agent'
import type { IEventBus }              from '../../core/events'
import type { IProcessRunner }         from '../../core/runner'
import { AgentRouter }                 from '../AgentRouter'

export class RunAgentUseCase {
  constructor(
    private readonly router:   AgentRouter,
    private readonly runner:   IProcessRunner,
    private readonly eventBus: IEventBus,
  ) {}

  async execute(task: AgentTask): Promise<AgentResult> {
    const agent   = await this.router.resolve(task.agentId, task.mode)
    const command = agent.buildCommand(task)

    task.start()
    this.eventBus.emit({ kind: 'task_started', task })

    try {
      const result = await this.runner.run(command, {
        onStdout: chunk => this.eventBus.emit({ kind: 'stdout', task, chunk }),
        onStderr: chunk => this.eventBus.emit({ kind: 'stderr', task, chunk }),
      })

      task.complete(result)
      this.eventBus.emit({ kind: 'task_completed', task, result })
      return result

    } catch (error) {
      task.cancel()
      this.eventBus.emit({ kind: 'task_error', task, error: String(error) })
      throw error
    }
  }
}
```

---

### `src/application/usecases/DetectAgentsUseCase.ts`

Discovers which agents are installed on the user's machine.

```typescript
import type { AgentId }  from '../../core/agent'
import { AgentRegistry } from '../AgentRegistry'

export interface DetectedAgent {
  id:          AgentId
  displayName: string
  available:   boolean
}

export class DetectAgentsUseCase {
  constructor(private readonly registry: AgentRegistry) {}

  async execute(): Promise<DetectedAgent[]> {
    const results = await Promise.allSettled(
      this.registry.getAll().map(async agent => ({
        id:          agent.id,
        displayName: agent.displayName,
        available:   await agent.isAvailable(),
      })),
    )

    return results
      .filter((r): r is PromiseFulfilledResult<DetectedAgent> => r.status === 'fulfilled')
      .map(r => r.value)
  }
}
```

---

## Infrastructure Layer — Files

Concrete implementations. Depends on domain interfaces; never imported by application or domain layers.

---

### `src/providers/base/BaseAgent.ts`

Abstract base — shared `isAvailable()` logic. Subclasses override only what differs.

```typescript
import type {
  IAgent, AgentId, AgentTask, AgentCommand, AgentOutput, AgentCapabilities,
} from '../../core/agent'
import { exec }     from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export abstract class BaseAgent implements IAgent {
  abstract readonly id:           AgentId
  abstract readonly displayName:  string
  abstract readonly capabilities: AgentCapabilities

  protected abstract get executableName(): string
  abstract buildCommand(task: AgentTask): AgentCommand
  abstract parseOutput(raw: string):      AgentOutput

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync(`which ${this.executableName}`)
      return true
    } catch {
      return false
    }
  }
}
```

> **Open/Closed (OCP)**: `BaseAgent` is closed for modification.
> Adding a new agent only requires a new subclass — zero changes to existing code.

---

### `src/providers/claude/ClaudeAgent.ts`

```typescript
import { BaseAgent }                                          from '../base/BaseAgent'
import { AgentCapabilities, AgentCommand, AgentTask, AgentOutput } from '../../core/agent'

export class ClaudeAgent extends BaseAgent {
  readonly id           = 'claude' as const
  readonly displayName  = 'Claude (Anthropic)'
  readonly capabilities = new AgentCapabilities(
    /* canEditFiles      */ true,
    /* canRunShell       */ true,
    /* canSearchWeb      */ false,
    /* supportsStreaming */ true,
  )

  protected get executableName() { return 'claude' }

  buildCommand(task: AgentTask): AgentCommand {
    return new AgentCommand('claude', [task.enhancedPrompt])
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' }
  }
}
```

---

### `src/providers/codex/CodexAgent.ts`

```typescript
import { BaseAgent }                                          from '../base/BaseAgent'
import { AgentCapabilities, AgentCommand, AgentTask, AgentOutput } from '../../core/agent'

export class CodexAgent extends BaseAgent {
  readonly id           = 'codex' as const
  readonly displayName  = 'Codex (OpenAI)'
  readonly capabilities = new AgentCapabilities(true, true, false, true)

  protected get executableName() { return 'codex' }

  buildCommand(task: AgentTask): AgentCommand {
    return new AgentCommand('codex', [task.enhancedPrompt])
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' }
  }
}
```

---

### `src/providers/gemini/GeminiAgent.ts`

```typescript
import { BaseAgent }                                          from '../base/BaseAgent'
import { AgentCapabilities, AgentCommand, AgentTask, AgentOutput } from '../../core/agent'

export class GeminiAgent extends BaseAgent {
  readonly id           = 'gemini' as const
  readonly displayName  = 'Gemini (Google)'
  readonly capabilities = new AgentCapabilities(
    /* canEditFiles      */ true,
    /* canRunShell       */ false,
    /* canSearchWeb      */ true,
    /* supportsStreaming */ true,
  )

  protected get executableName() { return 'gemini' }

  buildCommand(task: AgentTask): AgentCommand {
    const args = ['--prompt', task.enhancedPrompt]
    if (this.capabilities.canSearchWeb) args.push('--web')
    return new AgentCommand('gemini', args)
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' }
  }
}
```

---

### `src/providers/copilot/CopilotAgent.ts`

```typescript
import { BaseAgent }                                          from '../base/BaseAgent'
import { AgentCapabilities, AgentCommand, AgentTask, AgentOutput } from '../../core/agent'

export class CopilotAgent extends BaseAgent {
  readonly id           = 'copilot' as const
  readonly displayName  = 'Copilot (GitHub)'
  readonly capabilities = new AgentCapabilities(true, false, false, true)

  protected get executableName() { return 'copilot' }

  buildCommand(task: AgentTask): AgentCommand {
    return new AgentCommand('copilot', [task.enhancedPrompt])
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'markdown' }
  }
}
```

---

### `src/providers/aider/AiderAgent.ts`

```typescript
import { BaseAgent }                                          from '../base/BaseAgent'
import { AgentCapabilities, AgentCommand, AgentTask, AgentOutput } from '../../core/agent'

export class AiderAgent extends BaseAgent {
  readonly id           = 'aider' as const
  readonly displayName  = 'Aider'
  readonly capabilities = new AgentCapabilities(true, true, false, true)

  protected get executableName() { return 'aider' }

  buildCommand(task: AgentTask): AgentCommand {
    return new AgentCommand('aider', ['--message', task.enhancedPrompt])
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'text' }
  }
}
```

---

### `src/providers/custom/CustomAgent.ts`

Reads command + args from VS Code settings at runtime.

```typescript
import * as vscode                                            from 'vscode'
import { BaseAgent }                                          from '../base/BaseAgent'
import { AgentCapabilities, AgentCommand, AgentTask, AgentOutput } from '../../core/agent'

export class CustomAgent extends BaseAgent {
  readonly id           = 'custom' as const
  readonly displayName  = 'Custom'
  readonly capabilities = new AgentCapabilities(true, true, false, true)

  protected get executableName(): string {
    return vscode.workspace.getConfiguration('nexus').get<string>('customProvider.command') ?? ''
  }

  buildCommand(task: AgentTask): AgentCommand {
    const cfg      = vscode.workspace.getConfiguration('nexus')
    const command  = cfg.get<string>('customProvider.command') ?? ''
    const template = cfg.get<string[]>('customProvider.args') ?? ['{{prompt}}']
    const args     = template.map(a => a.replace('{{prompt}}', task.enhancedPrompt))
    return new AgentCommand(command, args)
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'text' }
  }
}
```

---

## Interface Layer — Files

Consumes application-layer use cases. Handles VS Code API calls and React UI events.

---

### `src/webview/ChatController.ts` (simplified)

Bridges VS Code webview messages to application use cases.

```typescript
import { RunAgentUseCase }     from '../application/usecases/RunAgentUseCase'
import { DetectAgentsUseCase } from '../application/usecases/DetectAgentsUseCase'
import { AgentTask }           from '../core/agent'
import type { IEventBus }      from '../core/events'
import { PromptBuilder }       from '../context/PromptBuilder'

export class ChatController {
  constructor(
    private readonly runAgent:      RunAgentUseCase,
    private readonly detectAgents:  DetectAgentsUseCase,
    private readonly promptBuilder: PromptBuilder,
    private readonly eventBus:      IEventBus,
  ) {}

  async handleRunTask(message: RunTaskMessage): Promise<void> {
    const enhanced = await this.promptBuilder.build(message.prompt, message.mode)
    const task     = new AgentTask(message.prompt, enhanced, message.provider, message.mode)
    await this.runAgent.execute(task)
  }

  async handleReady(): Promise<void> {
    const agents = await this.detectAgents.execute()
    this.postMessage({ type: 'availableProviders', providers: agents })
  }

  private postMessage(msg: unknown): void { /* postMessage to webview */ }
}
```

> **Dependency Inversion (DIP)**: `ChatController` never imports `ClaudeAgent` or `GeminiAgent` directly.
> It depends on `RunAgentUseCase`, which depends on `IAgent`.
> Concrete agents are injected at startup in `extension.ts`.

---

### `src/extension.ts` — Composition Root

The only place where `new ConcreteClass()` is called.

```typescript
import * as vscode            from 'vscode'
import { AgentRegistry }      from './application/AgentRegistry'
import { AgentRouter }        from './application/AgentRouter'
import { RunAgentUseCase }    from './application/usecases/RunAgentUseCase'
import { DetectAgentsUseCase } from './application/usecases/DetectAgentsUseCase'
import { ClaudeAgent }        from './providers/claude/ClaudeAgent'
import { CodexAgent }         from './providers/codex/CodexAgent'
import { GeminiAgent }        from './providers/gemini/GeminiAgent'
import { CopilotAgent }       from './providers/copilot/CopilotAgent'
import { AiderAgent }         from './providers/aider/AiderAgent'
import { CustomAgent }        from './providers/custom/CustomAgent'
import { ProcessRunner }      from './runner/ProcessRunner'
import { EventBus }           from './core/events/EventBus'
import { ChatController }     from './webview/ChatController'
import { PromptBuilder }      from './context/PromptBuilder'

export function activate(context: vscode.ExtensionContext): void {
  const registry = new AgentRegistry()
  registry.register(new ClaudeAgent())
  registry.register(new CodexAgent())
  registry.register(new GeminiAgent())
  registry.register(new CopilotAgent())
  registry.register(new AiderAgent())
  registry.register(new CustomAgent())

  const eventBus      = new EventBus()
  const runner        = new ProcessRunner()
  const router        = new AgentRouter(registry)
  const runUseCase    = new RunAgentUseCase(router, runner, eventBus)
  const detectUseCase = new DetectAgentsUseCase(registry)
  const builder       = new PromptBuilder()

  const controller = new ChatController(runUseCase, detectUseCase, builder, eventBus)
  // ... register controller with ChatViewProvider
}
```

---

## SOLID Principles Applied

### S — Single Responsibility

| Class | Single Responsibility |
| --- | --- |
| `IAgent` | Declares the agent contract |
| `AgentRegistry` | Stores and retrieves agent instances |
| `AgentRouter` | Picks the right agent for a task |
| `RunAgentUseCase` | Executes one task end-to-end |
| `DetectAgentsUseCase` | Discovers available agents |
| `BaseAgent` | Shared detection and lifecycle logic |
| `ClaudeAgent` | Claude-specific command construction |
| `ChatController` | Bridges VS Code messages to use cases |

### O — Open/Closed

Adding a new agent requires:

1. Create `src/providers/<name>/<Name>Agent.ts` extending `BaseAgent`
2. Register it in `extension.ts`

No changes to `AgentRouter`, `AgentRegistry`, `RunAgentUseCase`, or any existing agent.

### L — Liskov Substitution

`AgentRouter.resolve()` returns `IAgent`. The caller never needs to know the concrete class. Every `BaseAgent` subclass:

- Always returns a valid `AgentCommand` from `buildCommand()`
- Always returns a `boolean` from `isAvailable()` — never throws
- Never adds required arguments beyond what `IAgent` declares

### I — Interface Segregation

```text
IAgent       ← isAvailable, buildCommand, parseOutput
IDetectable  ← detect()
IStreamable  ← onStdout, onStderr, onComplete
IStoppable   ← stop()
```

A simple one-shot agent implements only `IAgent`. A long-running interactive agent also implements `IStreamable + IStoppable`. No agent is forced to implement methods it does not need.

### D — Dependency Inversion

```text
extension.ts  (composition root)
  │
  ├── creates ClaudeAgent, GeminiAgent, ...  ← concrete
  ├── registers them in AgentRegistry        ← concrete
  │
  └── injects into RunAgentUseCase           ← depends on IAgent via Registry
        └── injected into ChatController     ← depends on RunAgentUseCase
```

`ChatController` and `RunAgentUseCase` are tested by injecting mock agents — no real processes spawned.

---

## Class Hierarchy

```text
IAgent (interface)
 └── BaseAgent (abstract)
      ├── ClaudeAgent
      ├── CodexAgent
      ├── GeminiAgent
      ├── CopilotAgent
      ├── AiderAgent
      └── CustomAgent

IDetectable (interface)
 └── BaseAgent (partial implementation)

IStreamable (interface)
 └── RunAgentUseCase (wraps ProcessRunner streams)

IStoppable (interface)
 └── RunAgentUseCase (calls ProcessRunner.stop)
```

---

## Agent Lifecycle

```text
User Input
    │
    ▼
ChatController.handleRunTask()
    ├── PromptBuilder.build()           → enriches prompt with workspace context
    └── new AgentTask(...)              → entity, status = 'pending'
    │
    ▼
RunAgentUseCase.execute(task)
    ├── AgentRouter.resolve()           → picks available IAgent for mode
    ├── agent.buildCommand(task)        → AgentCommand (value object)
    ├── task.start()                    → status = 'running'
    ├── eventBus.emit('task_started')
    │
    ▼
ProcessRunner.run(command)
    ├── onStdout → eventBus.emit('stdout') → UI streams live output
    └── onStderr → eventBus.emit('stderr')
    │
    ▼
Process exits
    ├── task.complete(result)           → status = 'completed' | 'failed'
    ├── eventBus.emit('task_completed')
    └── optional: GitStatus → eventBus.emit('git_status')
```

---

## Adding a New Agent

Follow these 6 steps. Nothing else changes.

**Step 1** — Add id to `AgentId` in `src/core/agent/AgentTask.ts`:

```typescript
export type AgentId = 'claude' | 'codex' | ... | 'mycli' | 'auto'
```

**Step 2** — Create the agent file:

```typescript
// src/providers/myCli/MyCliAgent.ts

import { BaseAgent }       from '../base/BaseAgent'
import { AgentCapabilities, AgentCommand, AgentTask } from '../../core/agent'
import type { AgentOutput } from '../../core/agent'
import type { ProviderModel } from '../../core/types'

export class MyCliAgent extends BaseAgent {
  readonly id           = 'mycli' as const
  readonly displayName  = 'My CLI'
  readonly capabilities = new AgentCapabilities(true, false, false, true)
  readonly seededModels: ReadonlyArray<ProviderModel> = [
    { id: 'model-a', label: 'Model A', source: 'seeded' },
  ]
  readonly defaultModel = 'model-a'

  protected readonly executableName = 'mycli'

  buildCommand(task: AgentTask): AgentCommand {
    const args = task.model
      ? ['--model', task.model, task.enhancedPrompt]
      : [task.enhancedPrompt]
    return new AgentCommand('mycli', args)
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'text' }
  }
}
```

**Step 3** — Register in `src/extension.ts`:

```typescript
import { MyCliAgent } from './providers/myCli/MyCliAgent'

registry.register(new MyCliAgent())
```

**Step 4** — Add id to `ProviderId` in `src/webview-ui/messages.ts` (mirrors `AgentId`).

**Step 5** — Add id to the `all` array in `getProviderOptions()` inside `src/webview-ui/components/AppToolbar.tsx`.

**Step 6** — Add a `ProviderSpec` entry in `src/core/providerDetector.ts` (`SPECS` array) for version detection and model listing in the UI.

---

## Full File Tree

```text
src/
├── core/                              ← Domain layer (zero I/O)
│   ├── agent/
│   │   ├── IAgent.ts
│   │   ├── IDetectable.ts
│   │   ├── IStreamable.ts
│   │   ├── IStoppable.ts
│   │   ├── AgentCapabilities.ts
│   │   ├── AgentCommand.ts
│   │   ├── AgentTask.ts
│   │   ├── AgentResult.ts
│   │   ├── AgentOutput.ts
│   │   └── index.ts
│   ├── events/
│   │   ├── IEventBus.ts
│   │   └── EventBus.ts
│   └── runner/
│       └── IProcessRunner.ts
│
├── application/                       ← Application layer (use cases)
│   ├── AgentRegistry.ts
│   ├── AgentRouter.ts
│   └── usecases/
│       ├── RunAgentUseCase.ts
│       └── DetectAgentsUseCase.ts
│
├── providers/                         ← Infrastructure layer (concrete agents)
│   ├── base/
│   │   └── BaseAgent.ts
│   ├── claude/
│   │   └── ClaudeAgent.ts
│   ├── codex/
│   │   └── CodexAgent.ts
│   ├── gemini/
│   │   └── GeminiAgent.ts
│   ├── copilot/
│   │   └── CopilotAgent.ts
│   ├── aider/
│   │   └── AiderAgent.ts
│   └── custom/
│       └── CustomAgent.ts
│
├── runner/                            ← Infrastructure layer (process execution)
│   ├── ProcessRunner.ts
│   └── commandGuard.ts
│
├── context/                           ← Infrastructure layer (workspace context)
│   ├── PromptBuilder.ts
│   ├── WorkspaceScanner.ts
│   ├── PackageDetector.ts
│   └── RulesLoader.ts
│
├── webview/                           ← Interface layer (VS Code bridge)
│   ├── ChatController.ts
│   ├── ChatViewProvider.ts
│   └── webviewProtocol.ts
│
├── webview-ui/                        ← Interface layer (React UI)
│   ├── App.tsx
│   └── components/
│
└── extension.ts                       ← Composition root
```

---

## Design Rules

1. **Domain types never import from infrastructure.** `IAgent`, `AgentTask`, `AgentCapabilities` have zero external dependencies.
2. **Use cases depend on interfaces, never concrete classes.** `RunAgentUseCase` knows `IAgent`, not `ClaudeAgent`.
3. **`extension.ts` is the only composition root.** All `new ConcreteClass()` calls happen there.
4. **Value objects are immutable.** `AgentCapabilities`, `AgentCommand`, `AgentResult` have no setters.
5. **Entities own their state transitions.** Only `AgentTask` can call its own `start()`, `complete()`, `cancel()`.
6. **One use case = one public method.** `RunAgentUseCase.execute()`, `DetectAgentsUseCase.execute()`.
7. **No agent knows about another agent.** Routing is the router's job, not the agent's.
8. **`BaseAgent.isAvailable()` never throws.** Returns `false` on any error so the router safely tries the next candidate.

---

## Build Commands

```bash
npm run compile              # TypeScript + Vite (full build)
npm run compile:extension    # TypeScript only
npm run compile:webview      # Vite only
npm run watch                # TypeScript watch
npm run watch:webview        # Vite watch
npm run test:webview         # Vitest

npx @vscode/vsce package --no-dependencies   # produce .vsix
code --install-extension nexus-visual-code-<version>.vsix
```

Always run `npm run compile` and confirm zero errors before packaging.

---

## Key Conventions

- `AgentId` (`src/core/agent/AgentTask.ts`) and `ProviderId` (`src/core/types.ts` + `src/webview-ui/messages.ts`) must have identical values — keep them in sync
- `BaseAgent.isAvailable()` uses cross-platform `which`/`where` via `spawnSync` — never throws, returns `false` on error
- `ProcessRunner` accepts callbacks (`onStdout`, `onStderr`) and returns `AgentResult` — never imports the event bus directly
- `RunAgentUseCase` owns all task lifecycle events: `task_started → stdout/stderr → task_completed/task_stopped/task_error`
- `CommandGuard.validate()` runs before every spawn — rejects shell metacharacters `; & | $ < > \ !`
- Domain layer (`src/core/agent/`) has zero external dependencies — no Node.js I/O, no VS Code API
- `extension.ts` is the only composition root — all `new ConcreteClass()` calls happen there
- The webview build output goes to `media/webview/` — this directory is committed and packaged in the .vsix
- VS Code settings namespace: `nexus.*`
