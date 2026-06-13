# Step 3: Build Scripts & Toolchain

## Goal
Detect the package manager (or build tool) and map all scripts to canonical categories.

## Package Manager Detection

Check for lockfiles in priority order:

| Lockfile | Package Manager | Confidence |
|---|---|---|
| `pnpm-lock.yaml` | pnpm | 0.95 |
| `yarn.lock` | yarn | 0.95 |
| `bun.lockb` | bun | 0.95 |
| `package-lock.json` | npm | 0.95 |
| `package.json` only (no lockfile) | npm | 0.50 |

**For non-Node projects:**
- `Cargo.toml` present → toolchain: `cargo`
- `go.mod` present → toolchain: `go`
- `pyproject.toml` → toolchain: `poetry` or `pip` (check for `poetry.lock`)
- `Makefile` present → note `make` as available

**Risk:** If multiple lockfiles exist, add: "Multiple lockfiles detected — package manager is ambiguous."

## Script Mapping

Read `package.json` scripts (if present). Map to canonical categories:

| Canonical | Common script names to match |
|---|---|
| `typecheck` | `typecheck`, `type-check`, `tsc`, `check` |
| `build` | `build`, `bundle`, `pack` |
| `compile` | `compile`, `compile:*` |
| `test` | `test`, `test:*`, `spec`, `vitest`, `jest` |
| `lint` | `lint`, `eslint`, `check:lint` |
| `format` | `format`, `prettier`, `fmt` |
| `dev` | `dev`, `start`, `serve`, `watch` |

If no generic `test` script exists but `test:unit`, `test:webview`, or similar exists, use the best available and note it.

Scripts not matching any canonical name go into `custom`.

## Command Format

All recommended commands must use the detected package manager prefix:
- npm: `npm run <script>`
- pnpm: `pnpm run <script>` or `pnpm <script>`
- yarn: `yarn <script>`
- bun: `bun run <script>`
- cargo: `cargo build`, `cargo test`, `cargo clippy`
- go: `go build ./...`, `go test ./...`, `go vet ./...`

## Writes

- `projectIdentity.packageManager` + `confidence.packageManager`
- `scripts.typecheck`, `scripts.build`, `scripts.test`, `scripts.lint`, `scripts.format`, `scripts.dev`
- `scripts.custom{}` for unmapped scripts
- Write `.nexus/discovery/scripts.md` with: detected toolchain, all commands, recommended validation sequence
