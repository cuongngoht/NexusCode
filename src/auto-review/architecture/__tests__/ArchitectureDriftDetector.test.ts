import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ArchitectureDriftDetector } from '../ArchitectureDriftDetector';
import {
  ARCHITECTURE_MEMORY_SCHEMA_VERSION,
  type ArchitectureMemory,
  type ArchitectureModule,
} from '../../../context/architecture-memory';

let tmpDir: string;

function makeModule(
  filePath: string,
  layer: ArchitectureModule['layer'],
  imports: string[],
): ArchitectureModule {
  return {
    path: filePath,
    layer,
    patterns: [],
    imports,
    resolvedImportPaths: [],
    sourceEvidence: [],
  };
}

function writeMemory(memory: Partial<ArchitectureMemory>): void {
  const full: ArchitectureMemory = {
    version: 1,
    schemaVersion: ARCHITECTURE_MEMORY_SCHEMA_VERSION,
    generatedAt: Date.now(),
    workspaceRoot: tmpDir,
    detectedStyle: 'clean-architecture',
    configSource: 'heuristic',
    modules: [],
    graph: { nodes: [], edges: [], builtAt: Date.now() },
    violations: [],
    layerSummary: { core: 0, application: 0, infrastructure: 0, interface: 0, support: 0, unknown: 0 },
    layerPaths: { core: ['src/core'], infrastructure: ['src/runner'] },
    ...memory,
  };
  const dir = path.join(tmpDir, '.nexus', 'architecture-memory');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'architecture.json'), JSON.stringify(full));
}

function writeSource(relPath: string, content: string): void {
  const abs = path.join(tmpDir, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
}

const detector = new ArchitectureDriftDetector();

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'arch-drift-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ArchitectureDriftDetector', () => {
  it('returns unchecked with no boost when architecture memory is missing', async () => {
    const result = await detector.detect(tmpDir, [{ path: 'src/core/task.ts', status: 'M' }]);
    expect(result.checked).toBe(false);
    expect(result.findings).toHaveLength(0);
    expect(result.riskBoost.score).toBe(0);
  });

  it('flags a new core → infrastructure import as a blocking major finding', async () => {
    writeMemory({
      modules: [
        makeModule('src/core/task.ts', 'core', []),
        makeModule('src/runner/db.ts', 'infrastructure', []),
      ],
    });
    writeSource('src/core/task.ts', "import { db } from '../runner/db';\nexport const t = db;\n");
    writeSource('src/runner/db.ts', 'export const db = 1;\n');

    const result = await detector.detect(tmpDir, [{ path: 'src/core/task.ts', status: 'M' }]);

    expect(result.checked).toBe(true);
    expect(result.newViolations).toHaveLength(1);
    expect(result.findings).toHaveLength(1);
    const finding = result.findings[0]!;
    expect(finding.category).toBe('dependency-direction');
    expect(finding.severity).toBe('major');
    expect(finding.blocking).toBe(true);
    expect(finding.filePath).toBe('src/core/task.ts');
    // Pin the exact title: baseline fingerprints depend on it staying deterministic
    expect(finding.title).toBe('New layer violation: core → infrastructure');
    expect(result.riskBoost.score).toBe(15);
    expect(result.riskBoost.factors).toEqual(['Architecture drift: 1 new layer violation(s)']);
  });

  it('does not re-report a violation already recorded in the baseline', async () => {
    writeMemory({
      modules: [
        makeModule('src/core/task.ts', 'core', ['../runner/db']),
        makeModule('src/runner/db.ts', 'infrastructure', []),
      ],
      violations: [{
        id: 'src/core/task.ts->src/runner/db.ts',
        from: 'src/core/task.ts',
        to: 'src/runner/db.ts',
        fromLayer: 'core',
        toLayer: 'infrastructure',
        severity: 'error',
        rule: 'core must not import from infrastructure',
        sourceEvidence: [],
      }],
    });
    writeSource('src/core/task.ts', "import { db } from '../runner/db';\nexport const t = db;\n");
    writeSource('src/runner/db.ts', 'export const db = 1;\n');

    const result = await detector.detect(tmpDir, [{ path: 'src/core/task.ts', status: 'M' }]);
    expect(result.checked).toBe(true);
    expect(result.newViolations).toHaveLength(0);
    expect(result.riskBoost.score).toBe(0);
  });

  it('returns clean when only non-eligible files changed', async () => {
    writeMemory({ modules: [makeModule('src/core/task.ts', 'core', [])] });
    const result = await detector.detect(tmpDir, [
      { path: 'README.md', status: 'M' },
      { path: 'src/core/task.test.ts', status: 'M' },
    ]);
    expect(result.checked).toBe(true);
    expect(result.newViolations).toHaveLength(0);
    expect(result.riskBoost.score).toBe(0);
  });
});
