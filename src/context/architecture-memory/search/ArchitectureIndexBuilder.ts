import { tokenize } from '../../history-search/bm25/Bm25Tokenizer';
import type { ArchitectureLayer, ArchitectureMemory, ArchitectureStyle } from '../types';
import type {
  ArchitectureCorpusStats,
  ArchitectureDocument,
  ArchitectureSearchIndex,
} from './ArchitectureDocument';

type StyleBoundary = {
  from: ArchitectureLayer;
  to: ArchitectureLayer;
  kind: 'forbidden' | 'discouraged';
};

const STYLE_BOUNDARIES: Partial<Record<ArchitectureStyle, StyleBoundary[]>> = {
  'clean-architecture': [
    { from: 'core', to: 'application', kind: 'forbidden' },
    { from: 'core', to: 'infrastructure', kind: 'forbidden' },
    { from: 'core', to: 'interface', kind: 'forbidden' },
    { from: 'application', to: 'infrastructure', kind: 'forbidden' },
    { from: 'application', to: 'interface', kind: 'forbidden' },
    { from: 'infrastructure', to: 'interface', kind: 'discouraged' },
  ],
  hexagonal: [
    { from: 'core', to: 'infrastructure', kind: 'forbidden' },
    { from: 'core', to: 'interface', kind: 'forbidden' },
    { from: 'application', to: 'interface', kind: 'forbidden' },
  ],
  mvc: [
    { from: 'interface', to: 'core', kind: 'discouraged' },
    { from: 'core', to: 'interface', kind: 'discouraged' },
    { from: 'infrastructure', to: 'interface', kind: 'discouraged' },
  ],
  layered: [
    { from: 'core', to: 'infrastructure', kind: 'forbidden' },
    { from: 'core', to: 'interface', kind: 'forbidden' },
  ],
};

export class ArchitectureIndexBuilder {
  build(memory: ArchitectureMemory): ArchitectureSearchIndex {
    const documents: ArchitectureDocument[] = [];

    this.buildModuleDocs(memory, documents);
    this.buildViolationDocs(memory, documents);
    this.buildLayerDocs(memory, documents);
    this.buildRuleDocs(memory, documents);

    const stats = this.computeStats(documents);

    return {
      builtAt: Date.now(),
      detectedStyle: memory.detectedStyle,
      documents,
      stats,
    };
  }

  private buildModuleDocs(memory: ArchitectureMemory, out: ArchitectureDocument[]): void {
    for (const m of memory.modules) {
      const parts = [m.path, 'layer', m.layer];
      if (m.patterns.length > 0) parts.push('patterns', ...m.patterns);
      if (m.sourceEvidence.length > 0) parts.push(...m.sourceEvidence);
      const content = parts.join(' ');
      out.push({
        id: `module::${m.path}`,
        source: 'module',
        section: m.path,
        content,
        tokens: tokenize(content),
      });
    }
  }

  private buildViolationDocs(memory: ArchitectureMemory, out: ArchitectureDocument[]): void {
    for (const v of memory.violations) {
      const content = [
        v.from,
        'imports',
        v.to,
        v.fromLayer,
        'must not import from',
        v.toLayer,
        v.rule,
        v.severity,
      ].join(' ');
      out.push({
        id: `violation::${v.id}`,
        source: 'violation',
        section: `${v.severity.toUpperCase()}: ${v.fromLayer} → ${v.toLayer}`,
        content,
        tokens: tokenize(content),
      });
    }
  }

  private buildLayerDocs(memory: ArchitectureMemory, out: ArchitectureDocument[]): void {
    for (const [layer, count] of Object.entries(memory.layerSummary) as [ArchitectureLayer, number][]) {
      if (count === 0) continue;
      const layerPaths = (memory.layerPaths[layer] ?? []).join(' ');
      const moduleSample = memory.modules
        .filter(m => m.layer === layer)
        .slice(0, 30)
        .map(m => m.path)
        .join(' ');
      const content = `${layer} layer ${count} files ${layerPaths} ${moduleSample}`.trim();
      out.push({
        id: `layer::${layer}`,
        source: 'layer',
        section: `${layer} layer (${count} files)`,
        content,
        tokens: tokenize(content),
      });
    }
  }

  private buildRuleDocs(memory: ArchitectureMemory, out: ArchitectureDocument[]): void {
    const boundaries = STYLE_BOUNDARIES[memory.detectedStyle] ?? [];
    const seen = new Set<string>();

    for (const b of boundaries) {
      const key = `${b.from}->${b.to}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const content = [
        b.from,
        'must not import from',
        b.to,
        b.kind,
        memory.detectedStyle,
        'architecture',
        'dependency',
        'layer boundary',
        b.from === 'core' ? 'domain' : '',
      ].filter(Boolean).join(' ');

      out.push({
        id: `rule::${key}`,
        source: 'rule',
        section: `${b.from} → ${b.to} (${b.kind})`,
        content,
        tokens: tokenize(content),
      });
    }
  }

  private computeStats(documents: ArchitectureDocument[]): ArchitectureCorpusStats {
    const totalDocs = documents.length;
    if (totalDocs === 0) return { avgDocLength: 0, docFreq: {}, totalDocs: 0 };

    let totalTokens = 0;
    const docFreq: Record<string, number> = {};

    for (const doc of documents) {
      totalTokens += doc.tokens.length;
      const seen = new Set<string>();
      for (const token of doc.tokens) {
        if (!seen.has(token)) {
          seen.add(token);
          docFreq[token] = (docFreq[token] ?? 0) + 1;
        }
      }
    }

    return { avgDocLength: totalTokens / totalDocs, docFreq, totalDocs };
  }
}
