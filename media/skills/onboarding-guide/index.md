---
name: onboarding-guide
description: Produces an onboarding guide that gets a new contributor to their first merged change. Use when someone joins a project, when handing a codebase over, when the README explains what the project is but not how to work on it, or when the same setup questions keep getting asked.
---

# Onboarding Guide

## Overview

Write the document you wish you had on your first day.

The measure of an onboarding guide is not how much it explains — it is **how quickly a new contributor lands their first correct change**. Everything that does not serve that outcome is reference documentation, and belongs elsewhere.

**What makes this different from a codebase map:** `codebase-mapping` answers "how is this system built?" This answers "what do I do on Monday?" A map is a reference you return to; a guide is a path you walk once, in order.

## When to Use

- Someone new is joining, or a codebase is being handed over
- The README says what the project is but not how to develop on it
- The same setup questions keep coming up
- You just finished `codebase-mapping` and want the human-facing companion

## When Not to Use

- The reader needs the architecture, not a path → `codebase-mapping`
- They need one file explained → just explain the file
- What is actually missing is API reference or ADRs → `documentation-and-adrs`

## Workflow

### Phase 1 — Read the saved understanding first

If `.nexus/project-understanding/understanding.md` exists, read it and build on it. Do not re-derive the architecture — it is already written down, and a guide that contradicts the map is worse than either alone.

If it does not exist, run `codebase-mapping` first. Writing an onboarding guide without a structural pass means guessing about layering, and new contributors are exactly the readers least able to detect your guesses.

### Phase 2 — Verify setup by actually doing it

This is the phase people skip, and it is the reason most onboarding docs are wrong.

Read the manifests and CI config for the real commands — `package.json` scripts, `Makefile`, `.github/workflows/`. CI is the most trustworthy source available: it is the setup that provably works, because it runs on every commit.

Then **run the steps yourself**, in order, and record what actually happens:
- Install → does it complete? Any peer-dependency warnings that matter?
- Build → does it pass from clean?
- Test → do they pass? How long do they take?
- Run → does the thing start?

> **Trap:** never copy setup steps out of an existing README without running them. Stale setup instructions are the single most common defect in onboarding docs, and they cost a newcomer their entire first day — precisely when they have the least context to debug with.

Record the **exact versions** that work (Node, Python, package manager), not just names. "Node 22" is actionable; "a recent Node" is not. Note where the version is pinned (`engines`, `.nvmrc`, `packageManager`, `pyproject.toml`) so the reader can check rather than guess.

### Phase 3 — Design a reading order

Pick 5-10 files, in the order a newcomer should open them, and say **why each one** and **what to notice**.

Order by narrative, not importance: start where execution starts (the entry point), follow one real path inward, and end somewhere they could plausibly make a change. A list of "the 10 most important files" sorted by importance teaches nothing about how the system fits together.

For each file: the path, one line on why it is on the list, and one line on the specific thing to notice in it.

### Phase 4 — Find the gotchas

These are what a guide uniquely provides — the things that are true but written down nowhere.

Mine them from:
- **`CLAUDE.md` / `AGENTS.md` / `CONTRIBUTING.md`** — invariants the project states about itself
- **Comments containing "don't", "must", "note that", "careful", "HACK", "workaround"** — someone was surprised here and left a warning
- **Files that must stay in sync** — a type master and its translations, duplicated unions, a generated file and its source
- **Non-obvious build ordering** — a package that must be built before another can typecheck
- **Platform-specific failures** — a native dependency that breaks on Apple Silicon, a script that assumes GNU coreutils

> A gotcha is only worth listing if it would cost someone real time. "Remember to save your files" is noise. "The webview bundle can't import from core, so this type union is duplicated in two files and both must be edited" is the whole value of the document.

### Phase 5 — Give them a first task

End with a concrete, genuinely small, genuinely useful change — and name the files it touches.

The point is not the change; it is completing the loop. Edit → build → test → verify teaches the workflow in a way no amount of prose does, and it converts reading into confidence.

Good first tasks: add a test for an untested pure function; add a missing i18n key; improve one error message. Bad first tasks: anything touching the architecture, anything with no clear "done", anything requiring a design decision.

## Output Structure

Write to `docs/ONBOARDING.md` unless the project has an obvious convention that says otherwise. This one is for humans and belongs in the repo, not in `.nexus/`.

```markdown
# Onboarding — <project name>

## What this project is

<Three or four sentences. What it does, who uses it, what shape of software it
is. Enough that the reader knows what they are looking at.>

## Prerequisites

| Tool | Version | Pinned in |
|---|---|---|

<Exact versions that are known to work, and where each is pinned.>

## Setup

```bash
# Each command with the outcome you actually observed
```

**Expected:** <what success looks like — the output, the port, the passing count>

**If it fails:** <the failure you actually hit, and the fix>

## Verify your setup works

<One command that proves the environment is good, and its expected output.
Without this the reader cannot distinguish "my setup is broken" from
"my change is broken" — which is the worst place to leave someone.>

## Read these, in this order

1. **`path/to/file`** — <why it's first>
   Notice: <the specific thing to see>

<5-10 entries, ordered as a narrative.>

## How the pieces fit

<A short prose version of the architecture — three or four paragraphs, no
diagram. Link to the full map rather than duplicating it: a guide that
restates the map will drift from it.>

## Daily workflow

| Task | Command |
|---|---|
| Run tests | |
| Run one test | |
| Build | |
| Lint | |
| Start it | |

<Include "run one test" specifically. It is the command people need most often
and the one least often documented.>

## Conventions

<Project-specific rules, each with a reason. A rule without a reason gets
violated the first time it is inconvenient.>

## Gotchas

<Things that will cost you time. Be specific and say what the symptom looks
like, so the reader recognises it when it happens.>

## Your first task

<A concrete small change, the files it touches, and how to verify it.>

## Where to ask

<Code owners, the right channel, or how to figure out who owns an area —
e.g. `git log` on the directory.>
```

## Verification

1. **You ran every command you wrote down**, on this machine, in the order given. Untested setup instructions are the defect this skill exists to prevent.
2. **Every file path exists.** Check them.
3. **The "verify your setup works" command genuinely passes** from a clean state.
4. **The first task is real** — small, useful, and completable with only this guide.
5. **The guide does not contradict** `.nexus/project-understanding/understanding.md` or the project's own docs. Where it must differ, it says why.

## Rules

1. **Verify, do not transcribe.** Every command gets run. This is the rule the whole skill rests on.
2. **Write for someone with zero context on this project** but professional competence generally. Do not explain what a unit test is; do explain why *this* project needs a build before typecheck.
3. **Give reasons, not just rules.** "Add keys to both locale files" is forgettable. "vi.json is the TypeScript type master, so a key missing from en.json is a compile error" is remembered.
4. **Link the map, do not copy it.** Duplicated architecture prose drifts and then misleads.
5. **Prefer the reader's first day over completeness.** If a section does not help someone reach their first merged change, cut it or move it to reference docs.
6. **Say what you did not verify.** If the Windows setup path was untested because you are on macOS, mark it — an unmarked instruction reads as a verified one.
