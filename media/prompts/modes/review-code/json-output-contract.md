## Output Format — JSON Only

Output ONLY the structured JSON block below. Do NOT write a narrative (Part 1).
The JSON must be the entire response — no introductory text, no trailing text.

```json
{
  "summary": "2–4 sentence overall verdict",
  "verdict": "approve | approve-with-comments | request-changes",
  "architectureSummary": "2–3 sentence architecture-specific assessment",
  "architectureVerdict": "healthy | acceptable-with-debt | needs-refactor | architecture-blocker",
  "architectureScore": {
    "overall": 0,
    "coupling": 0,
    "cohesion": 0,
    "abstraction": 0,
    "testability": 0,
    "extensibility": 0,
    "readability": 0,
    "riskLevel": "low | medium | high"
  },
  "findings": [
    {
      "severity": "blocker | critical | major | minor | nit | info",
      "category": "bug | security | performance | test | maintainability | architecture | oop | ood | design-pattern | coupling | cohesion | dependency-direction | abstraction | complexity | technical-debt | style | docs | typing | dependency | config | ux",
      "title": "short title <=80 chars",
      "description": "1–3 sentences",
      "filePath": "relative/path/to/file.ts",
      "lineStart": 0,
      "evidence": "<=150 chars of relevant code",
      "recommendation": "1–2 sentences on how to fix",
      "confidence": 0.7,
      "blocking": false,
      "violatedPrinciple": "e.g. SRP (optional)",
      "whyItMatters": "1 sentence (required for architecture findings)"
    }
  ]
}
```

Rules:

- Output valid JSON only. No text before or after the ```json block.
- Every finding MUST have: severity, category, title, description, filePath, lineStart, evidence, recommendation, confidence, blocking.
- Aim for 5–15 findings when evidence supports them.
- architectureScore values: integers 0–100. confidence: number 0.0–1.0.
