# Nexus Code

**Nexus Code** is a Visual Studio Code extension and companion CLI for coordinating local AI coding agents from one workspace-aware chat cockpit.

It routes prompts to installed CLI providers such as **Claude Code**, **Codex**, **Antigravity**, **GitHub Copilot**, **Aider**, **Grok**, or a user-defined custom command. Nexus enriches prompts with project context, streams agent output back into VS Code, preserves conversations, tracks token usage, builds `.nexus/` project maps, supports reusable markdown agents and skills, and can optionally run MCP-assisted tool flows.

```text
Understand the workspace -> choose the right agent -> enrich the prompt -> stream the result -> review changes
```

---

## What Nexus Code Solves

Modern AI coding workflows often involve several strong tools, but each tool has different strengths:

- some are better at planning;
- some are better at direct code edits;
- some are better at repository-aware debugging;
- some are better at web or documentation research;
- some are better as custom local automations.

Nexus Code provides one cockpit inside VS Code so the user can choose the right provider, mode, model, context, agent prompt, skill prompt, and review workflow without leaving the editor.

---

## Main Capabilities

### VS Code Chat Cockpit

Nexus adds a dedicated **Nexus** activity bar container and a persistent **Chat** webview in the secondary sidebar.

The chat cockpit supports:

- multi-turn conversations;
- saved conversation history per workspace;
- conversation switching and deletion;
- live stdout and stderr streaming from CLI agents;
- visible running, completed, stopped, and failed task states;
- elapsed task timer;
- stop/cancel action for active tasks;
- copy, retry, good response, and bad response actions;
- viewing the final enhanced prompt sent to the provider;
- provider, mode, and model selection;
- English and Vietnamese UI strings;
- workspace file attachments;
- drag-and-drop file/folder attachment resolution;
- git status display after a task completes;
- conversation token usage summaries;
- conversation compaction for long histories.

---

### Supported Providers

Nexus can route work to these provider IDs:

| Provider ID   | Purpose                                                       | Typical executable |
| ------------- | ------------------------------------------------------------- | ------------------ |
| `nexus`       | Internal Nexus orchestrator that chooses staged provider flow | internal           |
| `auto`        | Auto/provider recommendation mode                             | internal           |
| `claude`      | Strong coding, editing, debugging, and tests                  | `claude`           |
| `codex`       | Strong planning, code reasoning, review, and tests            | `codex`            |
| `antigravity` | Strong research/search-oriented workflows                     | `agy`              |
| `copilot`     | GitHub Copilot CLI workflows                                  | `copilot`          |
| `aider`       | Repo-aware direct editing workflows                           | `aider`            |
| `grok`        | Research, reasoning, coding, and shell-capable workflows      | `grok`             |
| `custom`      | User-defined local command                                    | configured by user |

Provider detection is based on local executable availability. Providers can be enabled, disabled, and configured from Nexus settings.

---

### Task Modes

Nexus models the user's intent with task modes:

| Mode           | Use case                                         |
| -------------- | ------------------------------------------------ |
| `ask`          | General workspace-aware questions                |
| `research`     | Research and source-gathering tasks              |
| `scan-project` | Project structure scanning and understanding     |
| `plan`         | Implementation planning without direct edits     |
| `brainstorm`   | Ideation, product thinking, architecture options |
| `edit`         | Code changes and feature implementation          |
| `debug`        | Bug investigation and debugging plans            |
| `test`         | Test strategy and test implementation            |
| `review`       | Branch/diff review and code quality analysis     |

The UI shows provider recommendations and capability fit per mode so users can choose the best agent for the task.

---

## Nexus Internal Orchestrator

The `nexus` provider is an internal orchestrator. Instead of sending the prompt to a single provider immediately, it can break the task into stages and choose the best available provider for each stage.

### Stage Flow

| Mode           | Nexus stage flow |
| -------------- | ---------------- |
| `edit`         | `search -> plan` |
| `debug`        | `search -> plan` |
| `test`         | `search -> plan` |
| `review`       | `search -> plan` |
| `research`     | `search`         |
| `scan-project` | `search`         |
| `plan`         | `plan`           |
| `ask`          | `plan`           |
| `brainstorm`   | `plan`           |

For coding-oriented modes, Nexus saves successful plan output as a plan file under `.nexus/plans/` so it can be inspected before implementation.

### Stage Provider Priority

