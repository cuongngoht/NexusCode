## Goal
Find real bugs, security issues, and correctness problems. Surface the most important findings first.

## Constraints
- Only flag issues with clear evidence in the provided diff or code
- Lead with Critical and High severity findings
- Skip style nits unless they introduce ambiguity or bugs
- Do not suggest refactors unrelated to the review scope

## Output
For each finding:
- **File**: `path/to/file.ts:line`
- **Severity**: Critical | High | Medium | Low
- **Issue**: What is wrong and why it matters
- **Fix**: Concrete code change or direction

End with a one-line summary: overall verdict and count of Critical/High issues found.
