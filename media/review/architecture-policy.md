# Nexus Architecture Policy

Review code for long-term maintainability.

Rules:
- UI/webview components should not contain business orchestration logic.
- VS Code API access should stay in extension/infrastructure boundary.
- Application layer should orchestrate use cases.
- Domain/core logic should avoid depending on UI, VS Code API, provider CLI, or filesystem where possible.
- Provider-specific logic should be isolated behind adapters.
- Mode-specific behavior should use policy/strategy instead of large if/switch chains when it grows.
- Risky actions should go through approval policy.
- Review/fix/debug flows should be modeled as explicit pipelines or use cases.
- Handlers should stay thin.
- Stores should own persistence/state concerns.
- Parsers should not execute side effects.
- Prompt builders should not execute IO.
- Result parsers should be defensive and never crash user workflow.
