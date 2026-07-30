---
name: code-health-audit
description: Audits a codebase for technical debt using measured evidence — churn/complexity hotspots, missing tests, import cycles, oversized files, dead code, duplication, coupling — and produces a prioritised report. Use when deciding what to refactor next, when planning a cleanup sprint, when a codebase feels risky to change, or when you need to justify refactoring work with numbers instead of opinion.
---

# Code Health Audit

## Overview

Find the places this codebase will actually hurt to change, rank them honestly, and say what to do about each.

The discipline that makes this useful: **measure first, judge second**. Every claim in the report traces back to a number you computed, never to how the code felt while reading it. Opinions about code quality are cheap and unfalsifiable; a file changed 47 times by 9 authors with no test is an argument.

**What separates this from a code review:** review asks "is this change correct?" This asks "where is this codebase expensive?" Different question, different evidence, different output.

## When to Use

- Planning what to refactor next, and wanting the decision to survive scrutiny
- A codebase feels risky to change but nobody can say precisely where
- Justifying cleanup work to someone who will ask "why this file?"
- Before onboarding people onto an unfamiliar system
- Periodically, to track whether debt is growing or shrinking

## When Not to Use

- Reviewing a specific change → `code-review-and-quality`
- Chasing a specific slow path → `performance-optimization`
- Hunting a specific vulnerability → `security-and-hardening`
- Simplifying code you already know is too complex → `code-simplification`

## Workflow

### Phase 1 — Measure with a script, not by reading

Write **one** throwaway script (Node or Python), run it, have it emit a single JSON file, then read that JSON back.

Do not compute these metrics by reading files into context. On any real repository you will exhaust the context window before finishing, and numbers produced by eye are not reproducible — which destroys the ability to compare two runs.

Collect all of the following. Each item names the trap that makes the naive version wrong.

#### 1.1 Scope the file set

Consider only source files. **Exclude** tests, generated output, vendored code, lockfiles, and build artifacts from the scored set.

> **Trap:** scoring fixtures and config makes a repo with a big test-data directory look catastrophically untested. Measure source; mention non-source only when it is itself the problem.

Detect test files by a `test/`, `tests/`, `__tests__/`, `spec/`, or `e2e/` path segment, or a `.test.*` / `.spec.*` / `_test.*` / `test_*` filename.

#### 1.2 Git churn — one process, not one per file

```bash
git log --no-merges --since="12 months ago" --format='__COMMIT__%x09%H%x09%an%x09%aI' --numstat
```

Parse as a stream: `__COMMIT__` lines set the current author and date; the following `<added>\t<deleted>\t<path>` lines attribute that commit to each path. Accumulate per file: **commit count**, **distinct authors**, **most recent commit date**.

> **Trap:** one `git log` per file turns a 3000-file repo into minutes of subprocess overhead. One streaming pass costs about a second.
>
> **Trap:** renames appear as `old => new` or `prefix/{old => new}/suffix`. Rewrite them to the new path or that file's churn silently vanishes. Also note that without `--follow` (which accepts only one path) a renamed file shows a truncated history — so unexpectedly low churn on a recently-moved file is an artifact, not stability. Say so rather than calling it stable.

If there is no git history, set churn to zero and **state in the report that churn-based findings are unavailable**. Do not emit a report that looks complete when its strongest signal is missing.

#### 1.3 Physical metrics

Read each source file **once**:
- **LOC** — non-blank, non-comment-only lines. Raw line count flatters files with big license headers.
- **Max nesting depth** — for brace languages, peak count of unclosed `{`; for indentation languages, peak indent divided by the file's own smallest non-zero indent, so 2-space and 4-space projects stay comparable. For anything else, omit rather than report a wrong number.

#### 1.4 Import graph

Build `path -> [imported internal paths]`. Derive **dependents** (who imports this), **dependencies** (what this imports), and **cycles** — strongly-connected components of size > 1.

> **Trap:** use an **iterative** Tarjan. A recursive one blows the V8 stack on a deep monorepo chain.

If `.nexus/project-understanding/understanding.md` exists, use its layer definitions to report cycles in terms of layers, which is far more actionable than a list of paths.

