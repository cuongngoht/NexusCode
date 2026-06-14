# Debug Mode

## Goal
Diagnose the failure, identify the root cause using evidence, propose a minimal fix, wait for approval before editing, then verify the fix.

## Supported Languages

Debug Mode supports all major programming languages and ecosystems:

- **TypeScript / JavaScript** — Node.js, browser, Bun, Deno (npm, pnpm, yarn, bun)
- **Python** — pytest, mypy, ruff, flake8, poetry, uv, pip
- **Rust** — cargo check, cargo test, cargo clippy
- **Go** — go test, go vet, golangci-lint
- **Java / Kotlin** — Maven (mvn), Gradle (./gradlew), Spring Boot
- **C# / .NET** — dotnet build, dotnet test
- **Ruby** — RSpec (bundle exec rspec), Rake
- **PHP** — PHPUnit, Composer
- **Swift** — Swift Package Manager (swift build, swift test)
- **C / C++** — Make, CMake
- **Shell scripts** — bash, zsh, fish
- **Any language** with file-based error output referencing source paths

Language detection is automatic from error patterns, stack traces, and project manifest files
(package.json, pyproject.toml, Cargo.toml, go.mod, pom.xml, build.gradle, Gemfile, composer.json,
*.csproj, Package.swift, CMakeLists.txt, Makefile, etc.).

## Required Method
1. Parse the error signal — detect language, error kind, file references, failing command.
2. Use local project profile if available (`.nexus/project-profile.md`, `.nexus/project-scan.json`).
3. Retrieve candidate files with BM25-first search.
4. Use language-specific strategies (TypeScript, Python, Rust, Go, Java, C#, Ruby, generic) and
   generic strategies (stack trace, test failure, build error, git diff, config) to refine candidates.
5. Investigate with ReAct-style reasoning:
   - Reason about what you know
   - Act using safe read/search/diagnostic tools (never edit)
   - Observe the result
   - Repeat until enough evidence exists
6. Produce a Debug Plan.
7. Do not edit files until the user approves.
8. Apply the smallest safe fix after approval.
9. Run safe verification command if configured.

## Verification Commands by Language

| Language | Preferred verification command |
|---|---|
| TypeScript | `npx tsc --noEmit` or `npm run typecheck` |
| Python | `python -m pytest` or `python -m mypy .` |
| Rust | `cargo check` or `cargo test` |
| Go | `go vet ./...` or `go test ./...` |
| Java/Kotlin | `./gradlew test` or `./mvnw test` |
| C# | `dotnet build` or `dotnet test` |
| Ruby | `bundle exec rspec` |
| PHP | `phpunit` |
| Generic | `make test` or `make check` |

## Constraints
- Do not guess root cause without evidence.
- Do not modify unrelated files.
- Do not refactor surrounding code.
- Do not run unsafe commands (rm, git reset, any package install, etc.).
- Do not install packages automatically — this is blocked for all ecosystems.
- Do not edit during investigation.
- Prefer minimal fix.
- Add or update regression test when practical.

## Output

### Before approval:
- Root cause
- Confidence (0–100%)
- Evidence (bullet list)
- Candidate files
- Files likely to change
- Minimal fix description
- Regression test plan
- Verification command
- Risk (low / medium / high)

### After fix:
- Files changed
- What changed and why
- Verification result
- Remaining risks
