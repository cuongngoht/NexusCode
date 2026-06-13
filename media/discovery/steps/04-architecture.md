# Step 4: Architecture Discovery

## Goal
Identify the architectural style and locate the key structural files.

## Architecture Style Detection

Look for evidence of common patterns:

| Pattern | Evidence |
|---|---|
| **Clean Architecture / Hexagonal** | `core/`, `domain/`, `application/`, `infrastructure/`, `interface/` or `adapters/` folders |
| **MVC** | `models/`, `views/`, `controllers/` folders |
| **Feature-sliced** | `features/`, `pages/`, `entities/`, `shared/` folders |
| **Microservices** | Multiple `services/` subdirs, each with own manifest |
| **Monolithic** | Single `src/` with mixed concerns |
| **CQRS** | `commands/`, `queries/`, `handlers/` folders |
| **Event-driven** | Prominent event bus + producer/consumer split |

## File Pattern Search

Search recursively in source roots (skip excluded folders). Locate files by name suffix:

| Suffix pattern | Role |
|---|---|
| `*Orchestrator.*` | orchestrators |
| `*Handler.*` | handlers |
| `*Controller.*` | controllers |
| `*Router.*` / `*Routing*.*` | routers |
| `*Policy.*` | policies |
| `*Registry.*` | registries |
| `*Service.*` | services |
| `*UseCase.*` / `*use_case.*` | use cases / application services |
| `*Repository.*` / `*Repo.*` | repositories |
| `*Store.*` | state stores |
| `*Middleware.*` | middleware |
| `*Factory.*` | factories |
| `*Adapter.*` | adapters / ports |

List only architecture-relevant files (skip test files and pure type/interface-only files unless they define a key contract).

## Writes

- `architecture.style` — detected style or `null`
- `architecture.layers[]` — detected layer names
- `architecture.orchestrators[]`, `.handlers[]`, `.controllers[]`, `.routers[]`
- `architecture.services[]`, `.repositories[]`
- Write `.nexus/discovery/architecture-map.md` with: style, layer breakdown, key file list, facts vs inferences, recommended integration points
