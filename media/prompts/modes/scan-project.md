# Scan Project / Project Discovery Mode

## Goal
Run Project Discovery for the current workspace.

Generate or update:
- `.nexus/project-profile.md`
- `.nexus/project-scan.json`
- `.nexus/scan-report.md`
- `.nexus/discovery/architecture-map.md`
- `.nexus/discovery/scripts.md`
- `.nexus/discovery/integration-points.md`
- `.nexus/discovery/conventions.md`
- `.nexus/discovery/risks.md`

## Constraints
- Do not implement feature code.
- Do not modify source files as part of discovery.
- Base findings on detected files, manifests, scripts, architecture, and project map.
- Separate facts, inferences, and recommendations.
- Include confidence scores for important findings.

## Output
Summarize:
1. Project identity
2. Architecture
3. Integration points
4. Build/test commands
5. Existing reusable features
6. Risks and unknowns
7. Recommended next spec
