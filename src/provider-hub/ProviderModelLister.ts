import { spawn } from 'child_process';
import type { ProviderId, ProviderModel } from '../core/types';
import type { ProviderModelListCommand } from './ProviderTypes';
import { getProviderSpec, getAllProviderSpecs } from './ProviderSpecRegistry';
import { ModelCache } from './ModelCache';

export interface ListOptions {
  /** When true, bypass and invalidate the cache before fetching. */
  force?: boolean;
}

function seededFromSpec(seededIds: readonly string[]): ProviderModel[] {
  return seededIds.map(id => ({ id, label: id, source: 'seeded' as const }));
}

/** Navigate a dot-notation JSON path, e.g. "data.models" on a parsed object. */
function navigateJsonPath(obj: unknown, jsonPath: string): unknown {
  const parts = jsonPath.split('.');
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function parseModelListOutput(
  output: string,
  cmd: ProviderModelListCommand,
): ProviderModel[] {
  try {
    if (cmd.parser === 'json') {
      const parsed: unknown = JSON.parse(output.trim());
      const root = cmd.jsonPath ? navigateJsonPath(parsed, cmd.jsonPath) : parsed;
      if (!Array.isArray(root)) return [];
      const mapped: Array<ProviderModel | null> = root.map((item: unknown) => {
        if (typeof item === 'string') {
          return { id: item, label: item, source: 'detected' as const } satisfies ProviderModel;
        }
        if (typeof item === 'object' && item !== null) {
          const obj = item as Record<string, unknown>;
          const id = String(obj['id'] ?? obj['name'] ?? '');
          const label = String(obj['label'] ?? obj['name'] ?? id);
          return { id, label, source: 'detected' as const } satisfies ProviderModel;
        }
        return null;
      });
      return mapped.filter((m): m is ProviderModel => m !== null && m.id !== '');
    }

    if (cmd.parser === 'lines') {
      return output
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 0)
        .map(id => ({ id, label: id, source: 'detected' as const }));
    }

    if (cmd.parser === 'regex' && cmd.regex) {
      const models: ProviderModel[] = [];
      const re = new RegExp(cmd.regex.source, cmd.regex.flags.includes('g') ? cmd.regex.flags : cmd.regex.flags + 'g');
      let match: RegExpExecArray | null;
      while ((match = re.exec(output)) !== null) {
        const id = match[1] ?? match[0];
        models.push({ id, label: id, source: 'detected' as const });
      }
      return models;
    }
  } catch {
    // Fall through to empty
  }
  return [];
}

function runModelListCommand(cmd: ProviderModelListCommand): Promise<ProviderModel[]> {
  return new Promise(resolve => {
    let settled = false;
    let out = '';
    const finish = (models: ProviderModel[]) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(models);
    };

    const proc = spawn(cmd.binary, cmd.args, { shell: false });
    const timer = setTimeout(() => {
      proc.kill();
      finish([]);
    }, cmd.timeoutMs ?? 8_000);

    proc.stdout.on('data', (chunk: Buffer) => { out += chunk.toString(); });
    proc.on('close', () => {
      const models = parseModelListOutput(out, cmd);
      finish(models);
    });
    proc.on('error', () => finish([]));
  });
}

export class ProviderModelLister {
  private readonly cache: ModelCache;

  constructor(cache?: ModelCache) {
    this.cache = cache ?? new ModelCache();
  }

  /**
   * Lists available models for a provider.
   * Uses spec's modelListCommand when available, otherwise falls back to seededModels.
   * Never throws.
   */
  async list(providerId: ProviderId, options: ListOptions = {}): Promise<ProviderModel[]> {
    try {
      const spec = getProviderSpec(providerId);
      if (!spec) {
        // Unknown provider — return empty
        return [];
      }

      if (options.force) {
        this.cache.invalidate(providerId);
      }

      const cached = this.cache.get(providerId);
      if (cached) return cached;

      let models: ProviderModel[] = [];

      if (spec.modelListCommand) {
        const fetched = await runModelListCommand(spec.modelListCommand);
        models = fetched.length > 0 ? fetched : seededFromSpec(spec.seededModels);
      } else {
        models = seededFromSpec(spec.seededModels);
      }

      this.cache.set(providerId, models);
      return models;
    } catch {
      // Fallback: return seeded models for the provider
      const spec = getProviderSpec(providerId);
      return spec ? seededFromSpec(spec.seededModels) : [];
    }
  }

  /**
   * Lists models for all known providers.
   */
  async listAll(options: ListOptions = {}): Promise<Map<ProviderId, ProviderModel[]>> {
    const result = new Map<ProviderId, ProviderModel[]>();
    const specs = getAllProviderSpecs();
    await Promise.all(
      specs.map(async spec => {
        const models = await this.list(spec.id, options);
        result.set(spec.id, models);
      }),
    );
    return result;
  }

  invalidateCache(providerId?: ProviderId): void {
    this.cache.invalidate(providerId);
  }
}
