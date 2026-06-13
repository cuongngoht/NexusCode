# Step 8: Existing Feature Catalog

## Goal
Catalog already-implemented features so future specs can reuse them instead of re-implementing.

## Feature Categories

For each category, search for matching file names, folder names, class/function names, or package deps.
Record the **specific files found** — do not guess.

### Authentication / Authorization
Keywords: `auth`, `AuthService`, `jwt`, `session`, `oauth`, `passport`, `guard`, `middleware`

### Search
Keywords: `search`, `index`, `BM25`, `RAG`, `vector`, `embedding`, `semantic`, `fulltext`, `Algolia`, `elasticsearch`, `Typesense`

### Storage / Database
Keywords: `database`, `db`, `repository`, `prisma`, `typeorm`, `drizzle`, `sequelize`, `mongoose`, `knex`, `sqlite`, `redis`, `storage`

### Caching
Keywords: `cache`, `CacheService`, `Redis`, `lru-cache`, `in-memory`

### Logging / Observability
Keywords: `logger`, `log`, `telemetry`, `tracing`, `metrics`, `sentry`, `datadog`, `opentelemetry`

### Configuration / Settings
Keywords: `config`, `settings`, `ConfigService`, `env`, `dotenv`, `zod` (for config schemas)

### Notifications / Alerts
Keywords: `notification`, `alert`, `toast`, `email`, `webhook`, `push`

### File I/O / Assets
Keywords: `file`, `upload`, `download`, `storage`, `S3`, `blob`, `fs`, `stream`

### Testing Utilities
Keywords: `test`, `spec`, `mock`, `fixture`, `factory`, `faker`, `vitest`, `jest`, `pytest`, `testing`

### CLI / Commands
Keywords: `cli`, `command`, `commander`, `yargs`, `clap`, `cobra`, `argparse`

### AI / LLM Integration
Keywords: `llm`, `openai`, `anthropic`, `claude`, `gemini`, `langchain`, `agent`, `prompt`, `completion`

### Background Jobs / Queues
Keywords: `job`, `queue`, `worker`, `bull`, `agenda`, `cron`, `scheduler`

## Reuse Rule

If relevant existing code is found, explicitly note in `architectureNotes`:
> "Future `<feature>` implementation should reuse `<path>` instead of reimplementing."

## Writes

- `existingFeatures[]` — list of `{ category, files[] }` objects
- Append reuse recommendations to `architectureNotes`
