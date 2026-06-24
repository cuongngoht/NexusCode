import type { ArchitectureConfig, ArchitectureLayer } from './types';
import type { StyleDetectionResult } from './ArchitectureStyleDetector';

export class LayerDetector {
  constructor(private readonly layerPaths: Partial<Record<ArchitectureLayer, string[]>>) {}

  detect(relativePath: string): { layer: ArchitectureLayer; sourceEvidence: string[] } {
    const normalized = relativePath.replace(/\\/g, '/');

    for (const [layer, prefixes] of Object.entries(this.layerPaths) as Array<[ArchitectureLayer, string[] | undefined]>) {
      if (!prefixes) continue;
      for (const prefix of prefixes) {
        const normalizedPrefix = prefix.replace(/\\/g, '/');
        const withSlash = normalizedPrefix.endsWith('/') ? normalizedPrefix : `${normalizedPrefix}/`;
        if (normalized.startsWith(withSlash) || normalized === normalizedPrefix) {
          return {
            layer,
            sourceEvidence: [`path starts with '${normalizedPrefix}/'`],
          };
        }
      }
    }

    return { layer: 'unknown', sourceEvidence: [] };
  }
}

export function buildLayerDetectorFromConfig(
  config: ArchitectureConfig | undefined,
  detected: StyleDetectionResult,
): LayerDetector {
  const merged: Partial<Record<ArchitectureLayer, string[]>> = { ...detected.layerPaths };

  if (config?.layers) {
    for (const [layer, paths] of Object.entries(config.layers) as Array<[ArchitectureLayer, string[] | undefined]>) {
      if (paths && paths.length > 0) {
        merged[layer] = paths;
      }
    }
  }

  return new LayerDetector(merged);
}
