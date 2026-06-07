# Nexus Code

Nexus Code is a Visual Studio Code extension and companion CLI that turns local AI coding tools into one coordinated chat cockpit. It can route prompts to installed CLI agents such as Gemini, Codex, Claude, Copilot, Aider, or a custom command, enrich prompts with workspace context, stream results back into VS Code, save implementation plans, apply approved plans, review branches, debug failures, and build project maps under `.nexus/`.

The project is designed around a simple workflow:

```text
Understand the workspace -> choose the right agent -> plan safely -> apply or review changes
```

## Core Features

### VS Code Chat Cockpit

- Adds a dedicated **Nexus** Activity Bar container.
- Provides a persistent **Chat** webview view.
- Supports multi-turn conversations with saved chat history.
- Lets users start new conversations, switch conversations, delete conversations, and clear history.
- Supports English and Vietnamese UI strings.
- Streams live output from CLI agents into the chat panel.
- Shows running status, elapsed time, pipeline steps, task completion, failure, and stopped states.
- Provides a **Stop** action to cancel the active task.
- Allows inspection of the final enhanced prompt sent to the CLI.
- Shows copied, retry, good response, and bad response UI actions for assistant messages.

### Multi-Agent Provider Routing

Nexus can route tasks to multiple local CLI providers:

| Provider | Command               | Main Use                                                |
| -------- | --------------------- | ------------------------------------------------------- |
| Nexus    | internal orchestrator | Automatically coordinates search, plan, and code stages |
| Gemini   | `gemini`              | Web-aware search/research and synthesis                 |
| Codex    | `codex`               | Planning, coding, tests, and code analysis              |
| Claude   | `claude`              | Coding and implementation work                          |
| Copilot  | `copilot`             | GitHub Copilot CLI workflows                            |
| Aider    | `aider`               | Repo-aware editing workflows                            |
| Custom   | user-defined          | Any local command that accepts a prompt template        |

Provider behavior includes:

- Automatic CLI detection using local executable lookup.
- Provider enable/disable controls in Nexus Settings.
- Last selected provider persistence.
- Model selection support for providers with seeded model lists.
- Custom command support using `{{prompt}}` and `{{model}}` placeholders.
- Provider capability checks before Nexus chooses an agent for a stage.

### Nexus Smart Orchestrator

The built-in `nexus` provider is not a normal CLI command. It is an orchestration layer that chooses agents based on task stage and provider capabilities.

Supported stages:

| Stage    | Purpose                                                   | Preferred Providers                           |
| -------- | --------------------------------------------------------- | --------------------------------------------- |
| `search` | Gather information, use web-capable agents when available | Gemini, Codex, Claude, Copilot, Aider, Custom |
| `plan`   | Produce an implementation or reasoning plan               | Codex, Claude, Gemini, Copilot, Aider, Custom |
| `code`   | Apply a saved plan with an edit-capable agent             | Claude, Codex, Aider, Copilot, Custom, Gemini |

Mode-to-stage flow:

| Mode           | Nexus Flow       |
| -------------- | ---------------- |
| `edit`         | `search -> plan` |
| `debug`        | `search -> plan` |
| `test`         | `search -> plan` |
| `review`       | `search -> plan` |
| `research`     | `search`         |
| `plan`         | `plan`           |
| `ask`          | `plan`           |
| `brainstorm`   | `plan`           |
| `scan-project` | `search`         |

For coding modes, Nexus saves the generated plan instead of immediately modifying files. The user can then approve and apply it with **Apply Plan**.

### Plan-First Workflow

Nexus supports a safer two-step coding workflow:

1. Ask Nexus to inspect/search/plan.
2. Nexus saves the plan to `.nexus/plan.md` and `.nexus/runs/<task-id>/plan.md`.
3. Review or edit the plan manually.
4. Use **Apply Plan** to run the `code` stage with an editing-capable agent.

This reduces accidental edits because planning and code mutation are separated.

### Task Modes

Nexus supports these task modes:

