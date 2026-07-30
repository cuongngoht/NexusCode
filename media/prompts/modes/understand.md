# Understand Mode

Build a durable map of this codebase and **persist it to disk**. The map is the deliverable — an explanation that only exists in this conversation has to be paid for again on every future task.

## What to produce

Write two files:

- `.nexus/project-understanding/understanding.md` — the map
- `.nexus/project-understanding/manifest.json` — its metadata

Follow the `codebase-mapping` skill workflow. It is mandatory, not advisory: it encodes the ordering that keeps this affordable on a large repository.

## Method, in order

1. **Cheap structural pass first.** Enumerate tracked files, read the manifests (`package.json`, `pyproject.toml`, `go.mod`, …) and the project's own docs (`README`, `CLAUDE.md`, `AGENTS.md`, `ARCHITECTURE.md`). Do not open source files yet — the skeleton is nearly free and tells you where to spend.

2. **Choose what to read, deliberately.** You cannot read everything. Rank by entry points, fan-in (files imported by many others), composition roots, config/schema, and size × directory centrality. Read the top 20-40. Breadth beats depth here: skimming forty files teaches more about a system's shape than studying five.

3. **Derive the real layering.** Name each layer, its one-sentence responsibility, its directories, and what it may depend on. Never invent textbook layers the code does not have — if this project is three directories with no layering, say so.

4. **Trace one request end to end**, naming actual files in order. This is the highest-value section: layer diagrams are forgettable, but a concrete "entry → handler → use case → adapter" chain with real filenames is what lets someone make their first change.

5. **Record the non-obvious.** Conventions a newcomer would violate by accident, files that must stay in sync, gotchas that cost an afternoon.

6. **Write both files.** The manifest carries `version: 1`, `schemaVersion: "project-understanding-v1"`, `status: "ready"`, `workspaceRootHash`, `generatedAt` (epoch ms), `commit`, `branch`, `filesScanned`, `filesRead`, `languages`, `frameworks`, `contentChars`.

## Constraints

- **Do not modify project source.** Write only inside `.nexus/`.
- **Every file path you name must exist.** Verify before writing. A map that confidently names a renamed file is worse than no map, because it will be trusted.
- **Project-relative paths only** — never absolute. The artifact is shared and committed.
- **Keep the map under ~400 lines.** It is injected as context into every later task, so its length is paid for repeatedly.
- **Use the project's own vocabulary.** If the code says "pipeline step", write pipeline step, not "middleware".
- **Mark inference as inference.** Say what you read versus what you concluded, and list what you did not cover. An unmarked gap reads as a covered area.
- **Treat existing project docs as claims to verify**, not ground truth. Where `ARCHITECTURE.md` and the tree disagree, record the discrepancy — it is one of the most useful things in the map.

## If a map already exists

Read `.nexus/project-understanding/understanding.md` first and **revise** it rather than starting over. Preserve the conventions and gotchas sections — those are the hardest-won parts and rarely invalidated by a refactor. Update structure, paths, and the traced path.

## Report back briefly

State where the artifact was written, the project's shape in three or four sentences, the single most useful thing you learned, and what you did not cover. Do not paste the map into your reply — it is on disk, and duplicating it defeats the purpose of persisting it.
