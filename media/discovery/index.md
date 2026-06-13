# Project Discovery Orchestrator

## Purpose

Analyze the current workspace and produce a structured project profile that future agents can use
without re-scanning the codebase from scratch.

Works for any language, runtime, or architecture: TypeScript, JavaScript, Python, Go, Rust, Java,
monorepos, CLIs, APIs, desktop apps, libraries, and more.

## Output Files

Create all of the following under `.nexus/`:

| File | Audience |
|---|---|
| `.nexus/project-profile.md` | LLM agents and future spec prompts |
| `.nexus/project-scan.json` | Tooling and code that reads project metadata |
| `.nexus/scan-report.md` | Human-readable summary for developers |
| `.nexus/discovery/architecture-map.md` | Architecture and component relationships |
| `.nexus/discovery/scripts.md` | Build, test, and toolchain commands |
| `.nexus/discovery/integration-points.md` | Where future features should hook in |
| `.nexus/discovery/conventions.md` | Naming, structure, and coding conventions |
| `.nexus/discovery/risks.md` | Detected risks and unknowns |

## Execution

Run each numbered step file in `steps/` in order.
Each step enriches the project profile by reading files in the workspace.

After all steps complete, write all output files listed above.

## Universal Constraints

- **Do NOT modify any source files.** Only create/update files inside `.nexus/`.
- **Avoid deep traversal** of generated or vendored folders: `node_modules`, `.git`, `dist`,
  `out`, `build`, `target`, `coverage`, `__pycache__`, `.venv`, `venv`, `vendor`, `bin`,
  `.next`, `.nuxt`, `.turbo`, `.cache`
- **Evidence-based only.** Do not claim a tool, framework, or pattern is used unless you have
  found direct evidence (file, dependency, config, or code reference).
- **Separate facts from inferences.** Label every finding as one of:
  - **Fact** — directly observed in a file
  - **Inference** — reasoned from indirect evidence (confidence 0.5–0.75)
  - **Recommendation** — a suggested action based on findings
- **Confidence scores.** Use 0.25 / 0.5 / 0.75 / 0.95 for key findings.

## `project-scan.json` Required Shape

```json
{
  "projectIdentity": {
    "name": null,
    "type": null,
    "language": null,
    "runtime": null,
    "packageManager": null,
    "isMonorepo": false,
    "frameworks": []
  },
  "paths": {
    "entrypoints": [],
    "sourceRoots": [],
    "testRoots": [],
    "uiRoots": [],
    "configFiles": [],
    "rulesFiles": []
  },
  "architecture": {
    "style": null,
    "layers": [],
    "orchestrators": [],
    "handlers": [],
    "controllers": [],
    "routers": [],
    "services": [],
    "repositories": [],
    "eventBus": null,
    "communicationProtocol": null,
    "moduleSystem": []
  },
  "existingFeatures": [],
  "scripts": {
    "typecheck": null,
    "build": null,
    "test": null,
    "lint": null,
    "format": null,
    "dev": null,
    "custom": {}
  },
  "dependencies": {
    "production": [],
    "development": []
  },
  "excludeFromIndex": [],
  "confidence": {},
  "risks": [],
  "unknowns": []
}
```

## Customizing Discovery

To customize discovery for a specific project, copy `.nexus/discovery/` and edit the step files.
The bundled steps in `media/discovery/steps/` are the generic defaults.

> **Best practice:** Keep customized steps minimal — only override steps where your project diverges
> from the generic pattern. This makes updates easier when the bundled defaults improve.
