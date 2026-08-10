import type { McpCustomServerConfig } from '../config/NexusConfig';
import type {
  McpPreset,
  McpPresetId,
  McpToolDescriptor,
  McpToolIntent,
} from './McpTypes';

export const CUSTOM_PRESET_PREFIX = 'custom:';

/** Custom presets sit just below the built-in ones (Microsoft Learn 90, Context7 85). */
const CUSTOM_PRESET_PRIORITY = 80;

export function isCustomPresetId(id: string): id is `custom:${string}` {
  return id.startsWith(CUSTOM_PRESET_PREFIX);
}

export function customPresetId(name: string): McpPresetId {
  return `${CUSTOM_PRESET_PREFIX}${name}`;
}

export interface CustomPresetEntry {
  preset: McpPreset;
  enabled: boolean;
}

/**
 * Converts `.nexus/config.json` → `mcp.customServers` entries into dynamic
 * `McpPreset`s so the whole selection/routing/policy/broker pipeline can
 * treat them exactly like the built-in presets. Invalid entries (http
 * without url, stdio without command) are skipped silently — a broken
 * config must never break the built-in presets.
 */
export function buildCustomPresets(
  servers: Record<string, McpCustomServerConfig> | undefined,
): CustomPresetEntry[] {
  if (!servers) return [];

  const entries: CustomPresetEntry[] = [];

  for (const [name, cfg] of Object.entries(servers)) {
    if (!name.trim() || !cfg || typeof cfg !== 'object') continue;

    if (cfg.type === 'http') {
      if (!cfg.url || !isHttpUrl(cfg.url)) continue;
    } else if (cfg.type === 'stdio') {
      if (!cfg.command?.trim()) continue;
    } else {
      continue;
    }

    entries.push({
      enabled: cfg.enabled !== false,
      preset: {
        id: customPresetId(name),
        displayName: name,
        description: `Custom MCP server "${name}" from .nexus/config.json.`,
        transport: cfg.type === 'http' ? 'streamableHttp' : 'stdio',
        endpoint: cfg.type === 'http' ? cfg.url : undefined,
        headers: cfg.headers,
        command: cfg.type === 'stdio' ? cfg.command : undefined,
        args: cfg.type === 'stdio' ? cfg.args : undefined,
        env: cfg.type === 'stdio' ? cfg.env : undefined,
        priority: CUSTOM_PRESET_PRIORITY,
        enabledByDefault: true,
        // Auto-selection keywords: explicit bestFor, or tokens of the server
        // name ("nexus-docs" → ["nexus", "docs"]).
        bestFor: cfg.bestFor?.length ? cfg.bestFor : nameTokens(name),
        // Custom servers answer generic doc intents, never 'microsoft-docs'.
        toolGroups: ['docs', 'samples', 'library-api'],
        // Unknown endpoint + user-supplied credentials → high risk by default,
        // which routes every call through the approval gate.
        risk: cfg.risk ?? 'high',
        defaultTool: cfg.defaultTool,
      },
    });
  }

  return entries;
}

/** Exported so the Settings form validates by the exact same rule the runtime uses. */
export function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function nameTokens(name: string): string[] {
  return name
    .split(/[-_.\s]+/)
    .map(token => token.trim().toLowerCase())
    .filter(token => token.length >= 3);
}

/** Retrieval verbs — what a documentation intent legitimately wants. */
const DOC_HINTS = ['search', 'doc', 'query', 'fetch', 'lookup', 'get', 'find', 'read'];

/** Sample-specific hints, used only for the `samples` group. */
const SAMPLE_HINTS = ['sample', 'example', 'snippet', 'code'];

/**
 * Side-effecting verbs. Penalised hard rather than merely unranked: every intent that
 * reaches this function is a *documentation* request, so calling a mutating tool on an
 * arbitrary user-configured server would be both useless and unsafe.
 */
const MUTATING_HINTS = [
  'write', 'create', 'delete', 'remove', 'update', 'insert', 'upsert',
  'exec', 'run', 'send', 'publish', 'deploy', 'drop', 'modify', 'patch',
];

const NAME_MATCH_SCORE = 3;
const DESCRIPTION_MATCH_SCORE = 1;
const MUTATING_PENALTY = 5;

function scoreTool(tool: McpToolDescriptor, intent: McpToolIntent): number {
  const name = tool.name.toLowerCase();
  const description = (tool.description ?? '').toLowerCase();

  // Name is a far more reliable signal than prose: descriptions routinely mention
  // "search" while describing a write operation.
  const hits = (hints: string[]) =>
    hints.reduce(
      (sum, hint) =>
        sum +
        (name.includes(hint) ? NAME_MATCH_SCORE : 0) +
        (description.includes(hint) ? DESCRIPTION_MATCH_SCORE : 0),
      0,
    );

  let score = hits(DOC_HINTS);
  if (intent.group === 'samples') {
    score += hits(SAMPLE_HINTS);
  }
  if (MUTATING_HINTS.some(hint => name.includes(hint))) {
    score -= MUTATING_PENALTY;
  }

  return score;
}

/**
 * Picks which discovered tool to call for a given intent when the custom
 * server config does not pin a `defaultTool`.
 *
 * Returns `undefined` when no tool stands out — the caller then falls back
 * to the first advertised tool.
 */
export function pickToolNameForIntent(
  tools: McpToolDescriptor[],
  intent: McpToolIntent,
): string | undefined {
  let best: { name: string; score: number } | undefined;

  for (const tool of tools) {
    const score = scoreTool(tool, intent);
    // Strictly greater, so ties keep the server's own ordering (advertised first wins).
    if (!best || score > best.score) {
      best = { name: tool.name, score };
    }
  }

  return best && best.score > 0 ? best.name : undefined;
}
