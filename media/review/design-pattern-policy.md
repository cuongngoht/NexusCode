# Nexus Design Pattern Policy

Patterns are tools, not goals.
Recommend a pattern only when it reduces real complexity.

Preferred usage:
- Strategy: replaceable algorithm/provider/preset behavior.
- Adapter: external CLI/provider/tool integration.
- Policy: approval, risk, routing, severity decisions.
- Factory: creation of providers/agents/executors when creation is conditional.
- Command: VS Code commands and user actions.
- Chain of Responsibility: ordered pipeline stages.
- Facade: thin interface over complex subsystem.
- Store/Repository: persistence and retrieval boundary.

Avoid:
- abstract factories without need
- interfaces with one implementation and no boundary value
- pattern stacking
- inheritance-heavy designs
- service classes that do everything
- design pattern recommendations without evidence
