import * as fs from 'fs/promises';
import * as path from 'path';
import type { ArchitectureModule } from './types';
import type { LayerDetector } from './LayerDetector';
import type { PatternDetector } from './PatternDetector';

const STATIC_IMPORT_RE = /^import\s+(?:type\s+)?(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/gm;
const DYNAMIC_IMPORT_RE = /(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/gm;

const SKIP_PATH_PARTS = new Set([
  'node_modules', '.nexus', 'dist', 'build', 'out', 'coverage', '__pycache__',
]);

export function parseImports(content: string): string[] {
  const specifiers = new Set<string>();

  STATIC_IMPORT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = STATIC_IMPORT_RE.exec(content)) !== null) {
    if (m[1]) specifiers.add(m[1]);
  }

  DYNAMIC_IMPORT_RE.lastIndex = 0;
  while ((m = DYNAMIC_IMPORT_RE.exec(content)) !== null) {
    if (m[1]) specifiers.add(m[1]);
  }

  return Array.from(specifiers);
}

export class ModuleDetector {
  constructor(
    private readonly layerDetector: LayerDetector,
    private readonly patternDetector: PatternDetector,
  ) {}

  async detect(workspaceRoot: string, files: string[]): Promise<ArchitectureModule[]> {
    const modules: ArchitectureModule[] = [];

    for (const relPath of files) {
      if (!isEligibleFile(relPath)) continue;

      const absPath = path.join(workspaceRoot, relPath);
      let content: string;
      try {
        content = await fs.readFile(absPath, 'utf8');
      } catch {
        continue;
      }

      const normalized = relPath.replace(/\\/g, '/');
      const { layer, sourceEvidence: layerEvidence } = this.layerDetector.detect(normalized);
      const { patterns, sourceEvidence: patternEvidence } = this.patternDetector.detect(normalized, content);
      const imports = parseImports(content);

      modules.push({
        path: normalized,
        layer,
        patterns,
        imports,
        resolvedImportPaths: [],
        sourceEvidence: [...layerEvidence, ...patternEvidence],
      });
    }

    return modules;
  }
}

function isEligibleFile(relPath: string): boolean {
  const normalized = relPath.replace(/\\/g, '/');
  if (!normalized.endsWith('.ts') && !normalized.endsWith('.tsx')) return false;
  if (normalized.endsWith('.test.ts') || normalized.endsWith('.test.tsx')) return false;
  if (normalized.endsWith('.spec.ts') || normalized.endsWith('.spec.tsx')) return false;
  if (normalized.endsWith('.d.ts')) return false;
  const parts = normalized.split('/');
  if (parts.some(p => SKIP_PATH_PARTS.has(p))) return false;
  return true;
}
