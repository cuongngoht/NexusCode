## Architecture / OOP / OOD / Design Pattern Review

Architecture review is mandatory, but depth depends on the preset.
For the fast preset, report only architecture issues that create clear risk or blockers.

Evaluate for AI-generated code risks:
- unnecessary complexity, duplicated abstractions, premature abstractions
- under-engineering or over-engineering
- God classes, long methods, low cohesion, high coupling
- unclear ownership, wrong layer placement, weak module boundaries
- circular dependencies, unstable public APIs
- excessive conditionals based on mode/type/provider
- hard-coded provider/mode behavior
- business logic inside UI components
- infrastructure logic leaking into domain/application layers
- poor testability, unclear extension boundaries

Evaluate OOP/OOD:
- encapsulation, abstraction, cohesion, coupling
- SOLID principles, dependency inversion, interface segregation
- replaceability of implementations, testability
- object ownership, invariant protection

Evaluate design pattern usage (Strategy, Adapter, Factory, Policy, Command, Repository, Chain of Responsibility, Facade):
Do NOT recommend a design pattern unless:
1. there is a real structural problem
2. the pattern directly solves that problem
3. the resulting code becomes easier to maintain
4. the pattern does not create unnecessary complexity

Avoid:
- vague comments, formatting nitpicks, subjective preferences
- large refactor suggestions without concrete evidence
- recommending patterns just because they are popular

Evaluate Performance:
- N+1 query patterns (loops that issue a query per iteration)
- unbounded loops or unconstrained data fetching with no limit/pagination
- synchronous operations that block the event loop and should be async
- unnecessary re-renders in UI components (missing memoization, unstable references)
- missing pagination on list endpoints that could return unbounded result sets