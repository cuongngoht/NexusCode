import { describe, it, expect, beforeEach } from 'vitest';
import { ArchitectureIndexBuilder } from '../ArchitectureIndexBuilder';
import type { ArchitectureMemory } from '../../types';

function makeMemory(overrides: Partial<ArchitectureMemory> = {}): ArchitectureMemory {
  return {
    version: 1,
    schemaVersion: 'architecture-memory-v1',
    generatedAt: Date.now(),
    workspaceRoot: '/project',
    detectedStyle: 'clean-architecture',
    configSource: 'heuristic',
    modules: [
      {
        path: 'src/core/domain/User.ts',
        layer: 'core',
        patterns: ['Entity'],
        imports: [],
        resolvedImportPaths: [],
        sourceEvidence: ['matched src/core'],
      },
      {
        path: 'src/infrastructure/db/UserRepository.ts',
        layer: 'infrastructure',
        patterns: ['Repository'],
        imports: ['../../core/domain/User'],
        resolvedImportPaths: ['src/core/domain/User.ts'],
        sourceEvidence: ['matched src/infrastructure'],
      },
      {
        path: 'src/application/usecases/CreateUser.ts',
        layer: 'application',
        patterns: [],
        imports: [],
        resolvedImportPaths: [],
        sourceEvidence: ['matched src/application'],
      },
      {
        path: 'src/interface/controllers/UserController.ts',
        layer: 'interface',
        patterns: ['Controller'],
        imports: [],
        resolvedImportPaths: [],
        sourceEvidence: ['matched src/interface'],
      },
    ],
    graph: {
      nodes: ['src/core/domain/User.ts', 'src/infrastructure/db/UserRepository.ts'],
      edges: [
        {
          from: 'src/core/domain/User.ts',
          to: 'src/infrastructure/db/UserRepository.ts',
          fromLayer: 'core',
          toLayer: 'infrastructure',
        },
      ],
      builtAt: Date.now(),
    },
    violations: [
      {
        id: 'src/core/domain/User.ts->src/infrastructure/db/UserRepository.ts',
        from: 'src/core/domain/User.ts',
        to: 'src/infrastructure/db/UserRepository.ts',
        fromLayer: 'core',
        toLayer: 'infrastructure',
        severity: 'error',
        rule: 'core must not import from infrastructure',
        sourceEvidence: ['edge core→infrastructure'],
      },
    ],
    layerSummary: {
      core: 1,
      application: 1,
      infrastructure: 1,
      interface: 1,
      support: 0,
      unknown: 0,
    },
    layerPaths: {
      core: ['src/core'],
      application: ['src/application'],
      infrastructure: ['src/infrastructure'],
      interface: ['src/interface'],
    },
    ...overrides,
  };
}

describe('ArchitectureIndexBuilder', () => {
  let builder: ArchitectureIndexBuilder;

  beforeEach(() => {
    builder = new ArchitectureIndexBuilder();
  });

  it('builds an index with documents', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    expect(index.documents.length).toBeGreaterThan(0);
  });

  it('includes module documents for each module', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    const moduleDocs = index.documents.filter(d => d.source === 'module');
    expect(moduleDocs).toHaveLength(4);
  });

  it('module doc has correct id, section and non-empty tokens', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    const userDoc = index.documents.find(d => d.id === 'module::src/core/domain/User.ts');
    expect(userDoc).toBeDefined();
    expect(userDoc!.section).toBe('src/core/domain/User.ts');
    expect(userDoc!.tokens.length).toBeGreaterThan(0);
    expect(userDoc!.tokens).toContain('core');
  });

  it('module doc content includes layer and patterns', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    const repoDoc = index.documents.find(d => d.id === 'module::src/infrastructure/db/UserRepository.ts');
    expect(repoDoc).toBeDefined();
    expect(repoDoc!.content).toContain('infrastructure');
    expect(repoDoc!.content).toContain('Repository');
  });

  it('includes one violation document per violation', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    const violationDocs = index.documents.filter(d => d.source === 'violation');
    expect(violationDocs).toHaveLength(1);
  });

  it('violation doc section includes severity and layers', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    const vDoc = index.documents.find(d => d.source === 'violation');
    expect(vDoc!.section).toMatch(/ERROR/);
    expect(vDoc!.section).toContain('core');
    expect(vDoc!.section).toContain('infrastructure');
  });

  it('violation doc content includes from/to paths and rule', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    const vDoc = index.documents.find(d => d.source === 'violation');
    expect(vDoc!.content).toContain('src/core/domain/User.ts');
    expect(vDoc!.content).toContain('core must not import from infrastructure');
  });

  it('includes layer summary documents only for layers with files', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    const layerDocs = index.documents.filter(d => d.source === 'layer');
    expect(layerDocs).toHaveLength(4); // core, application, infrastructure, interface (support=0, unknown=0)
    expect(layerDocs.every(d => !d.section.includes('(0 files)'))).toBe(true);
  });

  it('layer doc section includes file count', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    const coreLayer = index.documents.find(d => d.id === 'layer::core');
    expect(coreLayer!.section).toBe('core layer (1 files)');
  });

  it('layer doc content includes module paths', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    const infraLayer = index.documents.find(d => d.id === 'layer::infrastructure');
    expect(infraLayer!.content).toContain('UserRepository');
  });

  it('includes rule documents for clean-architecture boundaries', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    const ruleDocs = index.documents.filter(d => d.source === 'rule');
    expect(ruleDocs.length).toBeGreaterThan(0);
    const coreToApp = ruleDocs.find(d => d.id === 'rule::core->application');
    expect(coreToApp).toBeDefined();
    expect(coreToApp!.section).toContain('forbidden');
  });

  it('no rule documents for unknown style', () => {
    const memory = makeMemory({ detectedStyle: 'unknown' });
    const index = builder.build(memory);
    const ruleDocs = index.documents.filter(d => d.source === 'rule');
    expect(ruleDocs).toHaveLength(0);
  });

  it('stats.totalDocs equals documents.length', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    expect(index.stats.totalDocs).toBe(index.documents.length);
  });

  it('stats.avgDocLength is greater than 0', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    expect(index.stats.avgDocLength).toBeGreaterThan(0);
  });

  it('stats.docFreq is populated for common terms', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    // 'core' appears in multiple docs (module, layer, rule docs)
    expect(index.stats.docFreq['core']).toBeGreaterThan(1);
  });

  it('detectedStyle is reflected in index', () => {
    const memory = makeMemory();
    const index = builder.build(memory);
    expect(index.detectedStyle).toBe('clean-architecture');
  });

  it('handles empty modules gracefully', () => {
    const memory = makeMemory({
      modules: [],
      violations: [],
      layerSummary: { core: 0, application: 0, infrastructure: 0, interface: 0, support: 0, unknown: 0 },
      layerPaths: {},
    });
    const index = builder.build(memory);
    // Only rule docs remain for clean-architecture
    expect(index.documents.filter(d => d.source === 'module')).toHaveLength(0);
    expect(index.documents.filter(d => d.source === 'layer')).toHaveLength(0);
  });
});
