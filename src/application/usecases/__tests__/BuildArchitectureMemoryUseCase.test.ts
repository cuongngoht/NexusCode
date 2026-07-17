import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { BuildArchitectureMemoryUseCase } from '../BuildArchitectureMemoryUseCase';
import { ARCHITECTURE_MEMORY_DIR } from '../../../context/architecture-memory';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-build-arch-mem-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeFile(relPath: string, content: string): void {
  const abs = path.join(tmp, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

describe('BuildArchitectureMemoryUseCase', () => {
  it('delegates eligibility filtering to isEligibleFile (skips test/spec/d.ts and node_modules paths)', async () => {
    writeFile('src/core/Foo.ts', 'export class Foo {}');
    writeFile('src/core/Foo.test.ts', 'describe("Foo", () => {});');
    writeFile('src/core/Foo.d.ts', 'export declare class Foo {}');
    writeFile('node_modules/dep/index.ts', 'export const x = 1;');

    const useCase = new BuildArchitectureMemoryUseCase();
    const output = await useCase.execute({
      workspaceRoot: tmp,
      files: [
        'src/core/Foo.ts',
        'src/core/Foo.test.ts',
        'src/core/Foo.d.ts',
        'node_modules/dep/index.ts',
      ],
    });

    const paths = output.memory.modules.map(m => m.path);
    expect(paths).toEqual(['src/core/Foo.ts']);
  });

  it('writes architecture memory files under .nexus/architecture-memory/', async () => {
    writeFile('src/core/Foo.ts', 'export class Foo {}');

    const useCase = new BuildArchitectureMemoryUseCase();
    await useCase.execute({ workspaceRoot: tmp, files: ['src/core/Foo.ts'] });

    const dir = path.join(tmp, ARCHITECTURE_MEMORY_DIR);
    expect(fs.existsSync(path.join(dir, 'architecture.json'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'architecture.md'))).toBe(true);
  });
});