| Stage    | Provider priority                                                      |
| -------- | ---------------------------------------------------------------------- |
| `search` | `antigravity`, `grok`, `codex`, `claude`, `copilot`, `aider`, `custom` |
| `plan`   | `codex`, `claude`, `grok`, `antigravity`, `copilot`, `aider`, `custom` |
| `code`   | `claude`, `codex`, `grok`, `aider`, `copilot`, `custom`, `antigravity` |

Nexus only selects providers that are registered, available, and capable enough for the required stage.

---

## Agent Capability Recommendations

Nexus includes a capability matrix for direct providers and task modes.

| Mode           | Best providers                           | Good providers                   | Limited / fallback                 |
| -------------- | ---------------------------------------- | -------------------------------- | ---------------------------------- |
| `ask`          | `codex`, `claude`                        | `grok`, `antigravity`, `copilot` | `aider`, `custom`                  |
| `plan`         | `codex`, `claude`                        | `grok`, `antigravity`, `copilot` | `aider`, `custom`                  |
| `edit`         | `claude`, `codex`                        | `grok`, `aider`                  | `antigravity`, `copilot`, `custom` |
| `debug`        | `claude`, `codex`                        | `grok`, `aider`                  | `antigravity`, `copilot`, `custom` |
| `test`         | `claude`, `codex`, `grok`, `aider`       | —                                | `antigravity`, `copilot`, `custom` |
| `review`       | `codex`, `claude`                        | `grok`, `antigravity`, `copilot` | `aider`, `custom`                  |
| `research`     | `antigravity`, `grok`                    | `codex`, `claude`                | `copilot`, `aider`, `custom`       |
| `brainstorm`   | `claude`, `codex`, `antigravity`, `grok` | `copilot`                        | `aider`, `custom`                  |
| `scan-project` | `antigravity`, `codex`                   | `grok`, `claude`                 | `copilot`, `aider`, `custom`       |

`custom` is treated as unknown because its behavior depends on the command configured by the user.

---

## Prompt Enhancement

When prompt enhancement is enabled, Nexus builds a richer prompt before sending it to the selected provider.

Enhancement may include:

- workspace context;
- package/project detection;
- selected files or folders;
- branch review context;
- loaded project rules;
- selected `@agent` markdown prompt;
- selected `#skill` markdown workflow;
- compacted conversation summary;
- MCP result context when MCP is enabled and a tool intent is detected.

The final enhanced prompt can be inspected in the chat UI.

---

## Project-Level Markdown Agents

Nexus supports reusable project-specific agent prompts through `@agent` mentions.

Bundled default agents include:

| Agent                | Focus                                                    |
| -------------------- | -------------------------------------------------------- |
| `code-review`        | Branch diff review, bugs, regressions, security, tests   |
| `product-owner`      | User value, scope, acceptance criteria, MVP slicing      |
| `senior-developer`   | Minimal safe implementation, maintainability, edge cases |
| `software-architect` | Architecture, boundaries, data flow, tradeoffs           |
| `tester`             | Test scenarios, regression risks, manual verification    |

When enabled, Nexus can copy default agent prompts into:

```text
.nexus/agents/
```

Users can create custom markdown agents and reference them in chat with `@agent-name`.

A context menu command is available when right-clicking `.nexus/agents`:

```text
Nexus: Create Workflow Agent
```

---

## Project-Level Markdown Skills

Nexus supports reusable workflow prompts through `#skill` mentions.

Bundled default skills include:

| Skill             | Focus                                                               |
| ----------------- | ------------------------------------------------------------------- |
| `api-design`      | Interfaces, types, compatibility, errors, examples                  |
| `bug-fix`         | Reproduction, root cause, scoped fix, regression tests              |
| `design-patterns` | SOLID, OOP/OOD, DRY, structure, pattern selection                   |
| `refactor`        | Simpler structure while preserving behavior                         |
| `security-review` | Path traversal, command injection, secret leakage, trust boundaries |
| `write-tests`     | Unit tests, integration tests, edge cases, mocking                  |

When enabled, Nexus can copy default skill prompts into:

```text
.nexus/skills/
```

Users can create custom markdown skills and reference them in chat with `#skill-name`.

---

## Optional Subagent Layer

Nexus includes an optional subagent layer that can run focused pre-agents before the main agent.

Default subagents include:

| Subagent   | Typical role                          |
| ---------- | ------------------------------------- |
| `search`   | Find relevant context and sources     |
| `planner`  | Break work into implementation steps  |
| `tester`   | Identify test strategy and edge cases |
| `reviewer` | Review risks and quality issues       |
| `security` | Inspect security-sensitive changes    |
| `debugger` | Analyze failures and likely causes    |
| `docs`     | Documentation and explanation support |
| `product`  | Product and scope thinking            |
| `research` | Research-oriented decomposition       |

The subagent layer is disabled by default and can be enabled with settings.

---

## MCP Tool Layer

Nexus includes an optional MCP layer for tool-assisted workflows.

Supported preset configuration includes:

- **Microsoft Learn** preset for official Microsoft documentation;
- **Context7** preset for up-to-date library documentation;
- optional Context7 API key;
- automatic preset selection by task intent;
- max result size limits;
- max MCP rounds per task;
- approval requirement for high-risk tools.

When MCP is enabled, Nexus can inspect an agent's output for tool intent, run the selected MCP tool, compress the result, and inject that result into a follow-up agent run.

---

## Project Map

Nexus can build a project map under `.nexus/` to help agents understand the repository.

Generated files include:

```text
.nexus/project-map.md
.nexus/file-tree.txt
.nexus/workspace-units.json
.nexus/scan-cache.json
.nexus/.gitignore
```

The `.nexus/.gitignore` file ignores generated scan/cache/debug artifacts such as:

```text
scan-cache.json
file-tree.txt
project-summary.raw.txt
tmp/
*.cache.json
```

Project map support includes:

- file tree scanning;
- marker detection;
- workspace unit detection;
- markdown project map generation;
- JSON workspace unit output;
- optional AI-generated project summary.

---

## Git and Review Support

Nexus can collect git context for review workflows:

- current branch;
- base branch;
- available branches;
- changed files;
- diff stat;
- diff content;
- truncation status for large diffs.

The chat UI can show branch review context and changed files. After a task completes, Nexus can run `git status` and display changed files.

---

## Conversation and Token Management

Nexus stores chat history per workspace and tracks token usage for assistant runs.

Supported behavior includes:

- saved conversations;
- active conversation tracking;
- derived conversation titles;
- token usage by provider;
- preview token estimates before a run;
- final token usage after completion;
- exact, estimated, or heuristic token source breakdown;
- compact summaries for long conversations.

Default compaction behavior:

| Setting                              | Default |
| ------------------------------------ | ------- |
| `compact.enabled`                    | `true`  |
| `compact.suggestAfterMessages`       | `12`    |
| `compact.recentMessagesAfterCompact` | `6`     |
| `compact.maxCompactSummaryChars`     | `8000`  |

---

## Extension Commands

Commands contributed by the extension:

| Command                        | Description                                             |
| ------------------------------ | ------------------------------------------------------- |
| `Nexus: Open Chat`             | Focus the Nexus chat webview                            |
| `Nexus: Open Settings`         | Open Nexus settings panel                               |
| `Nexus: Create Workflow Agent` | Create a markdown workflow agent inside `.nexus/agents` |

Additional internal commands are registered by the extension for about/settings and project summary workflows.

---

## Settings

Nexus uses VS Code settings and `.nexus/config.json` depending on the feature.

### VS Code Settings