| Mode           | UI Label       | Purpose                                                                   |
| -------------- | -------------- | ------------------------------------------------------------------------- |
| `ask`          | Ask            | Answer questions using provided context without broad project scanning    |
| `research`     | Research Agent | Research and synthesize information, preferring web-capable agents        |
| `scan-project` | Scan Project   | Analyze workspace structure and write project map files                   |
| `plan`         | Planner        | Produce an implementation plan without mutating files                     |
| `brainstorm`   | Brainstorm     | Run a multi-agent brainstorming workflow using markdown agent definitions |
| `edit`         | Build Agent    | Implement scoped code changes                                             |
| `debug`        | Debug Agent    | Diagnose failures and apply focused fixes when safe                       |
| `test`         | Test Agent     | Create, improve, or run tests                                             |
| `review`       | Code Reviewer  | Review branch diffs for bugs, regressions, risks, and missing tests       |

### Prompt Enhancement

When prompt enhancement is enabled, Nexus builds a richer prompt before sending it to a CLI provider.

Enhanced prompt context can include:

- Workspace name and root path.
- Current Git branch.
- Package manager.
- Detected frameworks.
- Available package scripts.
- Task mode guidance.
- `.nexus/rules.md` project rules.
- Project map content.
- Important source files.
- Previous conversation context.
- Active plan content from `.nexus/plan.md`.
- Debug signal analysis.
- Branch review diff context.
- Brainstorm agent definitions.

Prompt enhancement can be disabled with `nexus.enablePromptEnhancement`.

### Project Rules

Create this file in the workspace root:

```text
.nexus/rules.md
```

Its contents are automatically injected into enhanced prompts. Use it for project conventions such as architecture rules, coding standards, testing requirements, or forbidden commands.

### Project Map Generation

Nexus can scan the workspace and generate a structured project map under `.nexus/`.

Generated files include:

| File                          | Purpose                                  |
| ----------------------------- | ---------------------------------------- |
| `.nexus/project-map.md`       | Human-readable project overview          |
| `.nexus/file-tree.txt`        | Scanned file list                        |
| `.nexus/workspace-units.json` | Detected project units and metadata      |
| `.nexus/scan-cache.json`      | Scan summary and cache metadata          |
| `.nexus/.gitignore`           | Ignores generated scan cache/debug files |

The scanner:

- Respects Nexus ignore matching.
- Limits scan depth and file count.
- Detects project markers such as `package.json`, `tsconfig.json`, `vite.config.ts`, `next.config.js`, `.sln`, `.csproj`, `pyproject.toml`, `requirements.txt`, `pom.xml`, `go.mod`, `Cargo.toml`, `Dockerfile`, and `docker-compose.yml`.
- Detects project kinds such as frontend, backend, library, tooling, and unknown.
- Detects languages and frameworks such as TypeScript, .NET, Python, Java, Go, Rust, Vite, Next.js, ASP.NET Core, Django, Flask, Maven, Gradle, and Docker.

### AI Project Summary

The extension registers a project summary command that can ask a selected AI provider to summarize the generated project map.

It can write:

| File                             | Purpose                                                          |
| -------------------------------- | ---------------------------------------------------------------- |
| `.nexus/project-summary.json`    | Structured AI summary with risks, missing pieces, and next steps |
| `.nexus/project-map.md`          | Updated markdown project map with summary content                |
| `.nexus/project-summary.raw.txt` | Raw AI output for debugging                                      |

### Branch Review Workflow

Review mode is built for branch diff review.

It can:

- Detect available Git branches.
- Choose or refresh a base branch.
- Compare the current branch against the selected base branch.
- Collect changed files, diff stats, and diff content.
- Load a review agent template from `.nexus/agents/code-review.md`.
- Create the review agent markdown file from bundled defaults when missing.
- Open the review agent file for editing.
- Read changed source file excerpts for stronger review context.
- Build a structured review prompt focused on bugs, regressions, security, data loss, async issues, edge cases, tests, and maintainability.

### Debug Workflow

Debug mode prepares a specialized debugging context before running the selected agent.

It can detect:

