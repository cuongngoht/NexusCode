import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ArchitectureMemoryBuilder } from '../ArchitectureMemoryBuilder';
import { ArchitectureConfigLoader } from '../ArchitectureConfigLoader';
import { ArchitectureStyleDetector } from '../ArchitectureStyleDetector';
import { DependencyGraphBuilder } from '../DependencyGraphBuilder';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-arch-builder-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function writeFile(relPath: string, content: string): void {
  const abs = path.join(tmp, relPath);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content, 'utf8');
}

function makeBuilder(): ArchitectureMemoryBuilder {
  return new ArchitectureMemoryBuilder(new ArchitectureConfigLoader(), new ArchitectureStyleDetector(), new DependencyGraphBuilder());
}

describe('ArchitectureMemoryBuilder', () => {
  it('build() and assemble() produce identical output for the same module set', async () => {
    writeFile('src/core/Foo.ts', "import { Bar } from '../application/Bar';\nexport class Foo {}");
    writeFile('src/application/Bar.ts', 'export class Bar {}');

    const builder = makeBuilder();
    const files = ['src/core/Foo.ts', 'src/application/Bar.ts'];

    const viaBuild = await builder.build(tmp, files);

    const moduleDetector = new (await import('../ModuleDetector')).ModuleDetector(
      (await import('../LayerDetector')).buildLayerDetectorFromConfig(
        await new ArchitectureConfigLoader().load(tmp),
        await new ArchitectureStyleDetector().detect(tmp),
      ),
      new (await import('../PatternDetector')).PatternDetector(),
    );
    const modules = await moduleDetector.detect(tmp, files);
    const viaAssemble = await builder.assemble(tmp, modules);

    expect(viaAssemble.modules).toEqual(viaBuild.modules);
    expect(viaAssemble.graph.nodes).toEqual(viaBuild.graph.nodes);
    expect(viaAssemble.graph.edges).toEqual(viaBuild.graph.edges);
    expect(viaAssemble.violations).toEqual(viaBuild.violations);
    expect(viaAssemble.layerSummary).toEqual(viaBuild.layerSummary);
    expect(viaAssemble.detectedStyle).toEqual(viaBuild.detectedStyle);
    expect(viaAssemble.configSource).toEqual(viaBuild.configSource);
  });

  it('assemble() accepts a pre-resolved config/detected style to avoid re-reading disk', async () => {
    writeFile('src/core/Foo.ts', 'export class Foo {}');
    const builder = makeBuilder();
    const configLoader = new ArchitectureConfigLoader();
    const styleDetector = new ArchitectureStyleDetector();
    const config = await configLoader.load(tmp);
    const detected = await styleDetector.detect(tmp);

    const modules = await new (await import('../ModuleDetector')).ModuleDetector(
      (await import('../LayerDetector')).buildLayerDetectorFromConfig(config, detected),
      new (await import('../PatternDetector')).PatternDetector(),
    ).detect(tmp, ['src/core/Foo.ts']);

    const memory = await builder.assemble(tmp, modules, config, detected);
    expect(memory.modules).toHaveLength(1);
    expect(memory.detectedStyle).toBe(detected.style);
  });
});