| Setting                                     | Default | Description                                           |
| ------------------------------------------- | ------- | ----------------------------------------------------- |
| `nexus.defaultProvider`                     | `nexus` | Default provider for routing tasks                    |
| `nexus.customProvider.command`              | empty   | Executable for the custom provider                    |
| `nexus.customProvider.args`                 | `[]`    | Arguments for custom provider; supports `{{prompt}}`  |
| `nexus.enablePromptEnhancement`             | `true`  | Prepend workspace context to prompts                  |
| `nexus.showRawOutput`                       | `false` | Show unfiltered stdout/stderr with parsed output      |
| `nexus.runGitStatusAfterTask`               | `true`  | Run git status after task completion                  |
| `nexus.mcp.enabled`                         | `false` | Enable MCP tool layer                                 |
| `nexus.mcp.autoSelectPreset`                | `true`  | Let Nexus select MCP preset by task intent            |
| `nexus.mcp.requireApprovalForHighRiskTools` | `true`  | Require approval for high-risk MCP tools              |
| `nexus.mcp.maxResultChars`                  | `6000`  | Maximum MCP result chars injected into prompt         |
| `nexus.mcp.maxRoundsPerTask`                | `1`     | Maximum MCP rounds per task                           |
| `nexus.mcp.presets.microsoftLearn.enabled`  | `true`  | Enable Microsoft Learn MCP preset                     |
| `nexus.mcp.presets.context7.enabled`        | `true`  | Enable Context7 MCP preset                            |
| `nexus.mcp.presets.context7.apiKey`         | empty   | Optional Context7 API key                             |
| `nexus.subagents.enabled`                   | `false` | Enable subagent layer                                 |
| `nexus.subagents.maxRuns`                   | `4`     | Maximum subagent runs per task                        |
| `nexus.subagents.includeSecurity`           | `false` | Include security subagent when applicable             |
| `nexus.subagents.includeDocs`               | `false` | Include docs subagent when applicable                 |
| `nexus.agents.enabled`                      | `true`  | Enable markdown agents and `@agent` autocomplete      |
| `nexus.agents.autoCopyDefaults`             | `true`  | Copy bundled agents into `.nexus/agents` when missing |
| `nexus.skills.enabled`                      | `true`  | Enable markdown skills and `#skill` autocomplete      |
| `nexus.skills.autoCopyDefaults`             | `true`  | Copy bundled skills into `.nexus/skills` when missing |

### Workspace `.nexus/config.json`

Default workspace config shape:

```json
{
  "version": 1,
  "providers": {
    "antigravity": { "enabled": true, "command": "agy" },
    "codex": { "enabled": true, "command": "codex" },
    "claude": { "enabled": false, "command": "claude" },
    "copilot": { "enabled": false, "command": "copilot" },
    "aider": { "enabled": false, "command": "aider" },
    "grok": { "enabled": false, "command": "grok" }
  },
  "mcp": {
    "enabled": false,
    "autoSelectPreset": true,
    "requireApprovalForHighRiskTools": true,
    "maxResultChars": 6000,
    "maxRoundsPerTask": 1,
    "presets": {
      "microsoftLearn": { "enabled": true },
      "context7": { "enabled": true, "apiKey": "" }
    }
  },
  "compact": {
    "enabled": true,
    "suggestAfterMessages": 12,
    "recentMessagesAfterCompact": 6,
    "maxCompactSummaryChars": 8000
  }
}
```

---

## Custom Provider

A custom provider can run any local command that accepts a prompt.

VS Code setting example:

```json
{
  "nexus.customProvider.command": "my-agent",
  "nexus.customProvider.args": ["run", "--prompt", "{{prompt}}"]
}
```

CLI workspace config example:

```json
{
  "customProvider": {
    "command": "my-agent",
    "args": ["run", "--prompt", "{{prompt}}"]
  }
}
```

Environment fallback for CLI custom provider:

```bash
export NEXUS_CUSTOM_COMMAND="my-agent"
export NEXUS_CUSTOM_ARGS="run --prompt {{prompt}}"
```

---

## CLI Usage

The package exposes a `nexus` CLI.

### Build a Project Map

```bash
nexus map --root .
```

Output JSON:

```bash
nexus map --root . --json
```

Limit scan depth and file count:

```bash
nexus map --root . --max-depth 8 --max-files 5000
```

### Run a Task

```bash
nexus run --prompt "Implement the user settings panel" --root . --mode edit --provider nexus
```

Useful options:

```bash
nexus run \
  --prompt "Review this branch for regressions" \
  --root . \
  --mode review \
  --provider nexus \
  --base-branch main
```

```bash
nexus run \
  --prompt "Create an implementation plan for MCP preset selection" \
  --root . \
  --mode plan \
  --provider codex \
  --model gpt-5.1
```

CLI options include:

| Option                   | Description                                         |
| ------------------------ | --------------------------------------------------- |
| `--prompt <text>`        | Required user prompt                                |
| `--root <path>`          | Workspace root; defaults to current directory       |
| `--mode <mode>`          | Task mode                                           |
| `--provider <id>`        | Provider override                                   |
| `--stage <stage>`        | Force Nexus stage: `auto`, `search`, `plan`, `code` |
| `--plan <path>`          | Plan file path for code stage                       |
| `--base-branch <branch>` | Base branch for review mode                         |
| `--model <model>`        | Model override                                      |

---

## Development

### Requirements

- Node.js compatible with the project's toolchain;
- VS Code `^1.85.0` or newer;
- npm;
- local CLI agents installed for the providers you want to use.