- TypeScript compiler errors such as `TS2345`.
- JavaScript/TypeScript stack traces.
- Test failures from tools such as Vitest and Jest.
- Build failures from Vite, Rollup, TypeScript, and related tools.
- Failing commands such as `npm`, `npx`, `pnpm`, `yarn`, `bun`, `node`, `vitest`, `jest`, `tsc`, `eslint`, and `vite`.
- Relevant file paths, line numbers, and columns from error output.
- Async/concurrency hints such as race conditions, timeouts, debounce/throttle, flaky behavior, and missing awaits.
- `no-edit`, `no edit`, and `noedit` flags for read-only debugging.

Debug prompts instruct the agent to identify the root cause, keep fixes small, add regression tests when relevant, rerun the failing command when available, and report verification results.

### Brainstorm Workflow

Brainstorm mode prepares a multi-agent ideation context.

It can:

- Build a project map first.
- Read important source files.
- Copy bundled brainstorm agent markdown files into `.nexus/agents/brainstorm/` when available.
- Load all markdown agent definitions from `.nexus/agents/brainstorm/`.
- Ask the selected provider to synthesize multiple specialist perspectives into ranked recommendations.

### Conversation Context

Nexus can include previous chat context in the enhanced prompt, making follow-up requests more useful while still routing through local CLI agents.

Conversation features include:

- Persistent chat history stored in VS Code state.
- Multiple conversations.
- Active conversation tracking.
- Conversation-specific token usage.
- Context injection for follow-up tasks.

### Token Usage Estimates

Nexus estimates token usage with `gpt-tokenizer`.

It tracks:

- Original prompt tokens.
- Enhanced prompt tokens.
- Context overhead tokens.
- Output tokens.
- Total estimated tokens.
- Provider, mode, model, start time, and completion time.

The UI includes a conversation token bar and prompt inspection so users can see how much context Nexus added.

### Git Status After Tasks

When enabled, Nexus runs `git status --porcelain` after task completion or stop events and shows changed files in the UI.

This helps users immediately inspect what an editing agent changed.

### Settings UI

Nexus includes a settings panel with:

- Provider enable/disable checkboxes.
- Local CLI scan button.
- Saved provider configuration.
- Setup banner when no CLI provider has been configured.

Default provider configuration enables Gemini and Codex and disables Claude, Copilot, and Aider until the user enables them.

### About Panel

The extension includes an About panel registered through the `nexus.openAbout` command handler.

### Command Guard for Custom Providers

Custom provider execution validates configured commands before running them. This helps prevent invalid or unsafe custom command definitions from being launched accidentally.

### Output Parsing and Normalization

Nexus includes provider-specific output parsers for:

- Claude
- Codex
- Gemini
- Generic/default providers

The output layer normalizes streamed stdout/stderr into cleaner chat output and activity events.

### Live Pipeline Events

The internal event bus forwards task and pipeline events to the webview.

Supported event types include:

- Task started.
- Task completed.
- Task stopped.
- Task error.
- Stdout chunks.
- Stderr chunks.
- Step started.
- Step completed.
- Step error.
- Activity started.
- Activity done.
- Token usage updated.
- Plan saved.

### CLI Companion

The package exposes a `nexus` command.

Available CLI commands:

```bash
nexus map
nexus run --prompt "Your task"
```

#### `nexus map`

Builds a Nexus project map.

Options:

```bash
nexus map --root <path> --json --max-depth <number> --max-files <number>
```

Examples:

```bash
nexus map
nexus map --root ./my-project
nexus map --root ./my-project --json
nexus map --max-depth 6 --max-files 3000
```

#### `nexus run`

Runs a task through the Nexus orchestrator.

Options:

```bash
nexus run \
  --prompt "Implement the saved plan" \
  --root <path> \
  --mode <mode> \
  --provider <id> \
  --stage <auto|search|plan|code> \
  --plan <path> \
  --base-branch <branch> \
  --model <model>
```

Examples:

```bash
nexus run --prompt "Plan a safe refactor for the auth module" --mode edit
nexus run --prompt "Review this branch" --mode review --base-branch main
nexus run --prompt "Apply this implementation" --stage code --model sonnet
```

## Installation

### From VSIX

A packaged extension file is included in the project archive:

```text
nexus-visual-code-0.1.4.vsix
```

Install it manually in VS Code:

