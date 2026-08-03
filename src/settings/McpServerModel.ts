import type { McpCustomServerConfig } from '../config/NexusConfig';
import { isHttpUrl } from '../mcp/McpCustomServers';

/**
 * Pure model behind the "Add MCP Server" form in the Settings panel.
 *
 * Zero `vscode` and zero DOM dependencies so it can be unit tested, and so the
 * validation rules can be pinned against `buildCustomPresets` — the runtime
 * authority that silently skips malformed servers.
 */

/** One key/value row in the headers or env editor. */
export interface McpKeyValueRow {
  key: string;
  value: string;
  /** True while the row still holds an unrevealed existing secret. */
  keep?: boolean;
}

export interface McpServerDraft {
  name: string;
  type: 'http' | 'stdio';
  url: string;
  headers: McpKeyValueRow[];
  command: string;
  args: string[];
  env: McpKeyValueRow[];
  enabled: boolean;
  risk: 'low' | 'medium' | 'high';
  defaultTool: string;
  bestFor: string[];
}

export type McpDraftField = 'name' | 'url' | 'command' | 'headers' | 'env';
export type McpDraftErrors = Partial<Record<McpDraftField, string>>;

/**
 * The name becomes the preset id `custom:<name>` and feeds keyword derivation,
 * so keep it to characters that survive both untouched.
 */
export const MCP_NAME_PATTERN = /^[A-Za-z0-9._-]+$/;

/**
 * Placeholder swapped in for secret values before the config is inlined into the
 * settings webview, and swapped back out in the extension host before the config
 * is written to disk. Long and unmistakable so a real value can never collide.
 */
export const SECRET_SENTINEL = '__NEXUS_KEEP_EXISTING_SECRET__';

// ---------------------------------------------------------------------------
// Validation — mirrors the silent-skip rules in McpCustomServers.buildCustomPresets
// ---------------------------------------------------------------------------

export function validateMcpServerDraft(
  draft: McpServerDraft,
  existingNames: string[],
  editingName?: string,
): McpDraftErrors {
  const errors: McpDraftErrors = {};
  const name = draft.name.trim();

  if (!name) {
    errors.name = 'Name is required.';
  } else if (!MCP_NAME_PATTERN.test(name)) {
    errors.name = 'Use only letters, numbers, dot, dash or underscore.';
  } else {
    // Case-insensitive: two rows differing only by case are indistinguishable
    // in the list even though JSON keys are case-sensitive.
    const editing = editingName?.trim().toLowerCase();
    const taken = existingNames.some(existing => {
      const other = existing.trim().toLowerCase();
      return other === name.toLowerCase() && other !== editing;
    });
    if (taken) {
      errors.name = `A server named "${name}" already exists.`;
    }
  }

  if (draft.type === 'http') {
    if (!isHttpUrl(draft.url.trim())) {
      errors.url = 'Enter a valid http:// or https:// URL.';
    }
    if (hasValueWithoutKey(draft.headers)) {
      errors.headers = 'Every header needs a name.';
    }
  } else {
    if (!draft.command.trim()) {
      errors.command = 'Command is required for stdio servers.';
    }
    if (hasValueWithoutKey(draft.env)) {
      errors.env = 'Every environment variable needs a name.';
    }
  }

  return errors;
}

function hasValueWithoutKey(rows: McpKeyValueRow[]): boolean {
  return rows.some(row => !row.key.trim() && (row.value.trim() !== '' || row.keep === true));
}

// ---------------------------------------------------------------------------
// Draft <-> config conversion
// ---------------------------------------------------------------------------

export function serverConfigToDraft(name: string, cfg: McpCustomServerConfig): McpServerDraft {
  return {
    name,
    type: cfg.type === 'stdio' ? 'stdio' : 'http',
    url: cfg.url ?? '',
    headers: recordToRows(cfg.headers),
    command: cfg.command ?? '',
    args: [...(cfg.args ?? [])],
    env: recordToRows(cfg.env),
    enabled: cfg.enabled !== false,
    risk: cfg.risk ?? 'high',
    defaultTool: cfg.defaultTool ?? '',
    bestFor: [...(cfg.bestFor ?? [])],
  };
}

/**
 * Builds the on-disk entry. Spreads `existing` first so fields the form does not
 * expose (and fields added by future versions) survive an edit round-trip.
 */
export function draftToServerConfig(
  draft: McpServerDraft,
  existing?: McpCustomServerConfig,
): McpCustomServerConfig {
  const next: Record<string, unknown> = { ...(existing ?? {}) };

  next['type'] = draft.type;
  next['enabled'] = draft.enabled;
  next['risk'] = draft.risk;

  if (draft.type === 'http') {
    next['url'] = draft.url.trim();
    setOrDelete(next, 'headers', rowsToRecord(draft.headers));
    delete next['command'];
    delete next['args'];
    delete next['env'];
  } else {
    next['command'] = draft.command.trim();
    setOrDelete(next, 'args', draft.args.map(arg => arg.trim()).filter(Boolean));
    setOrDelete(next, 'env', rowsToRecord(draft.env));
    delete next['url'];
    delete next['headers'];
  }

  // Presence matters: an empty defaultTool would pin an empty tool name, and
  // deleting bestFor restores the name-token derivation in buildCustomPresets.
  setOrDelete(next, 'defaultTool', draft.defaultTool.trim());
  setOrDelete(next, 'bestFor', draft.bestFor.map(kw => kw.trim()).filter(Boolean));

  return next as unknown as McpCustomServerConfig;
}

function setOrDelete(target: Record<string, unknown>, key: string, value: unknown): void {
  const empty =
    value === '' ||
    value === undefined ||
    (Array.isArray(value) && value.length === 0) ||
    (isPlainRecord(value) && Object.keys(value).length === 0);

  if (empty) {
    delete target[key];
  } else {
    target[key] = value;
  }
}

