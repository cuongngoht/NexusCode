# NexusCode — Agent Architecture

Common design blueprint for all agents in NexusCode. Every agent — current and future — must follow this contract.

---

## Table of Contents

1. [Overview](#overview)
2. [Clean Architecture Layers](#clean-architecture-layers)
3. [Domain Layer](#domain-layer)
4. [Application Layer](#application-layer)
5. [Infrastructure Layer](#infrastructure-layer)
6. [Interface Layer](#interface-layer)
7. [SOLID Principles Applied](#solid-principles-applied)
8. [Class Hierarchy](#class-hierarchy)
9. [Agent Lifecycle](#agent-lifecycle)
10. [Adding a New Agent](#adding-a-new-agent)
11. [File Structure](#file-structure)

---

## Overview

NexusCode routes user prompts to CLI-based coding agents (Claude, Codex, Gemini, etc.). The agent system follows **Clean Architecture** so each layer is independently testable and replaceable. **SOLID principles** enforce a stable contract that lets any agent be swapped, extended, or combined without touching unrelated code.

```
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
|-------|----------|----------------|
| Domain | `src/core/` | Contracts, entities, value objects — no I/O |
| Application | `src/application/` | Use cases, orchestration, routing |
| Infrastructure | `src/providers/` | Concrete agents, process execution |
| Interface | `src/webview/` `src/webview-ui/` | VS Code API, React UI |

---

## Domain Layer

Contains only **interfaces**, **entities**, and **value objects**. Zero dependencies on Node.js I/O, VS Code API, or any external library.

### `IAgent` — Core Contract

```typescript
// src/core/agent/IAgent.ts

export interface IAgent {
  readonly id: AgentId
  readonly displayName: string
  readonly capabilities: AgentCapabilities

  isAvailable(): Promise<boolean>
  buildCommand(task: AgentTask): AgentCommand
  parseOutput(raw: string): AgentOutput
}
```

### `IDetectable` — Detection Contract

```typescript
// src/core/agent/IDetectable.ts

export interface IDetectable {
  detect(): Promise<DetectionResult>
}
```

### `IStreamable` — Streaming Contract

```typescript
// src/core/agent/IStreamable.ts

export interface IStreamable {
  onStdout(handler: (chunk: string) => void): void
  onStderr(handler: (chunk: string) => void): void
  onComplete(handler: (result: AgentResult) => void): void
}
```

### `IStoppable` — Cancellation Contract

```typescript
// src/core/agent/IStoppable.ts

export interface IStoppable {
  stop(): Promise<void>
}
```

> **Interface Segregation (ISP)**: Each interface has exactly one responsibility. An agent implements only the interfaces that match its capabilities. A read-only research agent implements `IAgent + IDetectable`; a long-running file editor additionally implements `IStreamable + IStoppable`.

---

### Value Objects

Value objects are immutable and compared by value, not reference.

```typescript
// src/core/agent/AgentCapabilities.ts

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

```typescript
// src/core/agent/AgentCommand.ts

export class AgentCommand {
  constructor(
    readonly executable: string,
    readonly args: ReadonlyArray<string>,
    readonly env?: Readonly<Record<string, string>>,
  ) {}
}
```

```typescript
// src/core/agent/AgentResult.ts

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

### Entities

Entities have identity and mutable state.

```typescript
// src/core/agent/AgentTask.ts

export type AgentId = 'claude' | 'codex' | 'gemini' | 'copilot' | 'aider' | 'custom' | 'auto'
export type TaskMode = 'edit' | 'debug' | 'test' | 'refactor' | 'research' | 'ask'
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

  get status(): TaskStatus { return this._status }
  get result(): AgentResult | undefined { return this._result }

  start(): void { this._status = 'running' }
  cancel(): void { this._status = 'cancelled' }
  complete(result: AgentResult): void {
    this._result = result
    this._status = result.succeeded ? 'completed' : 'failed'
  }
}
```

---

## Application Layer

Orchestrates domain objects. Has **no knowledge** of how agents are implemented or how output is displayed.

### `AgentRegistry`

```typescript
// src/application/AgentRegistry.ts

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

### `AgentRouter`

Routes tasks to the best available agent for a given mode and capability set.

```typescript
// src/application/AgentRouter.ts

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

    const required = CAPABILITY_BY_MODE[mode]
    const available = await this.findAvailable(required)
    if (!available) throw new Error(`No agent available for mode '${mode}'`)
    return available
  }

  private async findAvailable(
    required: Partial<AgentCapabilities>,
  ): Promise<IAgent | undefined> {
    const candidates = this.registry.getAll().filter(a =>
      a.capabilities.supports(required),
    )

    for (const agent of candidates) {
      if (await agent.isAvailable()) return agent
    }
    return undefined
  }
}
```

### `RunAgentUseCase`

The single entry point for executing a task. Orchestrates detection, routing, execution, and event emission.

```typescript
// src/application/usecases/RunAgentUseCase.ts

import type { AgentTask, AgentResult } from '../../core/agent'
import type { IEventBus } from '../../core/events'
import type { IProcessRunner } from '../../core/runner'
import { AgentRouter } from '../AgentRouter'

export class RunAgentUseCase {
  constructor(
    private readonly router: AgentRouter,
    private readonly runner: IProcessRunner,
    private readonly eventBus: IEventBus,
  ) {}

  async execute(task: AgentTask): Promise<AgentResult> {
    const agent = await this.router.resolve(task.agentId, task.mode)
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

### `DetectAgentsUseCase`

Discovers which agents are installed on the user's machine.

```typescript
// src/application/usecases/DetectAgentsUseCase.ts

import type { AgentId } from '../../core/agent'
import { AgentRegistry } from '../AgentRegistry'

export interface DetectedAgent {
  id: AgentId
  displayName: string
  available: boolean
}

export class DetectAgentsUseCase {
  constructor(private readonly registry: AgentRegistry) {}

  async execute(): Promise<DetectedAgent[]> {
    const results = await Promise.allSettled(
      this.registry.getAll().map(async agent => ({
        id: agent.id,
        displayName: agent.displayName,
        available: await agent.isAvailable(),
      })),
    )

    return results
      .filter((r): r is PromiseFulfilledResult<DetectedAgent> => r.status === 'fulfilled')
      .map(r => r.value)
  }
}
```

---

## Infrastructure Layer

Contains **concrete** agent implementations. Each one extends `BaseAgent` and overrides only what is unique to that CLI tool.

### `BaseAgent` — Abstract Template

```typescript
// src/providers/base/BaseAgent.ts

import type { IAgent, AgentId, AgentTask, AgentCommand, AgentOutput, AgentCapabilities } from '../../core/agent'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export abstract class BaseAgent implements IAgent {
  abstract readonly id: AgentId
  abstract readonly displayName: string
  abstract readonly capabilities: AgentCapabilities

  protected abstract get executableName(): string
  abstract buildCommand(task: AgentTask): AgentCommand
  abstract parseOutput(raw: string): AgentOutput

  // isAvailable is shared — override only if the check differs
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

> **Open/Closed (OCP)**: `BaseAgent` is closed for modification. Adding a new agent only requires a new subclass — zero changes to existing code.
>
> **Liskov Substitution (LSP)**: Any concrete agent can be passed wherever `IAgent` is expected. `BaseAgent` never strengthens preconditions or weakens postconditions in subclasses.

---

### Concrete Agent Example — `ClaudeAgent`

```typescript
// src/providers/claude/ClaudeAgent.ts

import { BaseAgent } from '../base/BaseAgent'
import { AgentCapabilities, AgentCommand, AgentTask, AgentOutput } from '../../core/agent'

export class ClaudeAgent extends BaseAgent {
  readonly id = 'claude' as const
  readonly displayName = 'Claude (Anthropic)'
  readonly capabilities = new AgentCapabilities(
    /*canEditFiles*/   true,
    /*canRunShell*/    true,
    /*canSearchWeb*/   false,
    /*supportsStreaming*/ true,
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

### Concrete Agent Example — `GeminiAgent`

```typescript
// src/providers/gemini/GeminiAgent.ts

import { BaseAgent } from '../base/BaseAgent'
import { AgentCapabilities, AgentCommand, AgentTask, AgentOutput } from '../../core/agent'

export class GeminiAgent extends BaseAgent {
  readonly id = 'gemini' as const
  readonly displayName = 'Gemini (Google)'
  readonly capabilities = new AgentCapabilities(
    /*canEditFiles*/   true,
    /*canRunShell*/    false,
    /*canSearchWeb*/   true,    // unique to Gemini
    /*supportsStreaming*/ true,
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

## Interface Layer

Consumes application-layer use cases. Handles VS Code API calls and React UI events.

```typescript
// src/webview/ChatController.ts  (simplified)

export class ChatController {
  constructor(
    private readonly runAgent: RunAgentUseCase,
    private readonly detectAgents: DetectAgentsUseCase,
    private readonly promptBuilder: PromptBuilder,
    private readonly eventBus: IEventBus,
  ) {}

  async handleRunTask(message: RunTaskMessage): Promise<void> {
    const enhanced = await this.promptBuilder.build(message.prompt, message.mode)
    const task = new AgentTask(message.prompt, enhanced, message.provider, message.mode)
    await this.runAgent.execute(task)
  }

  async handleReady(): Promise<void> {
    const agents = await this.detectAgents.execute()
    this.postMessage({ type: 'availableProviders', providers: agents })
  }

  private postMessage(msg: unknown): void { /* ... */ }
}
```

> **Dependency Inversion (DIP)**: `ChatController` never imports `ClaudeAgent` or `GeminiAgent` directly. It depends on `RunAgentUseCase`, which depends on `IAgent`. Concrete agents are injected at startup in `extension.ts`.

---

## SOLID Principles Applied

### S — Single Responsibility Principle

| Class | Single Responsibility |
|-------|----------------------|
| `IAgent` | Declares the agent contract |
| `AgentRegistry` | Stores and retrieves agent instances |
| `AgentRouter` | Picks the right agent for a task |
| `RunAgentUseCase` | Executes one task end-to-end |
| `DetectAgentsUseCase` | Discovers available agents |
| `BaseAgent` | Shared detection and lifecycle logic |
| `ClaudeAgent` | Claude-specific command construction |
| `ChatController` | Bridges VS Code messages to use cases |

### O — Open/Closed Principle

Adding a new agent requires:
1. Create `src/providers/<name>/<Name>Agent.ts` extending `BaseAgent`
2. Register it in `extension.ts`

No changes to `AgentRouter`, `AgentRegistry`, `RunAgentUseCase`, or any existing agent.

### L — Liskov Substitution Principle

`AgentRouter.resolve()` returns `IAgent`. The caller never needs to know which concrete class it received. Every `BaseAgent` subclass:
- Always returns a valid `AgentCommand` from `buildCommand()`
- Always returns a boolean from `isAvailable()` (never throws)
- Never adds required arguments beyond what `IAgent` declares

### I — Interface Segregation Principle

Interfaces are small and focused:

```
IAgent       ← isAvailable, buildCommand, parseOutput
IDetectable  ← detect()
IStreamable  ← onStdout, onStderr, onComplete
IStoppable   ← stop()
```

A simple one-shot agent implements only `IAgent`. A long-running interactive agent also implements `IStreamable + IStoppable`. No agent is forced to implement methods it doesn't need.

### D — Dependency Inversion Principle

```
extension.ts (composition root)
  │
  ├── creates ClaudeAgent, GeminiAgent, ...  (concrete)
  ├── registers them in AgentRegistry        (concrete)
  │
  └── injects into RunAgentUseCase           (depends on IAgent via Registry)
        └── injected into ChatController     (depends on RunAgentUseCase interface)
```

`ChatController` and `RunAgentUseCase` are tested by injecting mock agents — no spawning of real processes.

---

## Class Hierarchy

```
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
 └── implemented by RunAgentUseCase (wraps ProcessRunner)

IStoppable (interface)
 └── implemented by RunAgentUseCase (calls ProcessRunner.stop)
```

---

## Agent Lifecycle

```
User Input
    │
    ▼
ChatController.handleRunTask()
    │
    ├── PromptBuilder.build()           → enriches prompt with workspace context
    ├── new AgentTask(...)              → entity with id, status = 'pending'
    │
    ▼
RunAgentUseCase.execute(task)
    │
    ├── AgentRouter.resolve()           → picks available IAgent for mode
    ├── agent.buildCommand(task)        → AgentCommand (value object)
    ├── task.start()                    → status = 'running'
    ├── eventBus.emit('task_started')
    │
    ▼
ProcessRunner.run(command)
    │
    ├── onStdout → eventBus.emit('stdout') → UI streams live output
    ├── onStderr → eventBus.emit('stderr')
    │
    ▼
Process exits
    │
    ├── task.complete(result)           → status = 'completed' | 'failed'
    ├── eventBus.emit('task_completed')
    └── optional: GitStatus → eventBus.emit('git_status')
```

---

## Adding a New Agent

Follow these 4 steps to add a new agent. Nothing else changes.

**Step 1** — Create the agent class:

```typescript
// src/providers/myCli/MyCliAgent.ts

import { BaseAgent } from '../base/BaseAgent'
import { AgentCapabilities, AgentCommand, AgentTask, AgentOutput } from '../../core/agent'

export class MyCliAgent extends BaseAgent {
  readonly id = 'mycli' as const           // add 'mycli' to AgentId union in types.ts
  readonly displayName = 'My CLI'
  readonly capabilities = new AgentCapabilities(true, false, false, true)

  protected get executableName() { return 'mycli' }

  buildCommand(task: AgentTask): AgentCommand {
    return new AgentCommand('mycli', ['run', task.enhancedPrompt])
  }

  parseOutput(raw: string): AgentOutput {
    return { content: raw.trim(), format: 'text' }
  }
}
```

**Step 2** — Add `'mycli'` to the `AgentId` union in `src/core/types.ts`.

**Step 3** — Register in `src/extension.ts`:

```typescript
import { MyCliAgent } from './providers/myCli/MyCliAgent'

registry.register(new MyCliAgent())
```

**Step 4** — Add capability flags to `CAPABILITY_BY_MODE` in `AgentRouter` if needed for new task modes.

---

## File Structure

```
src/
├── core/                         ← Domain layer (no I/O)
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
│   │   └── NexusEvent.ts
│   └── runner/
│       └── IProcessRunner.ts
│
├── application/                  ← Application layer (use cases)
│   ├── AgentRegistry.ts
│   ├── AgentRouter.ts
│   └── usecases/
│       ├── RunAgentUseCase.ts
│       └── DetectAgentsUseCase.ts
│
├── providers/                    ← Infrastructure layer (concrete agents)
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
├── runner/                       ← Infrastructure layer (process execution)
│   ├── ProcessRunner.ts          ← implements IProcessRunner
│   └── commandGuard.ts
│
├── context/                      ← Infrastructure layer (workspace context)
│   ├── PromptBuilder.ts
│   ├── WorkspaceScanner.ts
│   ├── PackageDetector.ts
│   └── RulesLoader.ts
│
├── webview/                      ← Interface layer (VS Code bridge)
│   ├── ChatController.ts
│   ├── ChatViewProvider.ts
│   └── webviewProtocol.ts
│
├── webview-ui/                   ← Interface layer (React UI)
│   ├── App.tsx
│   └── components/
│
└── extension.ts                  ← Composition root (wires everything together)
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
8. **`BaseAgent.isAvailable()` never throws** — it returns `false` on any error so the router can safely try the next candidate.