1. Open VS Code.
2. Open the Extensions view.
3. Choose **Install from VSIX...**.
4. Select `nexus-visual-code-0.1.4.vsix`.

Or install from the command line:

```bash
code --install-extension nexus-visual-code-0.1.4.vsix
```

### From Source

```bash
npm install
npm run compile
```

Then launch the extension in the VS Code Extension Development Host.

## Requirements

- Visual Studio Code `^1.85.0`.
- Node.js compatible with the project dependencies.
- At least one supported local CLI provider installed if you want to run AI tasks.
- Git installed for branch review and changed-file tracking.

Optional local CLI tools:

```bash
gemini
codex
claude
copilot
aider
```

## Configuration

VS Code settings contributed by the extension:

| Setting                         | Default | Description                                                                                 |
| ------------------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `nexus.defaultProvider`         | `nexus` | Default provider used when routing tasks                                                    |
| `nexus.customProvider.command`  | `""`    | Executable for the custom provider                                                          |
| `nexus.customProvider.args`     | `[]`    | Arguments for the custom provider; use `{{prompt}}` in any argument                         |
| `nexus.enablePromptEnhancement` | `true`  | Adds workspace, rules, package, project, debug, review, and conversation context to prompts |
| `nexus.showRawOutput`           | `false` | Shows unfiltered stdout/stderr alongside parsed output                                      |
| `nexus.runGitStatusAfterTask`   | `true`  | Shows changed files after each task completes or stops                                      |

Nexus also stores provider enablement in its own config service. The default provider config is:

```json
{
  "version": 1,
  "providers": {
    "gemini": { "enabled": true, "command": "gemini" },
    "codex": { "enabled": true, "command": "codex" },
    "claude": { "enabled": false, "command": "claude" },
    "copilot": { "enabled": false, "command": "copilot" },
    "aider": { "enabled": false, "command": "aider" }
  }
}
```

## Custom Provider

Configure a custom provider when you want Nexus to call your own local executable.

Example VS Code settings:

```json
{
  "nexus.customProvider.command": "my-agent",
  "nexus.customProvider.args": [
    "run",
    "--prompt",
    "{{prompt}}",
    "--model",
    "{{model}}"
  ]
}
```

The CLI fallback can also read:

```bash
NEXUS_CUSTOM_COMMAND=my-agent
NEXUS_CUSTOM_ARGS="run --prompt {{prompt}}"
```

## Usage

### Open Nexus Chat

1. Open a workspace in VS Code.
2. Open the Command Palette.
3. Run **Nexus: Open Chat**.
4. Open Settings if the setup banner appears.
5. Click **Scan for CLIs**.
6. Enable the providers you want to use.
7. Choose a provider, mode, and model.
8. Type a prompt and send it.

### Generate a Project Map

Use **Scan Project** mode in the UI, or run:

```bash
nexus map
```

### Plan Before Editing

1. Select provider `Nexus`.
2. Select `Build Agent`, `Debug Agent`, `Test Agent`, or `Code Reviewer` mode.
3. Send a task.
4. Review `.nexus/plan.md` after Nexus saves it.
5. Click **Apply Plan** to run the implementation stage.

### Review a Branch

1. Select `Code Reviewer` mode.
2. Choose or refresh the base branch.
3. Optionally edit `.nexus/agents/code-review.md`.
4. Send the review task.

### Debug a Failure

Paste terminal output, a stack trace, or a compiler/test error into Debug mode.

Examples:

```text
npm run compile fails with TS2345 in src/core/types.ts
```

```text
vitest run failed. no-edit. Explain the root cause and propose a patch.
```

## Development

### Scripts

| Script                      | Purpose                                  |
| --------------------------- | ---------------------------------------- |
| `npm run compile:extension` | Compile the VS Code extension TypeScript |
| `npm run compile:webview`   | Build the React/Vite webview UI          |
| `npm run compile`           | Build both extension and webview         |
| `npm run build:cli`         | Compile the CLI entrypoint               |
| `npm run watch`             | Watch extension TypeScript compilation   |
| `npm run watch:webview`     | Watch webview build                      |
| `npm run test:webview`      | Run Vitest tests                         |