function recordToRows(record: Record<string, string> | undefined): McpKeyValueRow[] {
  if (!record) return [];
  return Object.entries(record).map(([key, value]) =>
    value === SECRET_SENTINEL
      ? { key, value: '', keep: true }
      : { key, value: String(value ?? '') },
  );
}

function rowsToRecord(rows: McpKeyValueRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key.trim();
    if (!key) continue;
    // An untouched masked row goes back as the sentinel so the extension host
    // can restore the real value from disk.
    out[key] = row.keep === true && row.value === '' ? SECRET_SENTINEL : row.value;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Row summary — never renders a secret value
// ---------------------------------------------------------------------------

export function summarizeServer(cfg: McpCustomServerConfig): { line: string; problem?: string } {
  const suffix = cfg.risk && cfg.risk !== 'high' ? [`risk: ${cfg.risk}`] : [];

  if (cfg.type === 'stdio') {
    const parts = ['stdio'];
    const command = [cfg.command ?? '', ...(cfg.args ?? [])].join(' ').trim();
    if (command) parts.push(command);
    const envCount = Object.keys(cfg.env ?? {}).length;
    if (envCount) parts.push(plural(envCount, 'env var'));
    return {
      line: [...parts, ...suffix].join(' · '),
      problem: cfg.command?.trim()
        ? undefined
        : 'Incomplete: a stdio server needs a command. This server is ignored until you fix it.',
    };
  }

  if (cfg.type === 'http') {
    const parts = ['HTTP'];
    if (cfg.url) parts.push(cfg.url);
    const headerCount = Object.keys(cfg.headers ?? {}).length;
    if (headerCount) parts.push(plural(headerCount, 'header'));
    return {
      line: [...parts, ...suffix].join(' · '),
      problem: isHttpUrl(cfg.url ?? '')
        ? undefined
        : 'Incomplete: an HTTP server needs a valid http:// or https:// URL. This server is ignored until you fix it.',
    };
  }

  return {
    line: `Unknown type "${String(cfg.type ?? '')}"`,
    problem: 'Unsupported type — use "http" or "stdio". This server is ignored until you fix it.',
  };
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// Secret redaction / rehydration
// ---------------------------------------------------------------------------

/**
 * Deep-clones the config with every secret value replaced by SECRET_SENTINEL, so
 * tokens are never inlined into the settings webview HTML. Masks exactly three
 * locations: customServers[*].headers[*], customServers[*].env[*], and
 * presets.context7.apiKey.
 */
export function redactConfigSecrets<T>(config: T): T {
  const clone = structuredClone(config);
  const mcp = asRecord(asRecord(clone)?.['mcp']);
  if (!mcp) return clone;

  const servers = asRecord(mcp['customServers']);
  if (servers) {
    for (const raw of Object.values(servers)) {
      const cfg = asRecord(raw);
      if (!cfg) continue;
      maskRecord(cfg['headers']);
      maskRecord(cfg['env']);
    }
  }

  const context7 = asRecord(asRecord(mcp['presets'])?.['context7']);
  if (context7 && typeof context7['apiKey'] === 'string' && context7['apiKey']) {
    context7['apiKey'] = SECRET_SENTINEL;
  }

  return clone;
}

function maskRecord(target: unknown): void {
  const record = asRecord(target);
  if (!record) return;
  for (const key of Object.keys(record)) {
    if (typeof record[key] === 'string' && record[key]) {
      record[key] = SECRET_SENTINEL;
    }
  }
}

/**
 * Mutates `payload` in place, replacing every SECRET_SENTINEL with the real
 * value from `onDisk`. `origins` maps a server's current name to the name it had
 * when the panel was opened, so renaming a server keeps its secrets.
 *
 * A sentinel that cannot be resolved is DELETED — writing the literal sentinel
 * to disk would send it as a real credential on the wire.
 */
export function rehydrateConfigSecrets(
  payload: unknown,
  onDisk: unknown,
  origins: Record<string, string> = {},
): void {
  const payloadMcp = asRecord(asRecord(payload)?.['mcp']);
  if (!payloadMcp) return;
  const diskMcp = asRecord(asRecord(onDisk)?.['mcp']);

  const payloadServers = asRecord(payloadMcp['customServers']);
  const diskServers = asRecord(diskMcp?.['customServers']);
  if (payloadServers) {
    for (const [name, raw] of Object.entries(payloadServers)) {
      const cfg = asRecord(raw);
      if (!cfg) continue;
      const source = asRecord(diskServers?.[origins[name] ?? name]);
      restoreRecord(cfg['headers'], source?.['headers']);
      restoreRecord(cfg['env'], source?.['env']);
    }
  }

  const payloadContext7 = asRecord(asRecord(payloadMcp['presets'])?.['context7']);
  if (payloadContext7 && payloadContext7['apiKey'] === SECRET_SENTINEL) {
    const previous = asRecord(asRecord(diskMcp?.['presets'])?.['context7'])?.['apiKey'];
    if (typeof previous === 'string' && previous !== SECRET_SENTINEL) {
      payloadContext7['apiKey'] = previous;
    } else {
      delete payloadContext7['apiKey'];
    }
  }
}

function restoreRecord(target: unknown, source: unknown): void {
  const record = asRecord(target);
  if (!record) return;
  const previous = asRecord(source);

  for (const key of Object.keys(record)) {
    if (record[key] !== SECRET_SENTINEL) continue;
    const value = previous?.[key];
    if (typeof value === 'string' && value !== SECRET_SENTINEL) {
      record[key] = value;
    } else {
      delete record[key];
    }
  }
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isPlainRecord(value) ? value : undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
