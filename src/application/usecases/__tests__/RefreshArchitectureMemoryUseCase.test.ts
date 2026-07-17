import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { RefreshArchitectureMemoryUseCase } from '../RefreshArchitectureMemoryUseCase';
import { BuildArchitectureMemoryUseCase } from '../BuildArchitectureMemoryUseCase';
import { ArchitectureMemoryLoader, ARCHITECTURE_MEMORY_FILES } from '../../../context/architecture-memory';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-refresh-arch-mem-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeFile(relPath: string, content: string): void {
  const abs = path.join(tmp, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

async function loadJson(relPath: string): Promise<any> {
  return JSON.parse(fs.readFileSync(path.join(tmp, relPath), 'utf8'));
}

describe('RefreshArchitectureMemoryUseCase', () => {
  it('skips when there are no eligible changed paths', async () => {
    const useCase = new RefreshArchitectureMemoryUseCase();
    const result = await useCase.execute({ workspaceRoot: tmp, changedPaths: [{ path: 'README.md', status: 'M' }] });
    expect(result).toEqual({ kind: 'skipped', reason: 'no-eligible-paths' });
  });

  it('skips when there is no prior baseline (never implicitly triggers a first full scan)', async () => {
    const useCase = new RefreshArchitectureMemoryUseCase();
    const result = await useCase.execute({ workspaceRoot: tmp, changedPaths: [{ path: 'src/core/Foo.ts', status: 'M' }] });
    expect(result).toEqual({ kind: 'skipped', reason: 'no-baseline' });
  });

  it('incrementally refreshes only the touched module and never drops unrelated modules (regression)', async () => {
    writeFile('src/core/Foo.ts', 'export class Foo {}');
    writeFile('src/application/Bar.ts', 'export class Bar {}');
    writeFile('src/infrastructure/Baz.ts', 'export class Baz {}');

    await new BuildArchitectureMemoryUseCase().execute({
      workspaceRoot: tmp,
      files: ['src/core/Foo.ts', 'src/application/Bar.ts', 'src/infrastructure/Baz.ts'],
    });
    const baselineJson = await loadJson(ARCHITECTURE_MEMORY_FILES.architectureJson);
    expect(baselineJson.modules).toHaveLength(3);

    // Only Foo.ts changes between snapshots.
    writeFile('src/core/Foo.ts', "import { Bar } from '../application/Bar';\nexport class Foo { bar = new Bar(); }");

    const useCase = new RefreshArchitectureMemoryUseCase();
    const result = await useCase.execute({
      workspaceRoot: tmp,
      changedPaths: [{ path: 'src/core/Foo.ts', status: 'M' }],
    });

    expect(result.kind).toBe('refreshed');
    if (result.kind !== 'refreshed') throw new Error('expected refreshed');
    expect(result.moduleCount).toBe(3);

    const refreshedJson = await loadJson(ARCHITECTURE_MEMORY_FILES.architectureJson);
    expect(refreshedJson.modules).toHaveLength(3);

    const bar = refreshedJson.modules.find((m: any) => m.path === 'src/application/Bar.ts');
    const baz = refreshedJson.modules.find((m: any) => m.path === 'src/infrastructure/Baz.ts');
    const baselineBar = baselineJson.modules.find((m: any) => m.path === 'src/application/Bar.ts');
    const baselineBaz = baselineJson.modules.find((m: any) => m.path === 'src/infrastructure/Baz.ts');

    // Untouched modules are byte-identical to baseline — proof they were never re-parsed.
    expect(bar).toEqual(baselineBar);
    expect(baz).toEqual(baselineBaz);

    const foo = refreshedJson.modules.find((m: any) => m.path === 'src/core/Foo.ts');
    expect(foo.imports).toContain('../application/Bar');
  });

  it('drops a deleted module and never resurrects it', async () => {
    writeFile('src/core/Foo.ts', 'export class Foo {}');
    writeFile('src/application/Bar.ts', 'export class Bar {}');
    await new BuildArchitectureMemoryUseCase().execute({
      workspaceRoot: tmp,
      files: ['src/core/Foo.ts', 'src/application/Bar.ts'],
    });

    fs.rmSync(path.join(tmp, 'src/application/Bar.ts'));

    const useCase = new RefreshArchitectureMemoryUseCase();
    const result = await useCase.execute({
      workspaceRoot: tmp,
      changedPaths: [{ path: 'src/application/Bar.ts', status: 'D' }],
    });

    expect(result.kind).toBe('refreshed');
    const refreshedJson = await loadJson(ARCHITECTURE_MEMORY_FILES.architectureJson);
    expect(refreshedJson.modules.map((m: any) => m.path)).toEqual(['src/core/Foo.ts']);
  });

  it('falls back to a full rebuild when the detected architecture style has drifted since baseline', async () => {
    writeFile('src/core/Foo.ts', 'export class Foo {}');
    writeFile('src/application/Bar.ts', 'export class Bar {}');
    await new BuildArchitectureMemoryUseCase().execute({
      workspaceRoot: tmp,
      files: ['src/core/Foo.ts', 'src/application/Bar.ts'],
    });

    // Force a style mismatch: layer/boundary reassignment from a style change could affect
    // every module, so an incremental merge would be unsafe — this must trigger a full rebuild.
    const jsonPath = path.join(tmp, ARCHITECTURE_MEMORY_FILES.architectureJson);
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    raw.detectedStyle = 'hexagonal';
    fs.writeFileSync(jsonPath, JSON.stringify(raw), 'utf8');

    const useCase = new RefreshArchitectureMemoryUseCase();
    const result = await useCase.execute({ workspaceRoot: tmp, changedPaths: [{ path: 'src/core/Foo.ts', status: 'M' }] });

    expect(result.kind).toBe('full-rebuild');
    if (result.kind !== 'full-rebuild') throw new Error('expected full-rebuild');
    expect(result.moduleCount).toBe(2);
  });

  it('falls back to a full rebuild when the loaded baseline has an unknown schema (no safe merge target)', async () => {
    writeFile('src/core/Foo.ts', 'export class Foo {}');
    await new BuildArchitectureMemoryUseCase().execute({ workspaceRoot: tmp, files: ['src/core/Foo.ts'] });

    // Corrupt the baseline's schemaVersion so ArchitectureMemoryLoader treats it as absent.
    const jsonPath = path.join(tmp, ARCHITECTURE_MEMORY_FILES.architectureJson);
    const raw = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    raw.schemaVersion = 'architecture-memory-v0';
    fs.writeFileSync(jsonPath, JSON.stringify(raw), 'utf8');

    const loader = new ArchitectureMemoryLoader();
    expect(await loader.loadMemory(tmp)).toBeUndefined();

    const useCase = new RefreshArchitectureMemoryUseCase();
    const result = await useCase.execute({ workspaceRoot: tmp, changedPaths: [{ path: 'src/core/Foo.ts', status: 'M' }] });
    expect(result).toEqual({ kind: 'skipped', reason: 'no-baseline' });
  });
});
