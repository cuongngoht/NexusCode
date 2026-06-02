# NexusCode — Claude Code Guide

NexusCode is a VS Code extension that routes user prompts to installed CLI coding agents (Claude, Codex, Gemini, Copilot, Aider, Custom).

## Agent Architecture

@agents.md

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

## Project Structure

```
src/
├── core/
│   ├── types.ts              # ProviderId, TaskMode, NexusTask, CliProvider interface
│   ├── providerRegistry.ts   # stores CliProvider instances by id
│   ├── providerRouter.ts     # picks the right provider for a task
│   ├── providerDetector.ts   # detects installed CLI tools + seeded model lists
│   ├── taskManager.ts        # creates and tracks NexusTask lifecycle
│   └── eventBus.ts           # typed event bus (stdout, stderr, task_*)
│
├── providers/
│   ├── base/CliProvider.ts           # BaseCliProvider (abstract) — extend this
│   ├── claude/ClaudeAdapter.ts       # claude [prompt]
│   ├── codex/CodexAdapter.ts         # codex [prompt]
│   ├── gemini/GeminiAdapter.ts       # gemini --prompt [prompt]
│   ├── copilot/CopilotAdapter.ts     # copilot --prompt [prompt]
│   ├── aider/AiderAdapter.ts         # aider --message [prompt]
│   └── custom/CustomAdapter.ts       # reads command from VS Code settings
│
├── runner/
│   ├── processRunner.ts      # spawns child process, streams stdout/stderr via eventBus
│   └── commandGuard.ts       # allowlist check — blocks dangerous executables
│
├── context/
│   ├── promptBuilder.ts      # enriches prompt with workspace context
│   ├── workspaceScanner.ts   # reads file tree
│   ├── packageDetector.ts    # reads package.json / pyproject.toml / etc.
│   └── rulesLoader.ts        # reads .nexusrules or AGENTS.md
│
├── git/
│   ├── gitStatus.ts          # runs git status, returns parsed changes
│   └── gitDiff.ts            # runs git diff
│
├── webview/
│   ├── ChatController.ts     # bridges VS Code messages ↔ use cases
│   ├── ChatViewProvider.ts   # registers the webview panel with VS Code
│   ├── ChatPanel.ts          # HTML host for the React app
│   └── webviewProtocol.ts    # typed ExtensionMessage / WebviewMessage unions
│
├── webview-ui/               # React UI (built by Vite → media/webview/)
│   ├── App.tsx               # root component, useReducer(reducer, initialState)
│   ├── messages.ts           # shared types + reducer (ProviderId, AppState, ExtMsg)
│   ├── components/
│   │   ├── AppToolbar.tsx    # provider & mode dropdowns, tabs, history toggle
│   │   ├── Composer.tsx      # prompt input + send button
│   │   ├── MessageList.tsx   # renders conversation messages
│   │   ├── AssistantMessage.tsx
│   │   ├── UserMessage.tsx
│   │   ├── ConversationHistory.tsx
│   │   └── GitStatusPanel.tsx
│   └── ...
│
└── extension.ts              # activate() — composition root, registers all providers
```

## Adding a New Provider — Checklist

1. **`src/core/types.ts`** — add the new id to `ProviderId` union
2. **`src/providers/<name>/<Name>Adapter.ts`** — extend `BaseCliProvider`, implement `buildCommand()`
3. **`src/core/providerDetector.ts`** — add a `ProviderSpec` entry to `SPECS` (binary, versionArgs, seededModels)
4. **`src/extension.ts`** — `registry.register(new <Name>Adapter())`
5. **`src/webview-ui/messages.ts`** — add the id to the `ProviderId` type (mirrors core)
6. **`src/webview-ui/components/AppToolbar.tsx`** — add the id to the `all` array in `getProviderOptions()`

## Key Conventions

- `ProviderId` is duplicated in `src/core/types.ts` (extension side) and `src/webview-ui/messages.ts` (webview side) — keep them in sync
- `BaseCliProvider.isAvailable()` uses `spawnSync` with a 5 s timeout — never throws, returns `false` on error
- `ProcessRunner` streams stdout/stderr via `globalBus` — do not post directly to the webview from adapters
- `CommandGuard.validate()` runs before every spawn — rejects commands containing shell metacharacters (`; & | \` $ < > \ !`); provider executable names must be plain strings with no special characters
- The webview build output goes to `media/webview/` — this directory is committed and packaged in the .vsix
- VS Code settings namespace: `nexus.*`
