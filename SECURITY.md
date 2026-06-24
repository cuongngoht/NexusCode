# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

To report a security vulnerability in Nexus AI Code:

1. **Open a GitHub Issue** at https://github.com/cuongngoht/NexusCode/issues with the label `security`.
2. **Do not** include API keys, tokens, credentials, or exploit code in public issue descriptions.
3. For sensitive disclosures, contact the publisher directly before filing a public issue.

**Response timeline:**
- Acknowledgement within 72 hours of report.
- Status update within 7 days.
- Remediation will be released as a patch version when a confirmed vulnerability is fixed.

## Scope

The following are in scope for security reports:

- VS Code extension host code (`src/`)
- CLI companion build output
- Provider routing and command execution logic
- MCP tool layer integration
- Custom provider command configuration and execution
- Webview content security policy and postMessage handling
- Prompt enhancement and workspace context inclusion logic

## Out of Scope

The following are **not** in scope:

- Vulnerabilities in third-party provider CLIs (Claude Code, Codex, Aider, Copilot, Grok, etc.)
- Vulnerabilities in AI provider services or APIs
- Behavior of user-configured CLI tools
- Issues arising from user-supplied prompts containing sensitive data

## Security Boundaries

- **No bundled API keys**: Nexus AI Code does not bundle provider API keys, tokens, or credentials. Provider authentication is handled by the provider CLI or user VS Code configuration.
- **Explicit invocation only**: Provider CLIs and custom commands are invoked only during explicit user-initiated actions (prompt submission). No background execution occurs without user action.
- **Custom provider safety**: The custom provider command is entirely user-configured. Nexus validates that the executable name does not contain shell metacharacters before invoking it. Arguments are passed as an array — no shell interpolation occurs.
- **MCP tool approval**: High-risk MCP tool calls (file writes, shell commands, network access, destructive operations) require user approval by default (`nexus.mcp.requireApprovalForHighRiskTools` is `true` by default). MCP is disabled by default (`nexus.mcp.enabled` is `false` by default).
- **Local analytics only**: The optional analytics module records task metadata in VS Code workspace state. No data is transmitted to external servers. Workspace path and conversation titles are not stored by default.
- **Workspace context**: When prompt enhancement is enabled, selected workspace context (project structure, rules, conversation history) may be included in prompts sent to the selected provider. Users control which provider receives their prompts and can disable prompt enhancement.
