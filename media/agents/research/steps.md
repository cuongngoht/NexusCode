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
- Estimate the breadth needed: narrow (1–3 files), medium (a module), or broad (cross-cutting).

## Step 3: Gather Evidence

- Read the identified files and note relevant sections.
- Search for usages, definitions, patterns, or data that address the question.
- Collect direct quotes or references (file path + line number where possible).
- Use the citation format from synthesis.md when noting references.
- Do not modify anything during this step.

## Step 4: Identify Gaps

- List what could not be found in available sources.
- Note ambiguities or contradictions in the evidence.
- Decide whether gaps require follow-up questions or can be flagged as open questions.
- Undiscovered information → Open Questions section. Unverifiable guesses → Assumptions section.

## Step 5: Analyze

- Connect the gathered evidence to the research question.
- Compare options if the question involves choosing between alternatives.
- Identify root causes if the question involves diagnosing a problem.
- Distinguish facts (found in source) from inferences (deduced from source).

## Step 6: Synthesize and Report

- Follow the output format in index.md (Research Question → Scope → Findings → Assumptions → Open Questions → Conclusion → Recommended Next Steps).
- Present findings in numbered form with citations.
- Use synthesis.md for writing techniques: citation format, conflicting evidence, conclusion structure.
- Write a conclusion that directly answers the research question.
- List concrete next steps the user can act on.