### Project Structure

```text
src/
  application/       Use cases, orchestration, pipeline steps
  application/nexus/ Nexus smart routing, plan store, mode/stage policy
  cli/               `nexus` command implementation
  config/            Default config and config service
  context/           Prompt context, workspace scanning, project map, rules, review prompt
  core/              Agent interfaces, task types, event bus, pipeline contracts
  debug/             Debug signal parser and debug prompt builder
  git/               Branch, diff, status, and review context helpers
  infrastructure/    AI runner integration for project summaries
  output/            Output normalization and provider parsers
  providers/         Claude, Codex, Gemini, Copilot, Aider, Custom, Nexus agents
  runner/            Process runner and command guard
  settings/          Settings and About panels
  tokens/            Token estimation
  webview/           VS Code webview provider, controller, protocol, handlers
  webview-ui/        React UI components, i18n, theme, client state
media/
  agents/            Bundled agent markdown templates
  nexus.svg          Activity Bar icon
out/                 Compiled extension output
```

## Architecture

Nexus follows a layered design:

```text
VS Code Webview UI
        |
ChatController + handlers
        |
Pipeline steps + prompt builders
        |
AgentRouter / NexusOrchestrator
        |
Provider adapters
        |
ProcessRunner
        |
Local CLI tools
```

Important architectural concepts:

- `AgentTask` represents one unit of work.
- `AgentCapabilities` describes whether an agent can edit files, run shell commands, search the web, or stream output.
- `AgentRegistry` stores all available providers.
- `AgentRouter` selects a provider for direct execution.
- `NexusOrchestrator` coordinates staged Nexus workflows.
- `RunAgentUseCase` executes a task and publishes lifecycle events.
- `ProcessRunner` launches and controls local CLI processes.
- `EventBus` decouples backend execution from UI updates.
- Pipeline steps prepare mode-specific context before execution.

## Safety Model

Nexus is designed to reduce risky edits by separating intent, context, planning, and execution.

Safety-related behavior includes:

- Plan-first workflow for Nexus coding modes.
- Explicit **Apply Plan** step before code mutation.
- Stop button for active processes.
- Custom project rules via `.nexus/rules.md`.
- Review mode focused on concrete diff-grounded issues.
- Debug mode with `no-edit` support.
- Command validation for custom providers.
- Git status shown after tasks.
- Generated `.nexus/.gitignore` to avoid committing scan cache/debug artifacts accidentally.

## Generated `.nexus` Files

| Path                             | Created By             | Description                                  |
| -------------------------------- | ---------------------- | -------------------------------------------- |
| `.nexus/rules.md`                | User                   | Optional project rules injected into prompts |
| `.nexus/plan.md`                 | Nexus plan stage       | Latest saved plan                            |
| `.nexus/runs/<task-id>/plan.md`  | Nexus plan stage       | Per-run saved plan                           |
| `.nexus/project-map.md`          | Scan Project / CLI map | Project overview                             |
| `.nexus/file-tree.txt`           | Scan Project / CLI map | Scanned file list                            |
| `.nexus/workspace-units.json`    | Scan Project / CLI map | Detected project units                       |
| `.nexus/scan-cache.json`         | Scan Project / CLI map | Scan cache metadata                          |
| `.nexus/project-summary.json`    | AI summary command     | Structured AI project summary                |
| `.nexus/project-summary.raw.txt` | AI summary command     | Raw summary output for debugging             |
| `.nexus/agents/code-review.md`   | Review mode            | Editable code review agent template          |
| `.nexus/agents/brainstorm/*.md`  | Brainstorm mode        | Editable brainstorm agent personas           |

## Current Limitations

- Nexus depends on local CLI tools being installed and authenticated separately.
- Web search support depends on the selected provider capability.
- Token usage is estimated with `gpt-tokenizer`; it is not provider-billed usage.
- The project map scanner is intentionally bounded by depth and file-count limits.
- The `nexus` provider is an orchestrator and does not directly build a shell command.
- Some registered commands may be invoked internally even when not all are listed in `package.json` contributions.

## License

See `LICENSE`.
