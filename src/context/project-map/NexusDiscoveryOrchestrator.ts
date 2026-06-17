/**
 * NexusDiscoveryOrchestrator
 *
 * Deterministic implementation of the 10 discovery steps defined in
 * media/discovery/steps/01-*.md … 10-*.md.  No LLM required.
 *
 * Activity sequence visible in the UI:
 *   1. Scanning file tree          (step 01)
 *   2. Reading project manifests   (step 02)
 *   3. Analyzing build scripts     (step 03)
 *   4. Detecting architecture      (step 04)
 *   5. Event & messaging system    (step 05)
 *   6. Communication protocols     (step 06)
 *   7. Module & plugin system      (step 07)
 *   8. Existing feature catalog    (step 08)
 *   9. Coding conventions          (step 09)
 *  10. Risks & unknowns            (step 10)
 *  11. Writing discovery artifacts (final write)
 */

import * as fs from 'fs';
import * as path from 'path';
import type { BuildProjectMapUseCase, BuildProjectMapOutput } from '../../application/usecases/BuildProjectMapUseCase';
import { ensureNexusInGitignore } from './NexusGitignoreManager';

// ─────────────────────────────────────────────────────────────────────────────
// Public types
// ─────────────────────────────────────────────────────────────────────────────

export interface DiscoveryOptions {
  maxDepth?: number;
  maxFiles?: number;
  addToGitignore?: boolean;
}

/** Lightweight activity notifier — avoids requiring AgentTask in the event shape. */
export type DiscoveryActivityEmitter = (
  phase: 'started' | 'done',
  activityKind: 'read' | 'search' | 'write',
  label: string,
) => void;

