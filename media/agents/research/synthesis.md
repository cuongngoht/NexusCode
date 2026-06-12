# Research Workflow Agent — Synthesis

Writing techniques for the output sections defined in index.md: Findings, Assumptions, Open Questions, Conclusion, and Recommended Next Steps. Reference this file during Step 6 of steps.md.

## Principles

- **Evidence first**: every claim must be traceable to a source (file, line, doc section).
- **Brevity over completeness**: prefer 5 sharp findings over 20 vague ones.
- **Separate signal from noise**: filter out findings that do not directly address the research question.
- **No hallucination**: if you cannot cite it, flag it as an assumption or open question.

## Assumptions vs. Open Questions

**Assumption**: something you inferred or reasoned about because the source did not explicitly state it, but you can justify it from available evidence.

Format: `(Inferred from [source] because [reason])`

Example:
> The token refresh must delegate to `tokenService.ts` — inferred from the fact that all HTTP 401 responses are caught in `apiClient.ts:200` and re-routed to `tokenService.refresh()`.

**Open Question**: something you could not find or verify in available sources after reasonable search.

Example:
> The documentation does not specify the exact timeout duration for token refresh.

**Rule**: never convert an Open Question into an Assumption without finding justifying evidence. Label accurately — it affects how the reader acts on the output.

## Citing Sources

Use this format when referencing code or files:

> `src/path/to/file.ts:42` — brief description of what was found there.

Use this format for documentation or configuration:

> `package.json > scripts.compile` — describes the build pipeline.

Use this format for test cases:

> `src/auth/tokenService.test.ts:88` — test "should refresh token on 401" verifies sliding window behavior.

## Combining Conflicting Evidence

When two sources say different things:

1. Quote both sources exactly.
2. Note which one is more authoritative (runtime code > comments; tests > documentation).
3. Present both versions in the Findings section.
4. Flag it as a contradiction in Open Questions if you cannot determine which is correct.

## Confidence Levels

Use these definitions when writing the Conclusion section:

**Certain**: the finding is explicit in source code, documentation, or tests with no ambiguity.
> Example: "The API uses Basic Authentication, confirmed by line 42 of `auth.ts` and 8 unit tests in `auth.test.ts`."

**Likely**: the finding is clearly intended by the source, supported by multiple corroborating signals, but not stated in a single authoritative location.
> Example: "The codebase uses a sliding window refresh because the token service (line 88) calls `Math.floor(now / window)` and three usage examples all follow the same pattern."

**Uncertain**: the finding is inferred from limited or contradictory evidence, or required assumptions to reach.
> Example: "Token refresh may use exponential backoff, suggested by the `retryCount` variable at line 100, but no documentation confirms this."

Always state the confidence level in the Conclusion's first or second sentence.

## Writing the Conclusion

A good conclusion:

- Directly answers the research question in the first sentence.
- States confidence level (certain / likely / uncertain) in the first or second sentence.
- Does not repeat findings — synthesizes them.
- Is 2–4 sentences maximum.

Example:

> The token refresh logic is handled exclusively in `src/auth/tokenService.ts` (lines 88–120) — certain, confirmed by 12 unit tests. It uses a sliding window approach. The 401 retry in `apiClient.ts` delegates to this service rather than implementing its own refresh, ensuring consistent behavior across the application.

### Weak → Strong Findings

**Weak** (before synthesis):
- JWT is used
- There are tests
- The code has comments

**Strong** (after Step 5 analysis):
1. JWT tokens are refreshed using a sliding window algorithm (`src/auth/tokenService.ts:88–120`), confirmed by 12 unit tests in `tokenService.test.ts:45–120`.
2. The 401 retry logic in `src/api/apiClient.ts:200–210` delegates to `tokenService.refresh()` rather than implementing a custom refresh, ensuring consistency across the application.
3. Token expiry is hardcoded to 1 hour (`src/auth/constants.ts:5`) with no configuration option to customize it.

## Next Steps Format

Each next step must:

- **Start with a strong verb**: Read, Update, Refactor, Add, Remove, Test, Verify, Document, Investigate
- **Name the specific file or function** — not "the codebase"
- **State the rationale** in one sentence (why this follows from the findings)
- **Be ordered by dependency** (if step 2 depends on step 1, place step 1 first)

**Weak**: "Improve the authentication flow."

**Strong**: "Investigate `src/auth/tokenService.ts:100` to verify whether the `retryCount` variable implements exponential backoff (Finding #3 was uncertain about this)."