### Install Dependencies

```bash
npm install
```

### Build

Compile extension and webview:

```bash
npm run compile
```

Compile extension only:

```bash
npm run compile:extension
```

Compile webview only:

```bash
npm run compile:webview
```

Build CLI bundle:

```bash
npm run build:cli
```

### Typecheck

```bash
npm run typecheck
```

### Tests

```bash
npm run test:webview
```

### Watch Mode

Extension watch:

```bash
npm run watch
```

Webview watch:

```bash
npm run watch:webview
```

---

## Project Structure

```text
src/
  application/          Application services, routing, orchestration, use cases
  application/nexus/    Nexus internal orchestrator, routing policy, capability matrix
  application/pipeline/ Pipeline pre-steps for task context
  application/subagents Optional subagent planning/execution layer
  cli/                  `nexus` CLI commands
  config/               Workspace config and defaults
  context/              Prompt building, agents, skills, research, project map context
  core/                 Domain types, agent contracts, events, runner interfaces
  debug/                Debug prompt/context support
  git/                  Git status, branch, diff, review context helpers
  infrastructure/       Infrastructure adapters for AI/project map summaries
  mcp/                  MCP presets, broker, execution policy, result compression
  output/               Output normalization and provider output parsers
  providers/            Provider adapters for Claude, Codex, Aider, etc.
  runner/               Child process runner and command guard
  settings/             Settings and About panels
  tokens/               Token counting and token usage meter
  webview/              VS Code webview provider, controller, handlers, protocol
  webview-ui/           React chat UI

media/
  agents/               Bundled markdown agents
  skills/               Bundled markdown skills
  subagents/            Bundled subagent prompts
  webview/              Built webview assets
```

---

## Architecture Principles

Nexus Code follows a Clean Architecture-style separation:

```text
core -> application -> infrastructure/providers/webview
```

Core principles:

- domain contracts stay in `src/core`;
- orchestration and use cases stay in `src/application`;
- provider-specific command building and parsing stay in `src/providers`;
- VS Code webview glue stays in `src/webview`;
- React UI state and rendering stay in `src/webview-ui`;
- context construction stays in `src/context`;
- external process execution stays behind runner abstractions;
- provider output parsing is separated from process execution;
- prompt enhancement is explicit and inspectable;
- risky tool flows are gated by configuration and execution policy.

---

## Safety and Boundaries

Nexus is designed to keep potentially risky work visible and controllable:

- tasks stream output live;
- active tasks can be stopped;
- enhanced prompts can be inspected;
- branch review uses explicit git context;
- generated plans can be saved before implementation;
- MCP high-risk tools can require approval;
- MCP results are compressed and size-limited;
- file attachments are normalized as workspace-relative paths;
- generated project-map cache files are isolated under `.nexus/`.

---

## Typical Workflows

### Ask a Workspace Question

1. Open **Nexus: Open Chat**.
2. Choose mode `ask`.
3. Select a provider such as `codex`, `claude`, or `nexus`.
4. Ask the question.
5. Inspect streamed output and enhanced prompt if needed.

### Create an Implementation Plan

1. Choose mode `plan`.
2. Mention a relevant agent, for example `@software-architect`.
3. Mention a skill if useful, for example `#api-design`.
4. Send the prompt.
5. Review the generated plan before asking for code changes.

### Review a Branch

1. Choose mode `review`.
2. Select or provide a base branch.
3. Nexus gathers git review context.
4. Use `@code-review` for stricter review output.
5. Review issues by severity and affected file.

### Fix a Bug

1. Choose mode `debug` or `edit`.
2. Attach relevant files or folders.
3. Use `#bug-fix`.
4. Ask Nexus to identify root cause, propose a scoped fix, and add regression tests.

### Build a Project Map

```bash
nexus map --root .
```

Then inspect:

```text
.nexus/project-map.md
.nexus/workspace-units.json
```

---

## Packaging Notes

The repository includes VSIX artifacts in the archive, but local development should generally rebuild from source:

```bash
npm install
npm run compile
```

When publishing or packaging a new version, confirm:

- `package.json` version is correct;
- extension bundle is compiled;
- webview bundle is compiled;
- CLI bundle is built if needed;
- tests and typecheck pass;
- generated `.DS_Store` and `__MACOSX` artifacts are not included in release packaging.

---

## License

See [`LICENSE`](./LICENSE).
