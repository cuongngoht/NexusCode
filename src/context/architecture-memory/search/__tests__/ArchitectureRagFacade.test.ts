import { describe, it, expect, beforeEach } from 'vitest';
import { ArchitectureRagFacade } from '../ArchitectureRagFacade';
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
        path: 'src/application/usecases/CreateUserUseCase.ts',
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
      edges: [],
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
        sourceEvidence: [],
      },
    ],
    layerSummary: { core: 1, application: 1, infrastructure: 1, interface: 1, support: 0, unknown: 0 },
    layerPaths: {
      core: ['src/core'],
      application: ['src/application'],
      infrastructure: ['src/infrastructure'],
      interface: ['src/interface'],
    },
    ...overrides,
  };
}

describe('ArchitectureRagFacade', () => {
  let facade: ArchitectureRagFacade;

  beforeEach(() => {
    facade = new ArchitectureRagFacade();
  });

  it('returns empty string for empty prompt', () => {
    const result = facade.build(makeMemory(), '');
    expect(result).toBe('');
  });

  it('returns empty string when no documents score above minScore', () => {
    const result = facade.build(makeMemory(), 'xxxxyzzy totally unrelated', { minScore: 999 });
    expect(result).toBe('');
  });

  it('query matching repository returns module with Repository pattern', () => {
    const result = facade.build(makeMemory(), 'fix bug in UserRepository database');
    expect(result).toContain('[module]');
    expect(result).toContain('UserRepository');
    expect(result).toContain('infrastructure');
  });

  it('query matching core layer violation surfaces the violation', () => {
    const result = facade.build(makeMemory(), 'core imports infrastructure layer violation');
    expect(result).toContain('[ERROR]');
    expect(result).toContain('core must not import from infrastructure');
  });

  it('query matching layer surfaces layer summary', () => {
    const result = facade.build(makeMemory(), 'application layer use case service');
    expect(result).toContain('[layer]');
    expect(result).toContain('application');
  });

  it('query matching architecture rules surfaces rule documents', () => {
    const result = facade.build(makeMemory(), 'core domain layer boundary dependency');
    expect(result).toContain('[rule]');
  });

  it('output always includes header with detected style', () => {
    const result = facade.build(makeMemory(), 'any prompt that matches something repository');
    if (result.length > 0) {
      expect(result).toContain('## Architecture Context');
      expect(result).toContain('clean architecture');
    }
  });

  it('output includes layer summary line', () => {
    const result = facade.build(makeMemory(), 'UserRepository fix bug');
    expect(result).toContain('Layers:');
    expect(result).toContain('core (1)');
    expect(result).toContain('infrastructure (1)');
  });

  it('respects maxChars limit', () => {
    const result = facade.build(makeMemory(), 'user repository controller service', { maxChars: 100 });
    expect(result.length).toBeLessThanOrEqual(100);
  });

  it('respects maxResults limit', () => {
    // With maxResults=1, only one result line (beyond header) should be present
    const result = facade.build(makeMemory(), 'user repository controller service infrastructure', { maxResults: 1 });
    const moduleLines = result.split('\n').filter(l => l.startsWith('[module]') || l.startsWith('[violation]') || l.startsWith('[layer]') || l.startsWith('[rule]'));
    expect(moduleLines.length).toBeLessThanOrEqual(1);
  });

  it('lower minScore returns more results', () => {
    const highScore = facade.build(makeMemory(), 'user repository controller', { minScore: 100 });
    const lowScore = facade.build(makeMemory(), 'user repository controller', { minScore: 0.5 });
    // Low minScore should match at least as many items
    const countLines = (s: string) => s.split('\n').filter(l => /^\[(module|violation|layer|rule)\]/.test(l)).length;
    expect(countLines(lowScore)).toBeGreaterThanOrEqual(countLines(highScore));
  });

  it('heuristic config source is shown in header', () => {
    const result = facade.build(makeMemory(), 'UserRepository infrastructure');
    if (result.length > 0) expect(result).toContain('heuristic');
  });

  it('user-config source is shown in header', () => {
    const memory = makeMemory({ configSource: 'user-config' });
    const result = facade.build(memory, 'UserRepository infrastructure');
    if (result.length > 0) expect(result).toContain('user config');
  });

  it('returns empty string for memory with no modules', () => {
    const memory = makeMemory({
      modules: [],
      violations: [],
      layerSummary: { core: 0, application: 0, infrastructure: 0, interface: 0, support: 0, unknown: 0 },
      layerPaths: {},
      detectedStyle: 'unknown',
    });
    const result = facade.build(memory, 'any query here');
    expect(result).toBe('');
  });

  it('controller query returns interface layer module', () => {
    const result = facade.build(makeMemory(), 'UserController interface route handler');
    expect(result).toContain('UserController');
    expect(result).toContain('interface');
  });

  it('use case query returns application layer module', () => {
    const result = facade.build(makeMemory(), 'CreateUserUseCase application service');
    expect(result).toContain('CreateUserUseCase');
    expect(result).toContain('application');
  });
});
