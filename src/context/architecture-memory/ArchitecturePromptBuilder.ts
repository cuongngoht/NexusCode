import type { ArchitectureLayer, ArchitectureMemory, DependencyViolation, LayerBoundary } from './types';

export interface ArchitecturePromptBuildOptions {
  maxViolations?: number;
  maxChars?: number;
}

const CLEAN_ARCH_BOUNDARIES: LayerBoundary[] = [
  { from: 'core', to: 'application', kind: 'forbidden', description: 'core must not import from application' },
  { from: 'core', to: 'infrastructure', kind: 'forbidden', description: 'core must not import from infrastructure' },
  { from: 'core', to: 'interface', kind: 'forbidden', description: 'core must not import from interface' },
  { from: 'application', to: 'infrastructure', kind: 'forbidden', description: 'application must not import from infrastructure' },
  { from: 'application', to: 'interface', kind: 'forbidden', description: 'application must not import from interface' },
  { from: 'infrastructure', to: 'interface', kind: 'discouraged', description: 'infrastructure should not import from interface' },
];

export class ArchitecturePromptBuilder {
  build(
    memory: ArchitectureMemory,
    touchedFiles: string[],
    opts: ArchitecturePromptBuildOptions = {},
  ): string {
    const maxViolations = opts.maxViolations ?? 10;
    const maxChars = opts.maxChars ?? 3000;

    const touchedSet = new Set(touchedFiles.map(f => f.replace(/\\/g, '/')));
    const touchedLayers = new Set<ArchitectureLayer>();

    for (const mod of memory.modules) {
      if (touchedSet.has(mod.path) && mod.layer !== 'unknown') {
        touchedLayers.add(mod.layer);
      }
    }

    const relevantBoundaries = CLEAN_ARCH_BOUNDARIES.filter(
      b => touchedLayers.has(b.from) || touchedLayers.has(b.to),
    );

    const directViolations = memory.violations.filter(
      v => touchedSet.has(v.from) || touchedSet.has(v.to),
    );
    const layerViolations = memory.violations.filter(
      v => !touchedSet.has(v.from) && !touchedSet.has(v.to) &&
        (touchedLayers.has(v.fromLayer) || touchedLayers.has(v.toLayer)),
    );
    const otherViolations = memory.violations.filter(
      v => !touchedSet.has(v.from) && !touchedSet.has(v.to) &&
        !touchedLayers.has(v.fromLayer) && !touchedLayers.has(v.toLayer),
    );

    const filteredViolations = [
      ...directViolations,
      ...layerViolations,
      ...otherViolations,
    ].slice(0, maxViolations);

    const touchedPatterns: string[] = [];
    for (const mod of memory.modules) {
      if (touchedSet.has(mod.path)) {
        for (const p of mod.patterns) {
          if (!touchedPatterns.includes(p)) touchedPatterns.push(p);
        }
      }
    }

    const hasContent =
      relevantBoundaries.length > 0 ||
      filteredViolations.length > 0 ||
      touchedPatterns.length > 0;

    if (!hasContent) return '';

    const lines: string[] = [];
    const styleLabel = memory.detectedStyle.replace(/-/g, ' ');
    const sourceLabel = memory.configSource === 'user-config' ? 'user config' : 'heuristic';

    lines.push(`## Architecture Context (${capitalize(styleLabel)} — ${sourceLabel})`);

    const layerCounts = Object.entries(memory.layerSummary)
      .filter(([, count]) => count > 0)
      .map(([layer, count]) => `${layer} (${count} files)`)
      .join(', ');
    if (layerCounts) {
      lines.push(`Layers: ${layerCounts}`);
    }

    if (relevantBoundaries.length > 0) {
      lines.push('');
      lines.push('## Architecture Rules (relevant to changed files)');
      for (const b of relevantBoundaries) {
        lines.push(`- ${b.description}`);
      }
    }

    if (filteredViolations.length > 0) {
      const errors = filteredViolations.filter(v => v.severity === 'error').length;
      const warnings = filteredViolations.filter(v => v.severity === 'warning').length;
      lines.push('');
      lines.push(`## Dependency Violations (${errors} errors, ${warnings} warnings)`);
      for (const v of filteredViolations) {
        const prefix = v.severity === 'error' ? 'ERROR' : 'WARN';
        lines.push(`- ${prefix}: \`${v.from}\` → \`${v.to}\` (${v.fromLayer} → ${v.toLayer})`);
        lines.push(`  _${v.rule}_`);
      }
      if (memory.violations.length > maxViolations) {
        lines.push(`_(${memory.violations.length - maxViolations} more violations not shown)_`);
      }
    }

    if (touchedPatterns.length > 0) {
      lines.push('');
      lines.push(`## Design Patterns in Changed Files`);
      lines.push(touchedPatterns.join(', '));
    }

    let result = lines.join('\n');
    if (result.length > maxChars) {
      result = result.slice(0, maxChars) + '\n_(truncated)_';
    }
    return result;
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
