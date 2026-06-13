# Step 1: File Tree

## Goal
Map the top-level layout and identify source roots, entry points, and folders to exclude.

## Actions

1. List all top-level folders (depth 1).
2. For each folder, record its apparent role: source, tests, docs, config, build output, assets, scripts, infrastructure, etc.
3. Detect source roots — check if these common names exist as folders:
   `src`, `app`, `lib`, `core`, `internal`, `pkg`, `cmd`, `api`, `server`, `client`,
   `frontend`, `backend`, `web`, `packages`, `apps`, `modules`, `services`
4. Detect entry points by looking for these files (language-specific):
   - `src/main.ts`, `src/index.ts`, `src/app.ts`, `main.ts`, `index.ts`
   - `main.go`, `cmd/*/main.go`
   - `src/main.rs`, `src/lib.rs`
   - `main.py`, `app.py`, `src/__main__.py`
   - `Program.cs`, `Startup.cs`, `src/main.java`
5. List all config files at the root level (do not read content yet):
   `tsconfig*.json`, `vite.config.*`, `webpack.config.*`, `rollup.config.*`, `esbuild.*`,
   `jest.config.*`, `vitest.config.*`, `.eslintrc*`, `.prettierrc*`, `babel.config.*`,
   `Makefile`, `Dockerfile`, `docker-compose.*`, `.env.example`, `nx.json`, `turbo.json`

## Exclusions

Record any of these that **exist** as folders to exclude from indexing:
`node_modules`, `.git`, `dist`, `out`, `build`, `target`, `coverage`,
`__pycache__`, `.venv`, `venv`, `vendor`, `.next`, `.nuxt`, `.turbo`, `.cache`, `bin`, `obj`

## Writes

- `paths.sourceRoots[]`
- `paths.entrypoints[]`
- `paths.configFiles[]`
- `excludeFromIndex[]`
- Append notes about unusual structures to `architectureNotes`
