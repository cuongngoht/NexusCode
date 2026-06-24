import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ArchitectureMemoryValidator } from '../ArchitectureMemoryValidator';
import { ArchitectureMemoryWriter } from '../ArchitectureMemoryWriter';
import { ArchitectureMemoryLoader } from '../ArchitectureMemoryLoader';
import { ARCHITECTURE_MEMORY_SCHEMA_VERSION, ARCHITECTURE_MEMORY_FILES } from '../types';
import type { ArchitectureMemory } from '../types';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-arch-mem-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function makeValidMemory(workspaceRoot: string): ArchitectureMemory {
  return {
    version: 1,
    schemaVersion: ARCHITECTURE_MEMORY_SCHEMA_VERSION,
    generatedAt: Date.now(),
    workspaceRoot,
    detectedStyle: 'clean-architecture',
    configSource: 'heuristic',
    modules: [
      {
        path: 'src/core/Foo.ts',
        layer: 'core',
        patterns: [],
        imports: [],
        resolvedImportPaths: [],
        sourceEvidence: [],
      },
    ],
    graph: { nodes: ['src/core/Foo.ts'], edges: [], builtAt: Date.now() },
    violations: [],
    layerSummary: { core: 1, application: 0, infrastructure: 0, interface: 0, support: 0, unknown: 0 },
    layerPaths: { core: ['src/core'] },
  };
}

describe('ArchitectureMemoryValidator', () => {
  it('returns valid for a fresh, correct memory object', () => {
    const validator = new ArchitectureMemoryValidator();
    const memory = makeValidMemory(tmp);
    expect(validator.validate(memory)).toEqual({ valid: true });
  });

  it('returns invalid when schemaVersion mismatches', () => {
    const validator = new ArchitectureMemoryValidator();
    const memory = { ...makeValidMemory(tmp), schemaVersion: 'old-version' };
    const result = validator.validate(memory);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('schema version');
  });

  it('returns invalid when memory is older than maxAgeMs', () => {
    const validator = new ArchitectureMemoryValidator(1000);
    const memory = { ...makeValidMemory(tmp), generatedAt: Date.now() - 2000 };
    const result = validator.validate(memory);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('stale');
  });

  it('returns invalid when modules array is empty', () => {
    const validator = new ArchitectureMemoryValidator();
    const memory = { ...makeValidMemory(tmp), modules: [] };
    const result = validator.validate(memory);
    expect(result.valid).toBe(false);
    expect(result.reason).toContain('no modules');
  });
});

describe('ArchitectureMemoryLoader', () => {
  const loader = new ArchitectureMemoryLoader();

  it('returns undefined for a missing file', async () => {
    expect(await loader.loadMemory(tmp)).toBeUndefined();
  });

  it('returns undefined for corrupt JSON', async () => {
    const dir = path.join(tmp, '.nexus', 'architecture-memory');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'architecture.json'), 'not-json', 'utf8');
    expect(await loader.loadMemory(tmp)).toBeUndefined();
  });

  it('returns undefined for invalid shape (missing fields)', async () => {
    const dir = path.join(tmp, '.nexus', 'architecture-memory');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'architecture.json'), JSON.stringify({ garbage: true }), 'utf8');
    expect(await loader.loadMemory(tmp)).toBeUndefined();
  });

  it('returns undefined for violations file when missing', async () => {
    expect(await loader.loadViolations(tmp)).toBeUndefined();
  });

  it('returns empty array for violations file with empty array', async () => {
    const dir = path.join(tmp, '.nexus', 'architecture-memory');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'violations.json'), '[]', 'utf8');
    const result = await loader.loadViolations(tmp);
    expect(result).toEqual([]);
  });
});

describe('Writer + Loader round-trip', () => {
  it('writes then loads then validates successfully', async () => {
    const writer = new ArchitectureMemoryWriter();
    const loader = new ArchitectureMemoryLoader();
    const validator = new ArchitectureMemoryValidator();

    const memory = makeValidMemory(tmp);
    await writer.write(tmp, memory, '# Architecture Memory\n');

    const loaded = await loader.loadMemory(tmp);
    expect(loaded).not.toBeUndefined();

    const validation = validator.validate(loaded!);
    expect(validation.valid).toBe(true);
  });

  it('writes violations and loads them back', async () => {
    const writer = new ArchitectureMemoryWriter();
    const loader = new ArchitectureMemoryLoader();

    const memory = makeValidMemory(tmp);
    memory.violations.push({
      id: 'src/core/Foo.ts->src/infra/Bar.ts',
      from: 'src/core/Foo.ts',
      to: 'src/infra/Bar.ts',
      fromLayer: 'core',
      toLayer: 'infrastructure',
      severity: 'error',
      rule: 'core must not import from infrastructure',
      sourceEvidence: ['src/core/Foo.ts imports src/infra/Bar.ts'],
    });
    await writer.write(tmp, memory, '# Architecture Memory\n');

    const violations = await loader.loadViolations(tmp);
    expect(violations).toHaveLength(1);
    expect(violations![0]!.severity).toBe('error');
  });

  it('writes all four artifact files', async () => {
    const writer = new ArchitectureMemoryWriter();
    const memory = makeValidMemory(tmp);
    const { filesWritten } = await writer.write(tmp, memory, '# md');

    expect(filesWritten).toHaveLength(4);
    for (const key of ['architectureJson', 'architectureMd', 'dependencyGraph', 'violations'] as const) {
      const expected = path.join(tmp, ARCHITECTURE_MEMORY_FILES[key]);
      expect(fs.existsSync(expected)).toBe(true);
    }
  });
});
