import * as path from 'path';
import type { FileTreeSnapshot, MarkerHit, ProjectUnit, ProjectKind } from './types';

export class NexusProjectUnitDetector {
  detect(tree: FileTreeSnapshot, markers: MarkerHit[]): ProjectUnit[] {
    const byDir = new Map<string, MarkerHit[]>();

    for (const hit of markers) {
      const dir = path.dirname(hit.path);
      const key = dir === '.' ? '' : dir;
      const existing = byDir.get(key) ?? [];
      existing.push(hit);
      byDir.set(key, existing);
    }

    const units: ProjectUnit[] = [];
    for (const [dir, hits] of byDir) {
      const unit = this.buildUnit(dir, hits, tree.rootPath);
      if (unit) { units.push(unit); }
    }

    return units.sort((a, b) => b.confidence - a.confidence);
  }

  private buildUnit(dir: string, hits: MarkerHit[], workspaceRoot: string): ProjectUnit | null {
    const name = dir === '' ? path.basename(workspaceRoot) : path.basename(dir);

    const kindWeights: Record<string, number> = {};
    for (const hit of hits) {
      kindWeights[hit.kind] = (kindWeights[hit.kind] ?? 0) + hit.weight;
    }

    const sorted = Object.entries(kindWeights).sort((a, b) => b[1] - a[1]);
    const topEntry = sorted[0];
    if (!topEntry) { return null; }
    const topKind = topEntry[0];

    const { projectKind, languages, frameworks } = this.resolveKind(topKind, hits);
    const totalWeight = hits.reduce((sum, h) => sum + h.weight, 0);
    const confidence = Math.round(Math.min(totalWeight / 20, 1.0) * 100) / 100;

    return {
      id: dir === '' ? 'root' : dir.replace(/[\\/]/g, '-'),
      name,
      rootPath: dir,
      kind: projectKind,
      languages,
      frameworks,
      markers: hits.map(h => h.path),
      confidence,
    };
  }

  private resolveKind(
    markerKind: string,
    hits: MarkerHit[],
  ): { projectKind: ProjectKind; languages: string[]; frameworks: string[] } {
    const filenames = hits.map(h => path.basename(h.path));

    switch (markerKind) {
      case 'node': {
        const frameworks: string[] = [];
        if (filenames.some(f => f === 'vite.config.ts' || f === 'vite.config.js')) {
          frameworks.push('Vite');
        }
        if (filenames.some(f => f === 'next.config.js' || f === 'next.config.ts')) {
          frameworks.push('Next.js');
        }
        return { projectKind: 'frontend', languages: ['TypeScript'], frameworks };
      }
      case 'dotnet': {
        const frameworks: string[] = ['.NET'];
        if (filenames.some(f => f === 'Program.cs' || f === 'Startup.cs')) {
          frameworks.push('ASP.NET Core');
        }
        return { projectKind: 'backend', languages: ['C#'], frameworks };
      }
      case 'python': {
        const frameworks: string[] = [];
        if (filenames.includes('manage.py')) { frameworks.push('Django'); }
        if (filenames.includes('app.py')) { frameworks.push('Flask'); }
        return { projectKind: 'backend', languages: ['Python'], frameworks };
      }
      case 'java': {
        const frameworks: string[] = [];
        if (filenames.includes('pom.xml')) { frameworks.push('Maven'); }
        if (filenames.includes('build.gradle')) { frameworks.push('Gradle'); }
        return { projectKind: 'backend', languages: ['Java'], frameworks };
      }
      case 'go':
        return { projectKind: 'backend', languages: ['Go'], frameworks: [] };
      case 'rust':
        return { projectKind: 'library', languages: ['Rust'], frameworks: [] };
      case 'docker':
        return { projectKind: 'tooling', languages: [], frameworks: ['Docker'] };
      default:
        return { projectKind: 'unknown', languages: [], frameworks: [] };
    }
  }
}
