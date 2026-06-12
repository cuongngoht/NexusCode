# Research Workflow Agent — Steps

Step-by-step methodology for conducting structured research.

## Step 1: Clarify the Research Question

- Restate the user's question in your own words.
- Identify what a satisfactory answer looks like.
- Note what information is already available vs. what needs to be found.
- If the question has multiple interpretations, state which one you are investigating.

## Step 2: Map the Scope

- Identify which files, modules, folders, or documentation sections are relevant.
- List entry points (e.g. main component, API surface, config file).
- Estimate breadth using this decision tree:

  **Single component** ("How does the auth module work?")
  → Narrow: 1–3 files (module + its tests + docs)

  **Cross-component interaction** ("How does auth integrate with the API client?")
  → Medium: the module plus its direct dependencies

  **Cross-cutting concern** ("Where is rate limiting applied?")
  → Broad: search the codebase by keyword or folder (max 10–15 files); use grep for patterns

## Step 3: Gather Evidence

- Read the identified files and note relevant sections.
- Search for usages, definitions, patterns, or data that address the question.
- Collect evidence in this priority order:
  1. Line-level code evidence (file path + exact line number) — highest authority
  2. Documentation sections (file path + section heading)
  3. Test cases (file path + test name or line number)
  4. Comments or commit messages — only when they clarify code intent
- Use the citation format from synthesis.md when noting references.
- Do not cite assumptions, inferences, or unevaluated claims.
- Do not modify anything during this step.

## Step 3b: Determine Sufficiency

- Stop gathering evidence when you have at least 3–5 findings that directly address the research question.
- Exclude findings that are tangential or answer a peripheral question.
- If after searching your full scope you have fewer than 3 findings: identify which sources were incomplete, then re-search one additional category (tests, examples, config, adjacent modules).
- Flag as Open Questions anything important that cannot be found after a reasonable second search.

## Step 4: Identify Gaps

- List what could not be found in available sources.
- Note ambiguities or contradictions in the evidence.
- Undiscovered information → Open Questions section.
- Unverifiable guesses → Assumptions section.
- When sources contradict each other:
  - Quote both sources exactly.
  - Note which is more authoritative (runtime code > comments; tests > documentation).
  - Present both versions in your findings.
  - If you cannot determine which is correct, flag it in Open Questions with both options stated.
  - Do not silently pick one source over the other.

## Step 5: Analyze

Tailor your analysis to the type of research question:

### "Does X exist?" or "What is X?"

- Cite the definition, location, or explicit evidence.
- State whether it exists in the codebase and whether it is well-documented.

### "Why does Y happen?" or "What is the cause of Z?"

- Trace the execution path or data flow to identify the root cause.
- Distinguish correlation from causation.
- List alternative causes if evidence is ambiguous.

### "Compare option A vs. option B"

- Present each option's pros and cons, grounded in actual code.
- Note which option is currently used vs. which is recommended in docs.
- Identify tradeoffs.

### "What does the documentation say about W?"

- Quote the relevant section directly.
- Note whether the documentation matches the actual code implementation.
- Flag any contradictions between docs and code.

### For all question types

- Distinguish facts (found directly in source) from inferences (deduced from source).
- If data is missing, state "no evidence found" rather than guessing.

## Step 5b: Quality Check

Before writing the report, verify:

- Do you have at least 3 findings that directly answer the research question?
- Did you search all sources listed in Scope?
- Are there obvious files you skipped (tests, examples, config, adjacent modules)?

If the answer is "no" to any question:
- Return to Step 2 and expand scope, or
- Return to Step 3 and search the identified scope more thoroughly.

Do not skip this check — thin findings produce weak conclusions.

## Step 6: Synthesize and Report

- Follow the output format in index.md (Research Question → Scope → Findings → Assumptions → Open Questions → Conclusion → Recommended Next Steps).
- Present findings in numbered form with citations.
- Use synthesis.md for writing techniques: citation format, conflicting evidence, confidence levels, conclusion structure, and next steps format.
- Write a conclusion that directly answers the research question.
- List concrete next steps the user can act on.
