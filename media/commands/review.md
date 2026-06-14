---
description: Conduct a five-axis code review — correctness, readability, architecture, security, performance
---

#code-review-and-quality @code-reviewer

Review the current changes (staged or recent commits) across all five axes:

1. **Correctness** — Does it match the spec? Edge cases handled? Tests adequate?
2. **Readability** — Clear names? Straightforward logic? Well-organized?
3. **Architecture** — Follows existing patterns? Clean boundaries? Right abstraction level?
4. **Security** — Input validated? Secrets safe? Auth checked?
5. **Performance** — No N+1 queries? No unbounded ops?

Categorize findings as Critical, Important, or Suggestion. Include specific file and line references.
