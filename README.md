# Nexus Visual Code

A VS Code extension that provides a chat cockpit for routing prompts to installed CLI coding agents (Claude, Codex, Gemini, Copilot, Aider, or a custom command).

## Features

- **Nexus: Open Chat** — opens a webview panel with a chat interface
- Routes prompts to any locally-installed CLI coding agent
- Streams stdout/stderr live into the webview
- Stop button to kill the active task
- Prompt enhancement with workspace context (package manager, scripts, frameworks, git branch, custom rules)
- Shows changed files via `git status` after task completion

## Supported Providers

| Provider | CLI tool | Notes |
|----------|----------|-------|
| Claude   | `claude` | Anthropic Claude Code CLI |
| Codex    | `codex`  | OpenAI Codex CLI |
| Gemini   | `gemini` | Google Gemini CLI |
| Copilot  | `copilot`| GitHub Copilot CLI |
| Aider    | `aider`  | aider-chat |
| Custom   | configurable | Set `nexus.customProvider.command` |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `nexus.defaultProvider` | `auto` | Provider to use by default |
| `nexus.customProvider.command` | `""` | Custom provider executable |
| `nexus.customProvider.args` | `[]` | Custom provider arguments (use `{{prompt}}`) |
| `nexus.enablePromptEnhancement` | `true` | Prepend workspace context to prompts |
| `nexus.showRawOutput` | `false` | Show unfiltered output |
| `nexus.runGitStatusAfterTask` | `true` | Show changed files after task |

## Custom Rules

Create `.nexus/rules.md` in your workspace root to inject custom instructions into every prompt.

## Usage

1. Open the Command Palette (`Cmd+Shift+P` / `Ctrl+Shift+P`)
2. Run **Nexus: Open Chat**
3. Select a provider and task mode
4. Type your prompt and press **Run**
