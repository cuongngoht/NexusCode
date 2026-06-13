# Step 2: Project Manifest

## Goal
Read project manifests to determine language, runtime, frameworks, and project type.

## Files to Read (read only those that exist)

| File | Language / Ecosystem |
|---|---|
| `package.json` | Node.js / JavaScript / TypeScript |
| `Cargo.toml` | Rust |
| `pyproject.toml`, `setup.py`, `setup.cfg` | Python |
| `go.mod` | Go |
| `pom.xml`, `build.gradle` | Java / Kotlin |
| `*.csproj`, `*.sln` | .NET / C# |
| `composer.json` | PHP |
| `Gemfile` | Ruby |
| `pubspec.yaml` | Dart / Flutter |
| `pnpm-workspace.yaml`, `turbo.json`, `nx.json` | Monorepo |

Also read the first 80 lines of `README.md` if it exists.

## Detection Rules

### Language
| Evidence | Language |
|---|---|
| `package.json` + `typescript` in devDeps | TypeScript |
| `package.json` only | JavaScript |
| `Cargo.toml` | Rust |
| `pyproject.toml` / `setup.py` | Python |
| `go.mod` | Go |
| `pom.xml` / `build.gradle` | Java |
| `*.csproj` | C# |

### Project Type (from `package.json`)
| Evidence | Type | Confidence |
|---|---|---|
| `vscode` in deps + `contributes` or `activationEvents` | `vscode-extension` | 0.95 |
| `electron` in deps | `electron-app` | 0.95 |
| `next` in deps or `next.config.*` | `nextjs-app` | 0.95 |
| `vite` + react/vue/svelte | `vite-app` | 0.90 |
| `express` / `fastify` / `koa` / `hapi` + no UI deps | `node-api` | 0.85 |
| `react-native` | `react-native-app` | 0.95 |
| `jest` or `vitest` only (no main/app) | `library` | 0.75 |

### Monorepo
| Evidence | Inference |
|---|---|
| `pnpm-workspace.yaml` | pnpm monorepo |
| `turbo.json` | Turborepo |
| `nx.json` | Nx monorepo |
| Multiple `package.json` in subdirs | generic monorepo |

### Frameworks
List all detected frameworks from dependencies: React, Vue, Angular, Svelte, SolidJS, Next.js, Nuxt,
Express, Fastify, NestJS, Django, FastAPI, Flask, Spring, ASP.NET, Rails, Gin, Actix, Tauri, Electron, etc.

## Writes

- `projectIdentity.name`
- `projectIdentity.type` + `confidence.projectType`
- `projectIdentity.language`
- `projectIdentity.runtime` (`node`, `browser`, `bun`, `deno`, `rust`, `python`, `go`, `jvm`, `dotnet`)
- `projectIdentity.isMonorepo`
- `projectIdentity.frameworks[]`
- `dependencies.production[]`
- `dependencies.development[]`
- Append manifest files found to `paths.configFiles[]`