#### 1.5 Test association

Mark a source file tested when either holds:
1. A test file imports it, or
2. Its filename stem matches a test stem (`foo.ts` ← `foo.test.ts`, `foo_test.go`, `test_foo.py`)

> **Trap:** never infer coverage from directory adjacency. A `tests/` folder beside a module says nothing about which files it covers, and counting it inflates the tested ratio — the one number readers are most likely to quote back at you.

#### 1.6 Dead code candidates

Files with zero dependents that are not plausible entry points (`index.*`, `main.*`, `extension.*`, anything under `bin/`, `cmd/`, `scripts/`, or named in a manifest's `main`/`bin`/`exports`).

> **Trap:** this check has the highest false-positive rate of any here. Dynamic imports, plugin registries, DI containers, and framework convention-loading (routes, migrations) all defeat static analysis. Treat every result as a **question**, never a conclusion.

#### 1.7 Duplication candidates

Hash sliding windows of ~6 normalised lines (trim, collapse whitespace, replace string literals, drop very short lines). Report **file pairs** sharing 4 or more distinct window hashes.

> **Trap:** report pairs, not clusters. A pair means "these diverged from a common ancestor" and is actionable; a cluster of twelve almost always means generated code.

#### 1.8 Score

Compute the p90 of LOC and of commits, and the median commits, across the scored set. Then per file:

```
score = 100
      - 30 × min(1, (commits / max(1,commitsP90)) × (loc / max(1,locP90)))   // hotspot: churn × size
      - 25 × (hasTests ? 0 : min(1, 0.4 + 0.6 × min(1, dependents / 5)))     // untested, by blast radius
      - 15 × min(1, loc / max(1, locP90 × 2))                                 // sheer size
      - 15 × min(1, (dependents / 25) + (dependencies / 40))                  // coupling
      - 10 × min(1, max(0, nestingDepth - 4) / 6)                             // nesting
      - 10 × (inCycle ? 1 : 0)                                                // cycle participation
```

Clamp to 0-100. Three choices worth understanding, because they shape what the report says:

- **Churn × size is multiplicative.** A large file nobody touches is mostly harmless; the same file changed weekly is where bugs breed. Multiplying means the penalty bites only when *both* are bad — the classic hotspot definition.
- **Missing tests scale with blast radius.** A flat penalty pushes toward blanket coverage; scaling by `dependents` shows where coverage buys the most.
- **Dependents outweigh dependencies** (÷25 vs ÷40). Many dependents means fragile-if-changed; many dependencies means hard-to-understand. Blast radius costs more.

Percentiles rather than absolute thresholds, so the same formula works on a 500-line CLI and a 500k-line monorepo.

**Repo score** = LOC-weighted mean of file scores. A flat mean lets 200 tiny healthy helpers drown out one rotten core module, and the headline number would look fine while the codebase burned.

#### 1.9 Emit findings mechanically

Severity comes from metrics, never from prose:

| Finding | Condition | Severity |
|---|---|---|
| Hotspot | commits ≥ p90 **and** LOC ≥ p90 | from score: <25 critical, <45 high, <65 medium, else low |
| Untested | no test association, LOC ≥ 30 | high if dependents ≥ 3 or commits ≥ median, else medium |
| Import cycle | SCC size > 1 | high if size > 3, else medium |
| Oversized file | LOC ≥ 2× p90 | high if ≥ 3× p90, else medium |
| Deep nesting | depth ≥ 6 | high if ≥ 9, else medium |
| Coupling | dependents ≥ 15 or dependencies ≥ 20 | high if ≥ 30 / ≥ 40, else medium |
| Duplication | 4+ shared windows | medium if ≥ 10, else low |
| Possibly dead | zero dependents, not an entry point | low, always (see 1.6) |
| Stale complexity | commits = 0, LOC ≥ 150, dependents ≥ 2 | low |

### Phase 2 — Judge (you, not the script)

The script produced candidates. Your value is deciding which are real and what to do.

#### 2.1 Prune false positives

Drop or downgrade what metrics cannot see through — and **record every dismissal with its reason**. A silently vanished finding is indistinguishable from a bug in the audit.

Cases that appear in nearly every real repo:
- **Generated, vendored, bundled** — a 12,000-line build artifact is not an oversized source file. Drop.
- **Barrel / re-export files** — high dependents by design. Drop the coupling finding; being imported everywhere is a barrel's job.
- **Framework convention files** — routes, migrations, DI-registered providers, plugin entry points. Drop "possibly dead"; static analysis cannot see the loader.
- **Type-only mutual references** — a two-file cycle existing so two types can reference each other is usually fine. Downgrade with a note.
- **Declaration and generated client files** — drop "untested".
- **Deliberately large data tables** — a keyword table is long, not complex. Drop "oversized".

Read the file (or the saved project understanding, which is cheaper) before dismissing. Do not dismiss on path alone.

#### 2.2 Merge and rank

Collapse candidates describing the same underlying problem into one finding. A file that is a hotspot, oversized, untested, *and* deeply nested is **one** finding — "this module is the project's centre of gravity and nothing protects it" — not four. Report the strongest severity and list all the evidence.

Rank by severity, then breadth of impact. **Cap the report at 15 findings.** A 200-item list is a backlog nobody reads; the rest goes into the counts table.

#### 2.3 Write each finding

- **What** — one line, in the project's vocabulary
- **Why it matters here** — the specific consequence for *this* codebase, citing the metric. "Changed 47 times by 9 authors with no test — every change is a guess" beats "low coverage is bad."
- **What to do** — a concrete first action: name the seam, the extraction, the test to write first. If the honest answer is "leave it alone", say that and why.

Never recommend a rewrite where a seam and a test would do.

## Output Structure

```markdown
# Code Health Audit — <project>

_<N> source files · <commit> · churn window: <window> · generated <date>_

## Verdict

**Health score: <0-100>/100**

<Two to four sentences, most important thing first. If the codebase is in good
shape, say so plainly rather than manufacturing concern.>

## Top risks

1. <One line each, three to five items — fewer if there genuinely are fewer.>

## Metrics

| Metric | Value |
|---|---|
| Source files | |
| Total LOC | |
| Health score | /100 |
| Files with tests | N (X%) |
| Import cycles | |
| Possibly dead files | |
| Findings | critical / high / medium / low |

## Findings

### 1. <Title> · `<severity>` · effort: <quick|moderate|large>

**Files:** `path/one.ts`
**Evidence:** commits 47 · LOC 1,240 · authors 9 · dependents 23 · no tests

<Why it matters in this codebase.>

**Do this:** <concrete first action>

## Dismissed

| Candidate | Files | Why dismissed |
|---|---|---|

## Method & limits

<Churn window; whether git history was available; that rename history is
truncated without --follow; that dead-code detection cannot see dynamic imports;
that test association is naming/import-based, not measured coverage. Readers
must be able to tell what this audit does not know.>
```

## Verification

1. **Every number came from the script.** Nothing estimated, nothing "roughly".
2. **Every file path exists.** Check before publishing.
3. **Findings count in Metrics reconciles** with the findings listed plus the Dismissed table. A gap means findings vanished unrecorded.
4. **No absolute paths** anywhere in the report.
5. **Method & limits is filled in**, not boilerplate.

## Rules

1. **Never invent a finding the script did not surface.** You may drop and downgrade; you may not add. This is what makes two runs on the same commit comparable.
2. **Cite metrics inline.** A finding without evidence is unfalsifiable and will be ignored.
3. **Say when the codebase is healthy.** An audit that manufactures fifteen problems in a clean repo trains people to ignore the tool. An empty Findings section with a clear Verdict is a valid, valuable result.
4. **Report degraded modes loudly** — no git, unresolvable imports, unparsed languages. State it in Method & limits rather than shipping a confident-looking partial report.
5. **Do not fix anything during the audit.** Measuring and changing at once means you can no longer trust the measurement. Hand findings to `code-simplification` or `incremental-implementation`.
6. **Keep the same churn window across runs** or the score moves for reasons that have nothing to do with the code.
