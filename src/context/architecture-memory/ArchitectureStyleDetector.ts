import * as fs from 'fs/promises';
import * as path from 'path';
import type { ArchitectureLayer, ArchitectureStyle, LayerBoundary } from './types';

export interface StyleDetectionResult {
  style: ArchitectureStyle;
  layerPaths: Partial<Record<ArchitectureLayer, string[]>>;
  boundaries: LayerBoundary[];
  confidence: number;
}

interface LayerSignals {
  core: string[];
  application: string[];
  infrastructure: string[];
  interface: string[];
  support: string[];
}

const LAYER_SIGNALS: LayerSignals = {
  core: ['core', 'domain', 'entities', 'entity', 'model', 'models'],
  application: ['application', 'app', 'use-cases', 'usecases', 'use_cases', 'services'],
  infrastructure: [
    'infrastructure', 'infra', 'adapters', 'repositories', 'persistence',
    'database', 'db', 'external', 'providers', 'gateway', 'data', 'storage',
    'context', 'runner', 'git', 'analytics', 'mcp',
  ],
  interface: [
    'interface', 'presentation', 'web', 'api', 'controllers', 'routes',
    'http', 'graphql', 'cli', 'ui', 'webview', 'views', 'handlers',
    'endpoints', 'settings', 'review',
  ],
  support: ['shared', 'common', 'utils', 'helpers', 'lib', 'types', 'config', 'constants'],
};

interface StyleSpec {
  style: ArchitectureStyle;
  required: Array<keyof LayerSignals>;
  boundaries: LayerBoundary[];
}

const CLEAN_ARCHITECTURE_BOUNDARIES: LayerBoundary[] = [
  { from: 'core', to: 'application', kind: 'forbidden', description: 'core must not import from application' },
  { from: 'core', to: 'infrastructure', kind: 'forbidden', description: 'core must not import from infrastructure' },
  { from: 'core', to: 'interface', kind: 'forbidden', description: 'core must not import from interface' },
  { from: 'application', to: 'infrastructure', kind: 'forbidden', description: 'application must not import from infrastructure' },
  { from: 'application', to: 'interface', kind: 'forbidden', description: 'application must not import from interface' },
  { from: 'infrastructure', to: 'interface', kind: 'discouraged', description: 'infrastructure should not import from interface' },
];

const MVC_BOUNDARIES: LayerBoundary[] = [
  { from: 'core', to: 'interface', kind: 'discouraged', description: 'models should not import from controllers (bypass service layer)' },
  { from: 'infrastructure', to: 'interface', kind: 'discouraged', description: 'repositories should not import from controllers' },
];

const FEATURE_BOUNDARIES: LayerBoundary[] = [
  { from: 'core', to: 'interface', kind: 'discouraged', description: 'cross-feature imports are discouraged; use shared/ instead' },
];

const STYLE_SPECS: StyleSpec[] = [
  {
    style: 'clean-architecture',
    required: ['core', 'application', 'infrastructure'],
    boundaries: CLEAN_ARCHITECTURE_BOUNDARIES,
  },
  {
    style: 'hexagonal',
    required: ['core', 'infrastructure'],
    boundaries: CLEAN_ARCHITECTURE_BOUNDARIES,
  },
  {
    style: 'mvc',
    required: ['core', 'application', 'interface'],
    boundaries: MVC_BOUNDARIES,
  },
  {
    style: 'feature-based',
    required: ['core', 'support'],
    boundaries: FEATURE_BOUNDARIES,
  },
  {
    style: 'layered',
    required: ['core'],
    boundaries: CLEAN_ARCHITECTURE_BOUNDARIES,
  },
];

export class ArchitectureStyleDetector {
  async detect(workspaceRoot: string): Promise<StyleDetectionResult> {
    const folders = await collectSourceFolders(workspaceRoot);

    const layerPaths: Partial<Record<ArchitectureLayer, string[]>> = {};
    for (const folder of folders) {
      const folderName = path.basename(folder).toLowerCase();
      const relFolder = path.relative(workspaceRoot, folder).replace(/\\/g, '/');

      const layer = matchLayer(folderName);
      if (layer !== 'unknown') {
        if (!layerPaths[layer]) layerPaths[layer] = [];
        layerPaths[layer]!.push(relFolder);
      }
    }

    const detectedLayers = new Set(Object.keys(layerPaths) as ArchitectureLayer[]);

    let bestStyle: ArchitectureStyle = 'unknown';
    let bestScore = 0;
    let bestMatched = 0;
    let bestBoundaries: LayerBoundary[] = [];

    for (const spec of STYLE_SPECS) {
      const matched = spec.required.filter(layer => detectedLayers.has(layer)).length;
      const score = matched / spec.required.length;
      const isBetter = matched >= 1 && (
        score > bestScore ||
        (score === bestScore && matched > bestMatched)
      );
      if (isBetter) {
        bestScore = score;
        bestMatched = matched;
        bestStyle = spec.style;
        bestBoundaries = spec.boundaries;
      }
    }

    return {
      style: bestStyle,
      layerPaths,
      boundaries: bestBoundaries,
      confidence: bestScore,
    };
  }
}

function matchLayer(folderName: string): ArchitectureLayer {
  for (const [layer, signals] of Object.entries(LAYER_SIGNALS) as Array<[keyof LayerSignals, string[]]>) {
    if (signals.includes(folderName)) {
      return layer as ArchitectureLayer;
    }
  }
  return 'unknown';
}

async function collectSourceFolders(workspaceRoot: string): Promise<string[]> {
  const candidates: string[] = [workspaceRoot];
  const srcDir = path.join(workspaceRoot, 'src');
  try {
    const stat = await fs.stat(srcDir);
    if (stat.isDirectory()) {
      candidates.push(srcDir);
    }
  } catch {
    // no src/ dir, scan workspace root
  }

  const results: string[] = [];
  for (const base of candidates) {
    try {
      const entries = await fs.readdir(base, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
        const fullPath = path.join(base, entry.name);
        results.push(fullPath);

        // one level deeper
        try {
          const subEntries = await fs.readdir(fullPath, { withFileTypes: true });
          for (const sub of subEntries) {
            if (!sub.isDirectory()) continue;
            if (sub.name.startsWith('.') || SKIP_DIRS.has(sub.name)) continue;
            results.push(path.join(fullPath, sub.name));
          }
        } catch {
          // ignore unreadable dirs
        }
      }
    } catch {
      // ignore unreadable dirs
    }
  }
  return results;
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', 'coverage',
  '.nexus', 'vendor', '__pycache__', '.venv',
]);
