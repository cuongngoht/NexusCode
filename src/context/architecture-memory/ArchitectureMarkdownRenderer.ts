import type { ArchitectureLayer, ArchitectureMemory, DependencyViolation } from './types';

const MAX_MODULES_PER_LAYER = 50;

export class ArchitectureMarkdownRenderer {
  render(memory: ArchitectureMemory): string {
    const lines: string[] = [];

    const generatedDate = new Date(memory.generatedAt).toISOString();
    const styleLabel = memory.detectedStyle.replace(/-/g, ' ');
    const sourceLabel = memory.configSource === 'user-config' ? 'user config' : 'heuristic';

    lines.push('# Architecture Memory');
    lines.push('');
    lines.push(`Generated: ${generatedDate}`);
    lines.push(`Workspace: ${memory.workspaceRoot}`);
    lines.push(`Detected style: ${capitalize(styleLabel)} (${sourceLabel})`);

    // Layer mapping
    const layerEntries = Object.entries(memory.layerPaths) as Array<[ArchitectureLayer, string[] | undefined]>;
    if (layerEntries.length > 0) {
      lines.push('');
      lines.push('## Layer Mapping');
      lines.push('');
      lines.push('| Layer | Paths |');
      lines.push('|-------|-------|');
      for (const [layer, paths] of layerEntries) {
        if (!paths || paths.length === 0) continue;
        lines.push(`| ${layer} | ${paths.join(', ')} |`);
      }
    }

    // Layer summary
    lines.push('');
    lines.push('## Layer Summary');
    lines.push('');
    lines.push('| Layer | Files |');
    lines.push('|-------|-------|');
    const allLayers: ArchitectureLayer[] = ['core', 'application', 'infrastructure', 'interface', 'support', 'unknown'];
    for (const layer of allLayers) {
      const count = memory.layerSummary[layer] ?? 0;
      if (count > 0) {
        lines.push(`| ${layer} | ${count} |`);
      }
    }

    // Violations
    const errors = memory.violations.filter(v => v.severity === 'error');
    const warnings = memory.violations.filter(v => v.severity === 'warning');
    lines.push('');
    lines.push(`## Dependency Violations (${errors.length} errors, ${warnings.length} warnings)`);
    lines.push('');

    if (memory.violations.length === 0) {
      lines.push('No dependency violations detected.');
    } else {
      if (errors.length > 0) {
        lines.push(`### Errors (${errors.length})`);
        lines.push('');
        for (const v of errors) {
          lines.push(renderViolation(v));
        }
      }
      if (warnings.length > 0) {
        lines.push('');
        lines.push(`### Warnings (${warnings.length})`);
        lines.push('');
        for (const v of warnings) {
          lines.push(renderViolation(v));
        }
      }
    }

    // Design patterns
    const patternMap = new Map<string, string[]>();
    for (const mod of memory.modules) {
      for (const p of mod.patterns) {
        if (!patternMap.has(p)) patternMap.set(p, []);
        patternMap.get(p)!.push(mod.path);
      }
    }

    lines.push('');
    lines.push('## Design Patterns Detected');
    lines.push('');

    if (patternMap.size === 0) {
      lines.push('No design patterns detected.');
    } else {
      for (const [pattern, files] of Array.from(patternMap.entries()).sort()) {
        lines.push(`### ${pattern} (${files.length} file${files.length === 1 ? '' : 's'})`);
        for (const f of files.slice(0, 20)) {
          lines.push(`- ${f}`);
        }
        if (files.length > 20) {
          lines.push(`- _(and ${files.length - 20} more)_`);
        }
        lines.push('');
      }
    }

    // Module inventory
    lines.push('## Module Inventory');
    lines.push('');

    for (const layer of allLayers) {
      const layerModules = memory.modules.filter(m => m.layer === layer);
      if (layerModules.length === 0) continue;

      lines.push(`### ${layer} (${layerModules.length} files)`);
      const shown = layerModules.slice(0, MAX_MODULES_PER_LAYER);
      for (const mod of shown) {
        const patternsStr = mod.patterns.length > 0 ? ` [${mod.patterns.join(', ')}]` : '';
        lines.push(`- ${mod.path}${patternsStr}`);
      }
      if (layerModules.length > MAX_MODULES_PER_LAYER) {
        lines.push(`- _(and ${layerModules.length - MAX_MODULES_PER_LAYER} more)_`);
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

function renderViolation(v: DependencyViolation): string {
  return `- \`${v.from}\` → \`${v.to}\` (${v.fromLayer} → ${v.toLayer})\n  _${v.rule}_`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