export interface DiscoveryResult {
  mapOutput: BuildProjectMapOutput;
  filesWritten: string[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal data shapes
// ─────────────────────────────────────────────────────────────────────────────

interface ManifestInfo {
  projectName: string;
  projectType: string;
  language: string;
  runtime: string;
  packageManager: string;
  isMonorepo: boolean;
  frameworks: string[];
  productionDeps: string[];
  devDeps: string[];
  scripts: Record<string, string>;
  configFiles: string[];
  readmeSummary: string;
}

interface ArchInfo {
  style: string;
  layers: string[];
  orchestrators: string[];
  handlers: string[];
  controllers: string[];
  useCases: string[];
  repositories: string[];
  services: string[];
  adapters: string[];
  stores: string[];
  routers: string[];
  sourceRoots: string[];
  entryPoints: string[];
}

interface EventSystemInfo {
  eventBusFile: string | null;
  eventTypes: string[];
  externalMessaging: string[];
  reactiveLibs: string[];
}

interface CommInfo {
  protocol: string | null;
  messageContractFile: string | null;
  uiRoots: string[];
  apiFiles: string[];
  protoFiles: string[];
}

interface ModuleSystemInfo {
  registries: string[];
  providers: string[];
  compositionRoot: string | null;
  baseInterfaces: string[];
  diLibs: string[];
}

interface FeatureCatalog {
  category: string;
  files: string[];
}

interface ConventionInfo {
  fileNaming: string;
  folderNaming: string;
  testPattern: string;
  interfacePrefix: string;
  abstractClassPrefix: string;
  barrelFiles: boolean;
  i18nFiles: string[];
  errorHandling: string;
}

interface RiskEntry {
  severity: 'high' | 'medium' | 'low';
  message: string;
  evidence: string;
  mitigation: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 01 helpers — file tree is handled by BuildProjectMapUseCase
// ─────────────────────────────────────────────────────────────────────────────

const ENTRY_POINTS = [
  'src/main.ts', 'src/index.ts', 'src/app.ts', 'src/extension.ts',
  'main.ts', 'index.ts', 'app.ts',
  'main.go', 'main.py', 'app.py', 'main.rs',
  'Program.cs', 'Startup.cs',
];

const EXCLUDE_DIRS = [
  'node_modules', '.git', 'dist', 'out', 'build', 'target', 'coverage',
  '__pycache__', '.venv', 'venv', 'vendor', '.next', '.nuxt', '.turbo',
  '.cache', 'bin', 'obj',
];

// ─────────────────────────────────────────────────────────────────────────────
// Step 02 — Manifest reading
// ─────────────────────────────────────────────────────────────────────────────

const FRAMEWORK_DEPS: Array<[string, string]> = [
  ['react', 'react'], ['vue', 'vue'], ['@angular/core', 'angular'],
  ['svelte', 'svelte'], ['next', 'next.js'], ['nuxt', 'nuxt'],
  ['express', 'express'], ['fastify', 'fastify'], ['@nestjs/core', 'nestjs'],
  ['electron', 'electron'], ['vite', 'vite'],
  ['@fluentui/react-components', 'fluent-ui'], ['tailwindcss', 'tailwind'],
  ['@tauri-apps/api', 'tauri'], ['react-native', 'react-native'],
];

const CONFIG_FILES_TO_CHECK = [
  'tsconfig.json', 'vite.config.ts', 'vite.config.js',
  'webpack.config.js', 'rollup.config.js', 'esbuild.js',
  'jest.config.ts', 'jest.config.js', 'vitest.config.ts', 'vitest.config.js',
  '.eslintrc.json', '.eslintrc.js', '.eslintrc.cjs', '.prettierrc',
  'babel.config.js', 'Makefile', 'Dockerfile',
  'docker-compose.yml', 'docker-compose.yaml',
  '.env.example', 'nx.json', 'turbo.json',
];

function readManifest(workspaceRoot: string): ManifestInfo {
  const info: ManifestInfo = {
    projectName: path.basename(workspaceRoot),
    projectType: 'unknown',
    language: 'unknown',
    runtime: 'unknown',
    packageManager: 'unknown',
    isMonorepo: false,
    frameworks: [],
    productionDeps: [],
    devDeps: [],
    scripts: {},
    configFiles: [],
    readmeSummary: '',
  };

  // Package manager from lockfiles
  if (fs.existsSync(path.join(workspaceRoot, 'pnpm-lock.yaml')))        info.packageManager = 'pnpm';
  else if (fs.existsSync(path.join(workspaceRoot, 'yarn.lock')))         info.packageManager = 'yarn';
  else if (fs.existsSync(path.join(workspaceRoot, 'bun.lockb')))         info.packageManager = 'bun';
  else if (fs.existsSync(path.join(workspaceRoot, 'package-lock.json'))) info.packageManager = 'npm';

  // Monorepo markers
  info.isMonorepo = (
    fs.existsSync(path.join(workspaceRoot, 'pnpm-workspace.yaml')) ||
    fs.existsSync(path.join(workspaceRoot, 'turbo.json')) ||
    fs.existsSync(path.join(workspaceRoot, 'nx.json'))
  );

  // Non-Node ecosystems
  if (fs.existsSync(path.join(workspaceRoot, 'Cargo.toml'))) {
    info.language = 'Rust'; info.runtime = 'rust'; info.packageManager = 'cargo';
  } else if (fs.existsSync(path.join(workspaceRoot, 'go.mod'))) {
    info.language = 'Go'; info.runtime = 'go'; info.packageManager = 'go';
  } else if (
    fs.existsSync(path.join(workspaceRoot, 'pyproject.toml')) ||
    fs.existsSync(path.join(workspaceRoot, 'setup.py'))
  ) {
    info.language = 'Python'; info.runtime = 'python';
    info.packageManager = fs.existsSync(path.join(workspaceRoot, 'poetry.lock')) ? 'poetry' : 'pip';
  }

  // Config files present at root
  for (const f of CONFIG_FILES_TO_CHECK) {
    if (fs.existsSync(path.join(workspaceRoot, f))) info.configFiles.push(f);
  }

  // package.json
  const pkgPath = path.join(workspaceRoot, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as Record<string, unknown>;
      if (typeof pkg['name'] === 'string') info.projectName = pkg['name'];

      const deps = (pkg['dependencies'] as Record<string, string>) ?? {};
      const devDeps = (pkg['devDependencies'] as Record<string, string>) ?? {};
      info.productionDeps = Object.keys(deps);
      info.devDeps = Object.keys(devDeps);
      const allDeps = { ...deps, ...devDeps };

      // Language
      if (allDeps['typescript'] !== undefined || devDeps['typescript'] !== undefined) {
        info.language = 'TypeScript';
      } else if (info.language === 'unknown') {
        info.language = 'JavaScript';
      }
      if (info.runtime === 'unknown') info.runtime = 'node';

      // Project type
      if (allDeps['vscode'] !== undefined || pkg['contributes'] || pkg['activationEvents']) {
        info.projectType = 'vscode-extension';
      } else if (allDeps['electron'] !== undefined) {
        info.projectType = 'electron-app';
      } else if (allDeps['next'] !== undefined) {
        info.projectType = 'nextjs-app';
      } else if (allDeps['vite'] !== undefined && (allDeps['react'] !== undefined || allDeps['vue'] !== undefined || allDeps['svelte'] !== undefined)) {
        info.projectType = 'vite-app';
      } else if (allDeps['express'] !== undefined || allDeps['fastify'] !== undefined || allDeps['koa'] !== undefined) {
        info.projectType = 'node-api';
      } else if (allDeps['react-native'] !== undefined) {
        info.projectType = 'react-native-app';
      }

      // Frameworks
      for (const [dep, label] of FRAMEWORK_DEPS) {
        if (allDeps[dep] !== undefined) info.frameworks.push(label);
      }

      if (info.packageManager === 'unknown') info.packageManager = 'npm';

      if (pkg['scripts'] && typeof pkg['scripts'] === 'object') {
        info.scripts = pkg['scripts'] as Record<string, string>;
      }
    } catch { /* ignore */ }
  }

  // README first 80 lines
  const readmePath = path.join(workspaceRoot, 'README.md');
  if (fs.existsSync(readmePath)) {
    try {
      const lines = fs.readFileSync(readmePath, 'utf8').split('\n').slice(0, 80);
      info.readmeSummary = lines.join('\n').trim();
    } catch { /* ignore */ }
  }

  return info;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 04 — Architecture detection
// ─────────────────────────────────────────────────────────────────────────────

const ARCH_FILE_PATTERNS: Array<{ key: keyof ArchInfo; re: RegExp }> = [
  { key: 'orchestrators', re: /Orchestrator\.[^/\\]+$/ },
  { key: 'handlers',      re: /Handler\.[^/\\]+$/ },
  { key: 'controllers',   re: /Controller\.[^/\\]+$/ },
  { key: 'useCases',      re: /UseCase\.[^/\\]+$|use[_-]?case\.[^/\\]+$/i },
  { key: 'repositories',  re: /Repository\.[^/\\]+$|Repo\.[^/\\]+$/ },
  { key: 'services',      re: /Service\.[^/\\]+$/ },
  { key: 'adapters',      re: /Adapter\.[^/\\]+$/ },
  { key: 'stores',        re: /Store\.[^/\\]+$/ },
  { key: 'routers',       re: /Router\.[^/\\]+$|Routing\.[^/\\]+$/ },
];

const ARCH_STYLE_RULES: Array<{ style: string; folders: string[] }> = [
  { style: 'Clean Architecture / Hexagonal', folders: ['core', 'domain', 'application', 'infrastructure', 'interface'] },
  { style: 'Feature-sliced design',          folders: ['features', 'pages', 'entities', 'shared'] },
  { style: 'MVC',                            folders: ['models', 'views', 'controllers'] },
  { style: 'CQRS',                           folders: ['commands', 'queries', 'handlers'] },
  { style: 'Microservices',                  folders: ['services', 'gateway', 'api-gateway'] },
];

const SOURCE_ROOTS = ['src', 'app', 'lib', 'core', 'internal', 'pkg', 'cmd', 'api',
  'server', 'client', 'frontend', 'backend', 'web', 'packages', 'apps', 'modules', 'services'];

function detectArchitecture(files: string[], folders: string[], workspaceRoot: string): ArchInfo {
  const arch: ArchInfo = {
    style: 'unknown',
    layers: [],
    orchestrators: [], handlers: [], controllers: [], useCases: [],
    repositories: [], services: [], adapters: [], stores: [], routers: [],
    sourceRoots: [],
    entryPoints: [],
  };

  // Top-level folder set
  const topFolders = new Set(
    folders.map(f => f.split(path.sep)[0]).filter(Boolean),
  );

  // Architecture style
  for (const { style, folders: required } of ARCH_STYLE_RULES) {
    const matches = required.filter(f => topFolders.has(f)).length;
    if (matches >= 2) {
      arch.style = style;
      arch.layers = required.filter(f => topFolders.has(f));
      break;
    }
  }

  // src-level architecture (e.g. src/core, src/application)
  if (arch.style === 'unknown') {
    const srcSubdirs = new Set(
      folders
        .filter(f => f.startsWith('src' + path.sep))
        .map(f => f.split(path.sep)[1])
        .filter(Boolean),
    );
    for (const { style, folders: required } of ARCH_STYLE_RULES) {
      const matches = required.filter(f => srcSubdirs.has(f)).length;
      if (matches >= 2) {
        arch.style = style;
        arch.layers = required.filter(f => srcSubdirs.has(f));
        break;
      }
    }
    if (arch.layers.length === 0 && srcSubdirs.size > 0) {
      arch.layers = [...srcSubdirs].slice(0, 10);
    }
  }

  // Source roots
  arch.sourceRoots = SOURCE_ROOTS.filter(r => topFolders.has(r));

  // Entry points
  arch.entryPoints = ENTRY_POINTS.filter(ep =>
    files.includes(ep) || fs.existsSync(path.join(workspaceRoot, ep)),
  );

  // Architectural file patterns
  const sourceExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.cs', '.java']);
  const sourceFiles = files.filter(f => sourceExts.has(path.extname(f)));

  for (const { key, re } of ARCH_FILE_PATTERNS) {
    const matches = sourceFiles.filter(f => re.test(f)).slice(0, 20);
    (arch[key] as string[]).push(...matches);
  }

  return arch;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 05 — Event & messaging system
// ─────────────────────────────────────────────────────────────────────────────

const EVENT_BUS_FILE_RE = /(?:EventBus|MessageBus|IEventBus|eventBus|events)\.[^/\\]+$/i;
const EVENT_TYPE_FILE_RE = /(?:events?|messages?)\.[^/\\]+$|DomainEvent|AppEvent/i;
const EXTERNAL_MSG_DEPS = ['amqplib', 'kafkajs', 'nats', 'redis', 'bull', 'bullmq', 'mqtt'];
const REACTIVE_DEPS = ['rxjs', 'most', 'xstream', 'baconjs'];

function detectEventSystem(files: string[], allDeps: string[]): EventSystemInfo {
  const eventBusFile = files.find(f => EVENT_BUS_FILE_RE.test(f)) ?? null;
  const eventTypes = files.filter(f => EVENT_TYPE_FILE_RE.test(f)).slice(0, 10);
  const externalMessaging = EXTERNAL_MSG_DEPS.filter(d => allDeps.includes(d));
  const reactiveLibs = REACTIVE_DEPS.filter(d => allDeps.includes(d));
  return { eventBusFile, eventTypes, externalMessaging, reactiveLibs };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 06 — Communication & IPC
// ─────────────────────────────────────────────────────────────────────────────

const IPC_FILE_RE = /(?:messages?|protocol|ipc|bridge|webviewProtocol)\.[^/\\]+$/i;
const PROTO_FILE_RE = /\.proto$/;
const GRAPHQL_FILE_RE = /\.graphql$|schema\.graphql$/;
const SWAGGER_FILE_RE = /swagger\.ya?ml$|openapi\.ya?ml$|openapi\.json$/;
const WEBSOCKET_DEPS = ['socket.io', 'ws', 'uwebsockets.js'];
const GRPC_DEPS = ['@grpc/grpc-js', 'grpc', 'connectrpc'];

function detectCommunication(files: string[], folders: string[], allDeps: string[]): CommInfo {
  const messageContractFile = files.find(f => IPC_FILE_RE.test(f)) ?? null;
  const protoFiles = files.filter(f => PROTO_FILE_RE.test(f));
  const graphqlFiles = files.filter(f => GRAPHQL_FILE_RE.test(f));
  const swaggerFiles = files.filter(f => SWAGGER_FILE_RE.test(f));

  const topFolders = new Set(folders.map(f => f.split(path.sep)[0]).filter(Boolean));
  const uiRoots = ['src/webview-ui', 'src/renderer', 'src/ui', 'client', 'frontend', 'web']
    .filter(r => folders.some(f => f.startsWith(r)) || topFolders.has(r));

  const hasWebSocket = WEBSOCKET_DEPS.some(d => allDeps.includes(d));
  const hasGrpc = GRPC_DEPS.some(d => allDeps.includes(d));
  const apiFiles = files.filter(f => /(?:routes?|api|controller)\.[^/\\]+$/i.test(f)).slice(0, 10);

  let protocol: string | null = null;
  if (messageContractFile?.includes('webview') || messageContractFile?.includes('ipc')) {
    protocol = 'VS Code Webview postMessage';
  } else if (allDeps.includes('electron')) {
    protocol = 'Electron IPC (ipcMain/ipcRenderer)';
  } else if (protoFiles.length > 0) {
    protocol = 'gRPC (protobuf)';
  } else if (graphqlFiles.length > 0) {
    protocol = 'GraphQL';
  } else if (swaggerFiles.length > 0) {
    protocol = 'OpenAPI/Swagger';
  } else if (hasWebSocket) {
    protocol = 'WebSocket';
  } else if (apiFiles.length > 0) {
    protocol = 'REST HTTP API';
  } else if (hasGrpc) {
    protocol = 'gRPC';
  }

  return { protocol, messageContractFile, uiRoots, apiFiles, protoFiles };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 07 — Module & plugin system
// ─────────────────────────────────────────────────────────────────────────────

const REGISTRY_FILE_RE = /(?:Registry|Container|Injector|AgentRegistry|ProviderRegistry)\.[^/\\]+$/;
const PROVIDER_FILE_RE = /(?:BaseProvider|IProvider|BasePlugin|IPlugin|BaseAgent|IAgent)\.[^/\\]+$/;
const DI_DEPS = ['inversify', 'tsyringe', 'typedi', 'awilix'];

function detectModuleSystem(files: string[], allDeps: string[], workspaceRoot: string): ModuleSystemInfo {
  const registries = files.filter(f => REGISTRY_FILE_RE.test(f)).slice(0, 10);
  const providers = files.filter(f => PROVIDER_FILE_RE.test(f)).slice(0, 10);
  const diLibs = DI_DEPS.filter(d => allDeps.includes(d));

  const compositionRootCandidates = [
    'src/extension.ts', 'extension.ts',
    'src/main.ts', 'main.ts',
    'src/index.ts', 'index.ts',
    'src/app.ts', 'app.ts',
  ];
  const compositionRoot = compositionRootCandidates.find(
    f => files.includes(f) || fs.existsSync(path.join(workspaceRoot, f)),
  ) ?? null;

  const baseInterfaces = files.filter(f =>
    /(?:IAgent|IProvider|IPlugin|BaseAgent|BaseProvider|Base[A-Z])\.[^/\\]+$/.test(f),
  ).slice(0, 10);

  return { registries, providers, compositionRoot, baseInterfaces, diLibs };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 08 — Existing feature catalog
// ─────────────────────────────────────────────────────────────────────────────

const FEATURE_CATEGORIES: Array<{ category: string; fileRe: RegExp; depKeywords: string[] }> = [
  {
    category: 'Authentication / Authorization',
    fileRe: /auth|AuthService|jwt|session|oauth|passport|guard|middleware/i,
    depKeywords: ['passport', 'jsonwebtoken', 'bcrypt', 'jose', '@auth0', 'next-auth'],
  },
  {
    category: 'Search (BM25 / RAG / Vector)',
    fileRe: /search|BM25|RAG|vector|embedding|semantic|fulltext/i,
    depKeywords: ['algoliasearch', 'elasticsearch', 'typesense', 'qdrant', 'weaviate', 'pinecone'],
  },
  {
    category: 'Storage / Database',
    fileRe: /database|repository|Repository|prisma|typeorm|drizzle|sqlite|storage/i,
    depKeywords: ['prisma', 'typeorm', 'drizzle-orm', 'sequelize', 'mongoose', 'knex', 'sqlite3', 'pg', 'mysql2'],
  },
  {
    category: 'Caching',
    fileRe: /cache|CacheService|lru/i,
    depKeywords: ['redis', 'lru-cache', 'node-cache', 'cache-manager'],
  },
  {
    category: 'Logging / Observability',
    fileRe: /logger|log|telemetry|tracing|metrics/i,
    depKeywords: ['winston', 'pino', 'bunyan', '@opentelemetry', 'sentry', 'datadog-metrics'],
  },
  {
    category: 'Configuration / Settings',
    fileRe: /config|settings|ConfigService|NexusConfig/i,
    depKeywords: ['dotenv', 'zod', 'joi', 'convict', 'config'],
  },
  {
    category: 'Notifications / Alerts',
    fileRe: /notification|alert|toast|email|webhook/i,
    depKeywords: ['nodemailer', 'sendgrid', 'twilio', 'web-push'],
  },
  {
    category: 'File I/O / Assets',
    fileRe: /upload|download|blob|stream/i,
    depKeywords: ['multer', 'formidable', 'aws-sdk', '@aws-sdk', 'sharp'],
  },
  {
    category: 'Testing Utilities',
    fileRe: /\.test\.|\.spec\.|mock|fixture|factory|faker/i,
    depKeywords: ['vitest', 'jest', 'mocha', '@testing-library', 'sinon', '@faker-js'],
  },
  {
    category: 'AI / LLM Integration',
    fileRe: /llm|openai|anthropic|claude|gemini|langchain|agent|prompt/i,
    depKeywords: ['openai', '@anthropic-ai', 'langchain', '@google-cloud/aiplatform', 'ollama'],
  },
  {
    category: 'Background Jobs / Queues',
    fileRe: /job|queue|worker|scheduler|cron/i,
    depKeywords: ['bull', 'bullmq', 'agenda', 'node-cron', 'croner'],
  },
  {
    category: 'CLI / Commands',
    fileRe: /cli|command|cmd/i,
    depKeywords: ['commander', 'yargs', 'meow', 'oclif'],
  },
];

function catalogFeatures(files: string[], allDeps: string[]): FeatureCatalog[] {
  const catalog: FeatureCatalog[] = [];
  const sourceExts = new Set(['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.cs', '.java']);
  const sourceFiles = files.filter(f => sourceExts.has(path.extname(f)));

  for (const { category, fileRe, depKeywords } of FEATURE_CATEGORIES) {
    const matchingFiles = sourceFiles.filter(f => fileRe.test(path.basename(f))).slice(0, 8);
    const depHits = depKeywords.filter(d => allDeps.includes(d));
    if (matchingFiles.length > 0 || depHits.length > 0) {
      catalog.push({ category, files: [...matchingFiles, ...depHits] });
    }
  }
  return catalog;
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 09 — Coding conventions
// ─────────────────────────────────────────────────────────────────────────────

function detectConventions(files: string[]): ConventionInfo {
  const tsFiles = files.filter(f => f.endsWith('.ts') || f.endsWith('.tsx'));
  const basenames = tsFiles.map(f => path.basename(f, path.extname(f)));

  // File naming convention
  const pascalCount  = basenames.filter(b => /^[A-Z][a-zA-Z0-9]*$/.test(b) && !b.includes('-') && !b.includes('_')).length;
  const kebabCount   = basenames.filter(b => /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(b)).length;
  const camelCount   = basenames.filter(b => /^[a-z][a-zA-Z0-9]*$/.test(b) && !b.includes('-')).length;
  const total = tsFiles.length || 1;
  let fileNaming = 'mixed';
  if (pascalCount / total > 0.5)    fileNaming = 'PascalCase';
  else if (kebabCount / total > 0.4) fileNaming = 'kebab-case';
  else if (camelCount / total > 0.4) fileNaming = 'camelCase';

  // Folder naming
  const allFolderParts = files
    .flatMap(f => f.split(path.sep).slice(0, -1))
    .filter(Boolean);
  const folderKebab  = allFolderParts.filter(p => /^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(p)).length;
  const folderCamel  = allFolderParts.filter(p => /^[a-z][a-zA-Z0-9]+$/.test(p)).length;
  const folderPascal = allFolderParts.filter(p => /^[A-Z][a-zA-Z0-9]+$/.test(p)).length;
  const totalFolders = allFolderParts.length || 1;
  let folderNaming = 'mixed';
  if (folderKebab / totalFolders > 0.4)   folderNaming = 'kebab-case';
  else if (folderCamel / totalFolders > 0.4)  folderNaming = 'camelCase';
  else if (folderPascal / totalFolders > 0.4) folderNaming = 'PascalCase';

  // Test pattern
  const testSpec = files.filter(f => /\.spec\.[^/\\]+$/.test(f)).length;
  const testTest = files.filter(f => /\.test\.[^/\\]+$/.test(f)).length;
  let testPattern = 'unknown';
  if (testSpec > 0 && testTest === 0)      testPattern = '*.spec.ts';
  else if (testTest > 0 && testSpec === 0) testPattern = '*.test.ts';
  else if (testTest > 0 || testSpec > 0)   testPattern = '*.test.ts / *.spec.ts';

  // Interface prefix
  const interfacePrefix = basenames.some(b => /^I[A-Z]/.test(b)) ? 'I-prefix (e.g. IFoo)' : 'no prefix';

  // Abstract class prefix
  const abstractClassPrefix = basenames.some(b => /^Base[A-Z]/.test(b)) ? 'Base-prefix (e.g. BaseFoo)' :
    basenames.some(b => /^Abstract[A-Z]/.test(b)) ? 'Abstract-prefix' : 'unknown';

  // Barrel files
  const barrelFiles = files.filter(f => path.basename(f) === 'index.ts').length > 3;

  // i18n files
  const i18nFiles = files.filter(f => /\/i18n\/|\/locales?\/|\/translations?\//i.test(f) || /\b(en|vi|fr|de|ja)\.json$/.test(f)).slice(0, 5);

  // Error handling
  const resultPattern = files.some(f => /Result\.[^/\\]+$|Either\.[^/\\]+$/.test(f)) ? 'Result/Either type' : 'exception-based';

  return { fileNaming, folderNaming, testPattern, interfacePrefix, abstractClassPrefix, barrelFiles, i18nFiles, errorHandling: resultPattern };
}

// ─────────────────────────────────────────────────────────────────────────────
// Step 10 — Risks & unknowns
// ─────────────────────────────────────────────────────────────────────────────

function detectRisks(
  manifest: ManifestInfo,
  arch: ArchInfo,
  events: EventSystemInfo,
  comm: CommInfo,
  modules: ModuleSystemInfo,
  files: string[],
): { risks: RiskEntry[]; unknowns: string[] } {
  const risks: RiskEntry[] = [];
  const unknowns: string[] = [];

  // Multiple lockfiles
  const lockfileCount = ['pnpm-lock.yaml', 'yarn.lock', 'bun.lockb', 'package-lock.json']
    .filter(lf => manifest.configFiles.includes(lf) || files.some(f => path.basename(f) === lf)).length;
  if (lockfileCount > 1) {
    risks.push({ severity: 'medium', message: 'Multiple lockfiles detected — package manager is ambiguous', evidence: `Found ${lockfileCount} lockfiles`, mitigation: 'Remove unused lockfiles; commit only one.' });
  }

  // No typecheck script
  const hasTypecheck = Object.keys(manifest.scripts).some(s => ['typecheck', 'type-check', 'tsc', 'check'].includes(s));
  if (!hasTypecheck && manifest.language === 'TypeScript') {
    risks.push({ severity: 'medium', message: 'No type-checking command found — type safety unverified', evidence: 'No typecheck/type-check/tsc script in package.json', mitigation: 'Add "typecheck": "tsc --noEmit" to scripts.' });
  }

  // No test script
  const hasTest = Object.keys(manifest.scripts).some(s => s === 'test' || s.startsWith('test:'));
  if (!hasTest) {
    risks.push({ severity: 'medium', message: 'No test command found — automated coverage unclear', evidence: 'No test script in package.json', mitigation: 'Add a test script with vitest, jest, or equivalent.' });
  }

  // No build/compile
  const hasBuild = Object.keys(manifest.scripts).some(s => ['build', 'compile', 'bundle'].includes(s) || s.startsWith('build:'));
  if (!hasBuild && manifest.projectType !== 'unknown') {
    risks.push({ severity: 'low', message: 'Build process unclear — no build/compile script found', evidence: 'No build/compile script in package.json', mitigation: 'Add a build script appropriate for the project type.' });
  }

  // No event bus
  if (!events.eventBusFile) {
    risks.push({ severity: 'low', message: 'No event bus detected — async communication pattern unknown', evidence: 'No EventBus/MessageBus file found', mitigation: 'If async decoupling is needed, add an event bus interface.' });
  }

  // No communication protocol
  if (!comm.protocol) {
    risks.push({ severity: 'low', message: 'Communication protocol unclear — IPC / API layer not identified', evidence: 'No message contract or REST route files found', mitigation: 'Document the communication protocol in README.' });
  }

  // No module system
  if (modules.registries.length === 0 && modules.providers.length === 0) {
    risks.push({ severity: 'low', message: 'No module/plugin system detected — extension pattern unknown', evidence: 'No Registry/Provider/Container files found', mitigation: 'Consider adding a registry pattern for extensibility.' });
  }

  // No entry points
  if (arch.entryPoints.length === 0) {
    risks.push({ severity: 'medium', message: 'Entry point not identified — bootstrap sequence unknown', evidence: 'None of the common entry point files found', mitigation: 'Ensure main.ts/index.ts/extension.ts exists at expected path.' });
    unknowns.push('Entry point file');
  }

  // Large source tree
  if (files.length > 500) {
    risks.push({ severity: 'low', message: 'Large source tree — indexing/search may be slow', evidence: `${files.length} files scanned`, mitigation: 'Review .nexusignore / .gitignore to exclude generated files.' });
  }

  // Unknown architecture style
  if (arch.style === 'unknown') unknowns.push('Architecture style');
  if (manifest.packageManager === 'unknown') unknowns.push('Package manager');
  if (manifest.language === 'unknown') unknowns.push('Primary language');

  return { risks, unknowns };
}

// ─────────────────────────────────────────────────────────────────────────────
// Artifact builders
// ─────────────────────────────────────────────────────────────────────────────

function buildScriptsMarkdown(manifest: ManifestInfo): string {
  const pm = manifest.packageManager;
  const prefix = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : pm === 'bun' ? 'bun run' : 'npm run';

  const CANONICAL_MAP: Record<string, string[]> = {
    typecheck:  ['typecheck', 'type-check', 'tsc', 'check'],
    build:      ['build', 'bundle', 'pack', 'compile'],
    test:       ['test', 'spec', 'vitest', 'jest'],
    lint:       ['lint', 'eslint', 'check:lint'],
    format:     ['format', 'prettier', 'fmt'],
    dev:        ['dev', 'start', 'serve', 'watch'],
  };

  const canonical: Record<string, string> = {};
  const custom: Record<string, string> = {};

  for (const [script] of Object.entries(manifest.scripts)) {
    let matched = false;
    for (const [cat, names] of Object.entries(CANONICAL_MAP)) {
      if (names.some(n => script === n || script.startsWith(n + ':'))) {
        if (!canonical[cat]) canonical[cat] = `${prefix} ${script}`;
        matched = true; break;
      }
    }
    if (!matched) custom[script] = `${prefix} ${script}`;
  }

  const lines = [
    '# Project Scripts & Toolchain', '',
    `**Package Manager:** ${pm}`, '',
    '## Canonical Commands', '',
  ];
  for (const [cat, cmd] of Object.entries(canonical)) lines.push(`- **${cat}**: \`${cmd}\``);
  if (Object.keys(canonical).length === 0) lines.push('_None detected._');

  if (Object.keys(custom).length > 0) {
    lines.push('', '## Custom Scripts', '');
    for (const [name, cmd] of Object.entries(custom)) lines.push(`- \`${cmd}\` (${name})`);
  }

  lines.push('', '## Recommended Validation Sequence', '');
  const seq = (['typecheck', 'lint', 'build', 'test'] as const)
    .filter(s => canonical[s])
    .map(s => `1. \`${canonical[s]}\``);
  lines.push(...(seq.length > 0 ? seq : ['_No validation sequence detected._']));

  return lines.join('\n');
}

function buildArchitectureMarkdown(arch: ArchInfo, manifest: ManifestInfo): string {
  const lines = [
    '# Architecture Map', '',
    `**Style:** ${arch.style}`,
    `**Project Type:** ${manifest.projectType}`,
    `**Language:** ${manifest.language}`, '',
  ];

  if (arch.layers.length > 0) {
    lines.push('## Layers', '');
    for (const l of arch.layers) lines.push(`- \`${l}\``);
    lines.push('');
  }

  const sections: Array<[string, string[]]> = [
    ['Orchestrators', arch.orchestrators],
    ['Handlers', arch.handlers],
    ['Controllers', arch.controllers],
    ['Use Cases', arch.useCases],
    ['Services', arch.services],
    ['Repositories', arch.repositories],
    ['Adapters', arch.adapters],
    ['Stores', arch.stores],
    ['Routers', arch.routers],
  ];
  for (const [title, items] of sections) {
    if (items.length === 0) continue;
    lines.push(`## ${title}`, '');
    for (const item of items.slice(0, 15)) lines.push(`- ${item}`);
    if (items.length > 15) lines.push(`- … and ${items.length - 15} more`);
    lines.push('');
  }

  if (arch.entryPoints.length > 0) {
    lines.push('## Entry Points', '');
    for (const ep of arch.entryPoints) lines.push(`- ${ep}`);
    lines.push('');
  }

  if (manifest.frameworks.length > 0) {
    lines.push('## Detected Frameworks', '');
    for (const f of manifest.frameworks) lines.push(`- ${f}`);
    lines.push('');
  }

  return lines.join('\n');
}

function buildIntegrationPointsMarkdown(
  events: EventSystemInfo,
  comm: CommInfo,
  modules: ModuleSystemInfo,
): string {
  const lines = ['# Integration Points', ''];

  // Event system
  lines.push('## Event & Messaging', '');
  if (events.eventBusFile) {
    lines.push(`- **Event bus definition:** \`${events.eventBusFile}\``);
    lines.push('- To add a new event type: extend the union type in that file.');
  } else {
    lines.push('- No event bus detected. Add one if async decoupling is needed.');
  }
  if (events.eventTypes.length > 0) {
    lines.push('- **Event/message type files:**');
    for (const f of events.eventTypes) lines.push(`  - \`${f}\``);
  }
  if (events.externalMessaging.length > 0) {
    lines.push(`- **External messaging:** ${events.externalMessaging.join(', ')}`);
  }
  if (events.reactiveLibs.length > 0) {
    lines.push(`- **Reactive libraries:** ${events.reactiveLibs.join(', ')}`);
  }
  lines.push('');

  // Communication
  lines.push('## Communication Protocol', '');
  if (comm.protocol) {
    lines.push(`- **Primary protocol:** ${comm.protocol}`);
  }
  if (comm.messageContractFile) {
    lines.push(`- **Message contract:** \`${comm.messageContractFile}\``);
    lines.push('- To extend: add new message types to that file and handle them in the receiver.');
  }
  if (comm.uiRoots.length > 0) {
    lines.push(`- **UI source roots:** ${comm.uiRoots.join(', ')}`);
  }
  if (comm.protoFiles.length > 0) {
    lines.push('- **Proto files:**');
    for (const f of comm.protoFiles) lines.push(`  - \`${f}\``);
  }
  lines.push('');

  // Module system
  lines.push('## Module / Plugin System', '');
  if (modules.compositionRoot) {
    lines.push(`- **Composition root:** \`${modules.compositionRoot}\`. Register new modules here.`);
  }
  if (modules.registries.length > 0) {
    lines.push('- **Registries:**');
    for (const r of modules.registries) lines.push(`  - \`${r}\``);
  }
  if (modules.baseInterfaces.length > 0) {
    lines.push('- **Base interfaces / abstract classes:**');
    for (const i of modules.baseInterfaces) lines.push(`  - \`${i}\``);
  }
  if (modules.diLibs.length > 0) {
    lines.push(`- **DI libraries:** ${modules.diLibs.join(', ')}`);
  }
  if (modules.registries.length === 0 && !modules.compositionRoot) {
    lines.push('- No module registration system detected.');
  }

  return lines.join('\n');
}

function buildConventionsMarkdown(conv: ConventionInfo): string {
  return [
    '# Coding Conventions', '',
    '## File & Folder Naming', '',
    `- **File naming:** ${conv.fileNaming} — Fact`,
    `- **Folder naming:** ${conv.folderNaming} — Fact`,
    `- **Test files:** ${conv.testPattern} — Fact`,
    '',
    '## Class & Interface Naming', '',
    `- **Interface prefix:** ${conv.interfacePrefix} — Inference`,
    `- **Abstract class prefix:** ${conv.abstractClassPrefix} — Inference`,
    '',
    '## Module Structure', '',
    `- **Barrel files (index.ts):** ${conv.barrelFiles ? 'Yes — used widely' : 'Minimal or absent'} — Fact`,
    '',
    '## i18n / Localization', '',
    conv.i18nFiles.length > 0
      ? `- Translation files found: ${conv.i18nFiles.map(f => `\`${f}\``).join(', ')} — Fact`
      : '- No translation files detected — Fact',
    '',
    '## Error Handling', '',
    `- ${conv.errorHandling} — Inference`,
    '',
    '## Recommendations', '',
    '- New files should match the detected naming convention.',
    '- New interfaces should follow the detected prefix pattern.',
    conv.barrelFiles ? '- Export new modules via the nearest `index.ts` barrel.' : '',
  ].filter(l => l !== undefined).join('\n');
}

function buildRisksMarkdown(risks: RiskEntry[], unknowns: string[]): string {
  const lines = ['# Risks & Unknowns', ''];

  if (risks.length > 0) {
    lines.push('## Detected Risks', '');
    for (const r of risks) {
      lines.push(`### [${r.severity.toUpperCase()}] ${r.message}`, '');
      lines.push(`- **Evidence:** ${r.evidence}`);
      lines.push(`- **Mitigation:** ${r.mitigation}`);
      lines.push('');
    }
  } else {
    lines.push('## Detected Risks', '', '_No significant risks detected._', '');
  }

  if (unknowns.length > 0) {
    lines.push('## Unknowns', '');
    for (const u of unknowns) lines.push(`- ${u} could not be determined`);
  }

  return lines.join('\n');
}

function buildProjectProfileMarkdown(
  manifest: ManifestInfo, arch: ArchInfo,
  fileCount: number, folderCount: number,
  features: FeatureCatalog[], risks: RiskEntry[],
): string {
  const lines = [
    `# Project Profile: ${manifest.projectName}`, '',
    '## Identity', '',
    `- **Name:** ${manifest.projectName}`,
    `- **Type:** ${manifest.projectType}`,
    `- **Language:** ${manifest.language}`,
    `- **Runtime:** ${manifest.runtime}`,
    `- **Package Manager:** ${manifest.packageManager}`,
    `- **Monorepo:** ${manifest.isMonorepo ? 'Yes' : 'No'}`,
    '',
    '## Workspace', '',
    `- **Files:** ${fileCount}`,
    `- **Folders:** ${folderCount}`,
    `- **Architecture:** ${arch.style}`,
    '',
  ];

  if (manifest.frameworks.length > 0) {
    lines.push('## Frameworks', '');
    for (const f of manifest.frameworks) lines.push(`- ${f}`);
    lines.push('');
  }

  if (features.length > 0) {
    lines.push('## Existing Features', '');
    for (const { category } of features) lines.push(`- ${category}`);
    lines.push('');
  }

  if (risks.length > 0) {
    lines.push('## Risk Summary', '');
    for (const r of risks) lines.push(`- [${r.severity}] ${r.message}`);
    lines.push('');
  }

  if (manifest.readmeSummary) {
    lines.push('## README (excerpt)', '', '```', manifest.readmeSummary.slice(0, 500), '```', '');
  }

  return lines.join('\n');
}

function buildProjectScanJson(
  manifest: ManifestInfo,
  arch: ArchInfo,
  events: EventSystemInfo,
  comm: CommInfo,
  modules: ModuleSystemInfo,
  features: FeatureCatalog[],
  risks: RiskEntry[],
  unknowns: string[],
): Record<string, unknown> {
  const CANONICAL_SCRIPTS: Record<string, string[]> = {
    typecheck: ['typecheck', 'type-check', 'tsc', 'check'],
    build:     ['build', 'bundle', 'pack', 'compile'],
    test:      ['test', 'spec', 'vitest', 'jest'],
    lint:      ['lint', 'eslint', 'check:lint'],
    format:    ['format', 'prettier', 'fmt'],
    dev:       ['dev', 'start', 'serve', 'watch'],
  };
  const pm = manifest.packageManager;
  const prefix = pm === 'pnpm' ? 'pnpm' : pm === 'yarn' ? 'yarn' : pm === 'bun' ? 'bun run' : 'npm run';

  const scripts: Record<string, string | null> = { typecheck: null, build: null, test: null, lint: null, format: null, dev: null };
  const custom: Record<string, string> = {};
  for (const [script] of Object.entries(manifest.scripts)) {
    let matched = false;
    for (const [cat, names] of Object.entries(CANONICAL_SCRIPTS)) {
      if (names.some(n => script === n || script.startsWith(n + ':'))) {
        if (!scripts[cat]) scripts[cat] = `${prefix} ${script}`;
        matched = true; break;
      }
    }
    if (!matched) custom[script] = `${prefix} ${script}`;
  }

  return {
    projectIdentity: {
      name: manifest.projectName, type: manifest.projectType,
      language: manifest.language, runtime: manifest.runtime,
      packageManager: manifest.packageManager, isMonorepo: manifest.isMonorepo,
      frameworks: manifest.frameworks,
    },
    paths: {
      entrypoints: arch.entryPoints,
      sourceRoots: arch.sourceRoots,
      testRoots: [],
      uiRoots: comm.uiRoots,
      configFiles: manifest.configFiles,
      rulesFiles: [],
    },
    architecture: {
      style: arch.style, layers: arch.layers,
      orchestrators: arch.orchestrators.slice(0, 10),
      handlers: arch.handlers.slice(0, 10),
      controllers: arch.controllers.slice(0, 10),
      routers: arch.routers.slice(0, 10),
      services: arch.services.slice(0, 10),
      repositories: arch.repositories.slice(0, 10),
      eventBus: events.eventBusFile,
      communicationProtocol: comm.protocol,
      moduleSystem: modules.registries.slice(0, 5),
    },
    existingFeatures: features.map(f => ({ category: f.category, files: f.files })),
    scripts: { ...scripts, custom },
    dependencies: {
      production: manifest.productionDeps.slice(0, 50),
      development: manifest.devDeps.slice(0, 50),
    },
    excludeFromIndex: EXCLUDE_DIRS,
    confidence: {
      projectType: manifest.projectType !== 'unknown' ? 0.95 : 0.25,
      packageManager: manifest.packageManager !== 'unknown' ? 0.95 : 0.50,
      architectureStyle: arch.style !== 'unknown' ? 0.75 : 0.25,
      eventBus: events.eventBusFile ? 0.95 : 0.25,
      communicationProtocol: comm.protocol ? 0.75 : 0.25,
    },
    risks: risks.map(r => ({ severity: r.severity, message: r.message })),
    unknowns,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main orchestrator
// ─────────────────────────────────────────────────────────────────────────────

export class NexusDiscoveryOrchestrator {
  constructor(private readonly buildProjectMap: BuildProjectMapUseCase) {}

  async run(
    workspaceRoot: string,
    emit: DiscoveryActivityEmitter,
    options: DiscoveryOptions = {},
  ): Promise<DiscoveryResult> {
    const nexusDir = path.join(workspaceRoot, '.nexus');
    const discoveryDir = path.join(nexusDir, 'discovery');
    fs.mkdirSync(discoveryDir, { recursive: true });

    const filesWritten: string[] = [];
    const writeNexus = (filename: string, content: string): void => {
      const fullPath = path.join(nexusDir, filename);
      fs.mkdirSync(path.dirname(fullPath), { recursive: true });
      fs.writeFileSync(fullPath, content, 'utf8');
      filesWritten.push(path.join('.nexus', filename));
    };

    // ── Step 01: Scan file tree ──────────────────────────────────────────
    emit('started', 'read', 'Scanning file tree');
    const mapOutput = await this.buildProjectMap.execute({
      workspaceRoot,
      maxDepth: options.maxDepth ?? 6,
      maxFiles: options.maxFiles ?? 2000,
    });
    filesWritten.push(...mapOutput.filesWritten);
    emit('done', 'read', 'Scanning file tree');

    const { files, folders } = mapOutput.tree;

    // ── Step 02: Read project manifests ─────────────────────────────────
    emit('started', 'read', 'Reading project manifests');
    const manifest = readManifest(workspaceRoot);
    emit('done', 'read', 'Reading project manifests');

    // ── Step 03: Analyze build scripts ──────────────────────────────────
    emit('started', 'read', 'Analyzing build scripts');
    const scriptsMarkdown = buildScriptsMarkdown(manifest);
    emit('done', 'read', 'Analyzing build scripts');

    // ── Step 04: Detect architecture patterns ───────────────────────────
    emit('started', 'search', 'Detecting architecture patterns');
    const arch = detectArchitecture(files, folders, workspaceRoot);
    emit('done', 'search', 'Detecting architecture patterns');

    // ── Step 05: Event & messaging system ───────────────────────────────
    emit('started', 'search', 'Analyzing event & messaging system');
    const allDeps = [...manifest.productionDeps, ...manifest.devDeps];
    const events = detectEventSystem(files, allDeps);
    emit('done', 'search', 'Analyzing event & messaging system');

    // ── Step 06: Communication protocols ────────────────────────────────
    emit('started', 'search', 'Analyzing communication protocols');
    const comm = detectCommunication(files, folders, allDeps);
    emit('done', 'search', 'Analyzing communication protocols');

    // ── Step 07: Module & plugin system ─────────────────────────────────
    emit('started', 'search', 'Detecting module & plugin system');
    const modules = detectModuleSystem(files, allDeps, workspaceRoot);
    emit('done', 'search', 'Detecting module & plugin system');

    // ── Step 08: Existing feature catalog ───────────────────────────────
    emit('started', 'search', 'Cataloging existing features');
    const features = catalogFeatures(files, allDeps);
    emit('done', 'search', 'Cataloging existing features');

    // ── Step 09: Coding conventions ─────────────────────────────────────
    emit('started', 'search', 'Inferring coding conventions');
    const conventions = detectConventions(files);
    emit('done', 'search', 'Inferring coding conventions');

    // ── Step 10: Risks & unknowns ────────────────────────────────────────
    emit('started', 'search', 'Identifying risks & unknowns');
    const { risks, unknowns } = detectRisks(manifest, arch, events, comm, modules, files);
    emit('done', 'search', 'Identifying risks & unknowns');

    // ── Final: Write all discovery artifacts ────────────────────────────
    emit('started', 'write', 'Writing discovery artifacts');

    writeNexus('project-scan.json',
      JSON.stringify(buildProjectScanJson(manifest, arch, events, comm, modules, features, risks, unknowns), null, 2));

    writeNexus('project-profile.md',
      buildProjectProfileMarkdown(manifest, arch, files.length, folders.length, features, risks));

    writeNexus('discovery/scripts.md', scriptsMarkdown);

    writeNexus('discovery/architecture-map.md',
      buildArchitectureMarkdown(arch, manifest));

    writeNexus('discovery/integration-points.md',
      buildIntegrationPointsMarkdown(events, comm, modules));

    writeNexus('discovery/conventions.md',
      buildConventionsMarkdown(conventions));

    writeNexus('discovery/risks.md',
      buildRisksMarkdown(risks, unknowns));

    if (options.addToGitignore) {
      const modified = ensureNexusInGitignore(workspaceRoot);
      if (modified) filesWritten.push('.gitignore');
    }

    emit('done', 'write', 'Writing discovery artifacts');

    return { mapOutput, filesWritten };
  }
}
