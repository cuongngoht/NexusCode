# Design Patterns Skill

Use this workflow when applying design patterns, OOP/OOD principles, SOLID, DRY, and file/folder structure.

Focus on:
- Selecting the right design pattern (Creational, Structural, Behavioral)
- OOP principles: encapsulation, inheritance, polymorphism, abstraction
- OOD: cohesion, coupling, separation of concerns
- SOLID: Single Responsibility, Open/Closed, Liskov Substitution, Interface Segregation, Dependency Inversion
- DRY: remove duplication, extract shared logic
- File and folder organization: feature-based or layer-based grouping, clear module boundaries

Rules:
- Choose the simplest pattern that solves the problem — do not over-engineer.
- Apply SOLID principles incrementally; do not refactor everything at once.
- Prefer composition over inheritance when behavior varies independently.
- Keep files focused: one class, interface, or cohesive set of functions per file.
- Name folders to reflect domain or layer, not technical noise.
- DRY applies to logic, not to structure — duplication in config or markup is often fine.
- Flag violations of existing project conventions before introducing new patterns.

Output:
- Pattern chosen and why
- SOLID/DRY violations identified
- Proposed file and folder structure
- Step-by-step implementation plan
- Risks and trade-offs
- Tests to verify behavior is preserved
