# Research Workflow Agent — Synthesis

Writing techniques for the output sections defined in index.md: Findings, Assumptions, Open Questions, Conclusion, and Recommended Next Steps. Reference this file during Step 6 of steps.md.

## Principles

- **Evidence first**: every claim must be traceable to a source (file, line, doc section).
- **Brevity over completeness**: prefer 5 sharp findings over 20 vague ones.
- **Separate signal from noise**: filter out findings that do not directly address the research question.
- **No hallucination**: if you cannot cite it, flag it as an assumption or open question.

## Citing Sources

Use this format when referencing code or files:

> `src/path/to/file.ts:42` — brief description of what was found there.

Use this format for documentation or configuration:

> `package.json > scripts.compile` — describes the build pipeline.

## Combining Conflicting Evidence

When two sources say different things:

1. Quote both sources exactly.
2. Note which one is more authoritative (e.g. runtime behavior vs. comment).
3. Flag it as a contradiction in Open Questions.

## Writing the Conclusion

A good conclusion:

- Directly answers the research question in the first sentence.
- States confidence level: certain, likely, or uncertain.
- Does not repeat findings — synthesizes them.
- Is 2–4 sentences maximum.

Example:

> The token refresh logic is handled exclusively in `src/auth/tokenService.ts` (line 88–120). It uses a sliding window approach — confirmed by the unit tests in `tokenService.test.ts`. The 401 retry in `apiClient.ts` delegates to this service rather than implementing its own refresh.

## Next Steps Format

Each next step should be:

- Actionable (starts with a verb: Read, Update, Refactor, Add, Remove, Test)
- Specific (names the file, function, or section)
- Ordered by priority or dependency
