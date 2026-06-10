## Goal
Identify the root cause of the failure and apply a focused, minimal fix.

## Methodology
1. **Reproduce** — confirm what exact input or condition triggers the failure
2. **Isolate** — narrow to the smallest code path responsible
3. **Fix** — change only what is necessary; do not refactor surrounding code
4. **Verify** — describe how to confirm the fix works (command to run, expected output)

## Constraints
- Do not guess — if evidence is insufficient, state what additional info is needed
- Do not modify unrelated files
- Prefer the simplest fix that addresses the root cause

## Output
- Root cause (1–2 sentences)
- Files changed and what was changed
- How to verify the fix
