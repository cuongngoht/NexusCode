import * as fs from 'fs/promises';
import * as path from 'path';
import { ARCHITECTURE_CONFIG_FILE, type ArchitectureConfig, type ArchitectureLayer } from './types';

export class ArchitectureConfigLoader {
  async load(workspaceRoot: string): Promise<ArchitectureConfig | undefined> {
    const configPath = path.join(workspaceRoot, ARCHITECTURE_CONFIG_FILE);
    try {
      const content = await fs.readFile(configPath, 'utf8');
      const parsed: unknown = JSON.parse(content);
      if (!isValidConfigShape(parsed)) {
        return undefined;
      }
      return parsed;
    } catch {
      return undefined;
    }
  }
}

function isValidConfigShape(value: unknown): value is ArchitectureConfig {
  if (!value || typeof value !== 'object') return false;
  const c = value as Record<string, unknown>;
  if ('layers' in c && (typeof c['layers'] !== 'object' || c['layers'] === null)) return false;
  if ('rules' in c && !Array.isArray(c['rules'])) return false;
  if (c['layers']) {
    const layers = c['layers'] as Record<string, unknown>;
    const validLayers: ArchitectureLayer[] = ['core', 'application', 'infrastructure', 'interface', 'support', 'unknown'];
    for (const key of Object.keys(layers)) {
      if (!validLayers.includes(key as ArchitectureLayer)) return false;
      if (!Array.isArray(layers[key])) return false;
    }
  }
  return true;
}
