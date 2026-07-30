---
name: codebase-mapping
description: Builds a durable architecture map of an unfamiliar codebase and saves it to .nexus/project-understanding/ so every later Nexus task starts informed. Use when joining a new project, when you need to know where something lives before changing it, when the existing project understanding is stale, or when a task keeps failing because the agent lacks structural context.
---

# Codebase Mapping

## Overview

Read a whole project once, carefully, and write down what you learned — so nothing has to re-derive it.

This skill produces a **persisted** artifact, not a chat answer. The output lands in `.nexus/project-understanding/` and is injected as context into later Nexus tasks. That is the whole point: a scan whose findings evaporate at the end of the turn has to be paid for again on every subsequent question.

**The standard to hold yourself to:** someone who has never opened this repository should be able to read your map and correctly guess which file to open for a given change. If your map cannot do that, it is a file listing, not a map.

## When to Use

- First contact with an unfamiliar codebase
- The saved understanding is missing or stale (a large refactor landed, directories moved)
- A task failed because the agent guessed wrong about where logic lives
- Before `onboarding-guide` or `code-health-audit` — both are far better with a map to build on

## When Not to Use

- You only need one file explained → just read the file
- The saved map is fresh and the question is answerable from it → read `.nexus/project-understanding/understanding.md` instead of re-scanning
- You are mid-implementation on a well-understood change → mapping is a detour

## Workflow

### Phase 1 — Cheap structural pass (no file reading)

Establish the skeleton before spending any budget on file contents.

1. **Enumerate tracked files.** `git ls-files` when available; otherwise walk the tree honouring `.gitignore`. Never enumerate `node_modules`, `dist`, `out`, `build`, `.git`, or vendored directories.
2. **Read the manifests only** — `package.json`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `pom.xml`, `*.csproj`. These name the languages, frameworks, entry points, scripts, and dependency surface for free.
3. **Read the project's own docs if they exist** — `README`, `CLAUDE.md`, `AGENTS.md`, `ARCHITECTURE.md`, `docs/`. A project that documents its own layering saves you from inferring it, and disagreeing with it silently is a bug in your map.
4. **Count and group.** Files per directory, per language. The shape of the tree already tells you whether this is a monorepo, a layered app, or a flat script pile.

> **Trap:** a stale `ARCHITECTURE.md` is common. Treat project docs as a *claim* to verify against the tree, not ground truth. Where they disagree, say so in the map — that discrepancy is one of the most useful things you can record.

### Phase 2 — Identify the load-bearing files

You cannot read everything. Choose deliberately, and say what you chose.

