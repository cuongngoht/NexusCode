# Step 10: Risks & Unknowns

## Goal
Identify issues that could block or complicate future feature implementation.

## Risk Checklist

Check each condition and add to `risks[]` if true:

| Condition | Risk message |
|---|---|
| Multiple lockfiles exist | "Multiple lockfiles — package manager is ambiguous" |
| No `typecheck` or equivalent script | "No type-checking command found — type safety unverified" |
| No `test` or equivalent script | "No test command found — automated coverage unclear" |
| No `build` or `compile` script | "Build process unclear — no build/compile script found" |
| `architecture.eventBus` is null | "No event bus detected — async communication pattern unknown" |
| `architecture.communicationProtocol` is null | "Communication protocol unclear — IPC / API layer not identified" |
| `architecture.moduleSystem` is empty | "No module/plugin system detected — extension pattern unknown" |
| No `paths.entrypoints` found | "Entry point not identified — bootstrap sequence unknown" |
| Source root > 500 files (estimate) | "Large source tree — indexing/search may be slow" |
| Circular dependency indicators found | "Possible circular imports detected — verify with lint tool" |
| `core/` or `domain/` imports from outer layers | "Architecture invariant violation suspected — check import direction" |
| Mixed dependency lockfiles in monorepo packages | "Monorepo package manager consistency unclear" |

## Unknowns

Add to `unknowns[]` for anything you searched for but could not determine:
- Architecture style if no clear pattern was found
- Package manager if no lockfile and no `package.json`
- Entry point if none of the common names matched
- Test framework if no config file or test runner found

## Exclusion Recommendations

List folders that **exist** and should be excluded from indexing (already recorded in step 1, confirm here):
Standard excludes: `node_modules`, `.git`, `dist`, `out`, `build`, `target`, `coverage`,
`__pycache__`, `.venv`, `venv`, `vendor`, `.next`, `.nuxt`, `.turbo`, `.cache`, `bin`, `obj`

## Writes

- `risks[]` — all detected risks
- `unknowns[]` — all unresolved unknowns
- Write `.nexus/discovery/risks.md` with: severity (high/medium/low), evidence, recommended mitigation for each risk
