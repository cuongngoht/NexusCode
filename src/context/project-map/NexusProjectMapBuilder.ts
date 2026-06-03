import * as path from 'path';
import type { FileTreeSnapshot, MarkerHit, ProjectUnit } from './types';

export class NexusProjectMapBuilder {
  build(input: {
    tree: FileTreeSnapshot;
    markers: MarkerHit[];
    units: ProjectUnit[];
  }): string {
    const { tree, units } = input;
    const lines: string[] = [];

    lines.push('# Nexus Project Map', '');
    lines.push('## Workspace');
    lines.push(`- Root: ${tree.rootPath}`);
    lines.push(`- Generated At: ${tree.generatedAt}`);
    lines.push(`- Files Scanned: ${tree.files.length}`);
    lines.push('');

    lines.push('## Detected Units', '');

    if (units.length === 0) {
      lines.push('_No project units detected._', '');
    } else {
      for (const unit of units) {
        lines.push(`### ${unit.name}`);
        lines.push(`- Kind: ${unit.kind}`);
        lines.push(`- Root: ${unit.rootPath || '.'}`);
        if (unit.languages.length > 0) {
          lines.push(`- Languages: ${unit.languages.join(', ')}`);
        }
        if (unit.frameworks.length > 0) {
          lines.push(`- Frameworks: ${unit.frameworks.join(' / ')}`);
        }
        lines.push(`- Confidence: ${unit.confidence}`);
        if (unit.markers.length > 0) {
          lines.push('- Markers:');
          for (const m of unit.markers) {
            lines.push(`  - ${m}`);
          }
        }
        lines.push('');
      }
    }

    const importantExtensions = new Set(['.md', '.json', '.yaml', '.yml', '.toml']);
    const importantFiles = tree.files
      .filter(f => path.dirname(f) === '.' && importantExtensions.has(path.extname(f)))
      .slice(0, 20);

    if (importantFiles.length > 0) {
      lines.push('## Important Files');
      for (const f of importantFiles) {
        lines.push(`- ${f}`);
      }
      lines.push('');
    }

    lines.push('## Workspace Files', '');
    lines.push(`Total: ${tree.files.length} files, ${tree.folders.length} folders`);
    if (tree.skipped.folders.length > 0) {
      lines.push(`Skipped: ${tree.skipped.folders.length} ignored folders`);
    }
    lines.push('');

    lines.push('## Suggested Context Scopes', '');
    for (const unit of units) {
      lines.push(`- ${unit.name}`);
    }
    lines.push('- whole-workspace');
    lines.push('- git-changes');
    lines.push('');

    return lines.join('\n');
  }
}