Rank candidates by these signals, strongest first:
- **Entry points** — manifest `main`/`bin`/`scripts`, `index.*`, `main.*`, `extension.ts`, `server.*`, route registries, CLI definitions
- **Fan-in** — files imported by many others (the project's load-bearing walls)
- **Composition roots** — where dependencies get wired together; usually the single most informative file in the repo
- **Config and schema** — what the system is allowed to do, and the shape of its data
- **Size × directory centrality** — a large file in a core directory earns a read

Read the top ~20-40 such files. Budget for breadth over depth: skimming forty files teaches you more about a system's shape than studying five.

### Phase 3 — Derive the layering

For each layer you identify, record its **name**, its **responsibility in one sentence**, its **directories**, and **what it is allowed to depend on**.

Do not invent textbook layers the code does not have. If this project is genuinely three directories with no layering, the honest map says so — a fabricated hexagonal architecture actively misleads the next reader.

Then check the dependency direction. Note any place where the code violates its own stated rule (an inner layer importing an outer one, a domain module importing a framework). Those are the findings that make a map worth reading.

### Phase 4 — Trace one real path end to end

Pick the single most representative user-facing operation and trace it through every layer, naming the actual files in order.

> This is the highest-value section of the entire map. Layer diagrams are forgettable; a concrete "click → handler → use case → adapter → process" chain with real filenames is what lets someone make their first change without help.

### Phase 5 — Write and persist

Write the map to `.nexus/project-understanding/understanding.md` using the structure below, and the metadata to `.nexus/project-understanding/manifest.json`.

Create the directory if it does not exist. Overwrite both files — this is a snapshot at a commit, not an append log.

```json
{
  "version": 1,
  "schemaVersion": "project-understanding-v1",
  "status": "ready",
  "generatedAt": "<ISO 8601>",
  "commit": "<short git hash, or \"no-git\">",
  "branch": "<current branch, or omit>",
  "filesScanned": 0,
  "filesRead": 0,
  "languages": [],
  "frameworks": []
}
```

`filesScanned` is how many the structural pass saw; `filesRead` is how many you actually opened. Recording both is what lets a later reader judge how much of the map is grounded versus inferred.

## Output Structure

Write `understanding.md` exactly like this. Keep it under ~400 lines — this file is injected as prompt context, so every line costs tokens on every later task.

```markdown
# Project Understanding — <project name>

_<short commit> · <branch> · generated <ISO date> · <N> files scanned, <M> read_

## What this project is

<Two to four sentences. What it does, who uses it, what shape of software it is
(CLI, extension, service, library). No marketing language.>

## Stack

| Aspect | Detail |
|---|---|
| Languages | |
| Frameworks | |
| Package manager | |
| Build | |
| Test | |
| Entry points | |

## Layers

### <Layer name>
**Responsibility:** <one sentence>
**Lives in:** `path/`, `path/`
**May depend on:** <layers>

<Repeat per layer. 3-7 layers is typical. Fewer is fine and honest.>

## Dependency rule

<The rule in one line, e.g. "outer layers import inner; inner never import outer".
Then any violations you found, with file paths. If you found none, say so —
that is a real finding.>

## How a request flows

<The Phase 4 trace, as a numbered list of real files in order. Each step: what
happens and where.>

## Where to make common changes

| I want to... | Start in |
|---|---|
| Add a new <domain concept> | `path/to/file.ts` |
| Change <user-visible behaviour> | `path/` |
| Add a test for <area> | `path/` |

<This table is what most readers will actually use. Make it concrete.>

## Conventions that are not obvious

<Project-specific rules a newcomer would violate by accident: naming schemes,
files that must stay in sync, generated files that must not be edited, an
i18n file that is the type master, invariants stated in CLAUDE.md.>

## Gotchas

<Things that will waste someone's afternoon. Platform-specific build failures,
a dependency pinned for a non-obvious reason, a test that only passes after a
build step.>

## What I did not cover

<Directories skipped and why; areas where the map is inference rather than
reading. Be specific — an unmarked gap reads as a covered area.>
```

## Verification

The map is not done until all of these hold:

1. **Every file path in the map exists.** Check them. A map that confidently names a file that was renamed six months ago is worse than no map, because it will be trusted.
2. **The "How a request flows" trace is complete** — no "...and then it gets handled" hand-waves. Every hop names a file.
3. **`manifest.json` parses** and its `commit` matches the current HEAD.
4. **The map contradicts nothing you actually read.** Where it contradicts project docs, that discrepancy is written down explicitly.
5. **Nothing was invented.** Every layer, rule, and convention traces back to something you read. If you inferred it, the "What I did not cover" section says so.

## Rules

1. **Persist, always.** A mapping run that ends without writing `.nexus/project-understanding/` has produced nothing durable and has to be redone.
2. **Project-relative paths only.** The artifact gets committed and shared; absolute paths leak the machine's directory layout and break for everyone else.
3. **Prefer the project's vocabulary over generic terms.** If the codebase calls it a "pipeline step", the map says pipeline step — not "middleware". Matching the code's own language is what makes the map searchable.
4. **Record uncertainty inline.** "Probably the composition root — `activate()` wires everything but I did not verify all call sites" is useful. Stating it as fact is not.
5. **Keep it short enough to inject.** Under ~400 lines. If a section grows past its value, cut it — this file is paid for on every later task, not just this one.
6. **Do not modify project code.** This skill reads, and writes only inside `.nexus/`.
