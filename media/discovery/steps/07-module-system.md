# Step 7: Module & Plugin System

## Goal
Detect whether the project has a plugin, extension, or provider registration system — and understand
how to add new modules without breaking existing ones.

## Patterns to Search

### Registry / DI Container
- Class names: `*Registry`, `*Container`, `*Injector`, `*Provider`
- Method calls: `.register(`, `.bind(`, `.provide(`, `.use(`, `.add(`
- DI packages in deps: `inversify`, `tsyringe`, `typedi`, `awilix`, `nestjs` DI

### Plugin / Extension System
- Folders: `plugins/`, `extensions/`, `addons/`, `providers/`, `integrations/`
- Interface patterns: `IPlugin`, `IProvider`, `IExtension`, `BasePlugin`, `BaseProvider`
- Loader patterns: `loadPlugins`, `registerPlugin`, `createPlugin`

### Factory / Strategy Pattern
- Files: `*Factory.*`, `*Strategy.*`, `*Resolver.*`
- Used to swap implementations based on config or runtime conditions

### Feature Flags / Capability System
- Files: `*Capabilities.*`, `*Feature.*`, `*Toggle.*`

## What to Record

1. Find the **registry or container** where modules are registered.
2. Find the **base interface or abstract class** that all plugins/providers must implement.
3. Find the **composition root** (where everything is wired together — usually the main entry point).
4. List the **existing registered modules** as examples.
5. Note **how to add a new module**: what interface to implement, where to register.

## Writes

- `architecture.moduleSystem[]` — key files for the plugin/module infrastructure
- `confidence.moduleSystem`
- Append to `integrationNotes`:
  - "Composition root is at `<path>`. Register new modules there."
  - "Base interface for new modules: `<interface name>` at `<path>`"
- Write to `.nexus/discovery/integration-points.md` under **Module / Plugin System** section
