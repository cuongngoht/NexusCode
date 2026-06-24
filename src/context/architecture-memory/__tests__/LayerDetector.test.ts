import { describe, it, expect } from 'vitest';
import { LayerDetector, buildLayerDetectorFromConfig } from '../LayerDetector';
import type { ArchitectureLayer } from '../types';
import type { StyleDetectionResult } from '../ArchitectureStyleDetector';

function makeDetector(layerPaths: Partial<Record<ArchitectureLayer, string[]>>): LayerDetector {
  return new LayerDetector(layerPaths);
}

const SAMPLE_LAYER_PATHS: Partial<Record<ArchitectureLayer, string[]>> = {
  core: ['src/domain', 'src/core'],
  application: ['src/application'],
  infrastructure: ['src/infrastructure', 'src/repositories'],
  interface: ['src/controllers', 'src/routes'],
  support: ['src/shared', 'src/utils'],
};

describe('LayerDetector', () => {
  const detector = makeDetector(SAMPLE_LAYER_PATHS);

  it('detects core layer for domain path', () => {
    const result = detector.detect('src/domain/User.ts');
    expect(result.layer).toBe('core');
    expect(result.sourceEvidence[0]).toContain('src/domain');
  });

  it('detects core layer for core path', () => {
    expect(detector.detect('src/core/eventBus.ts').layer).toBe('core');
  });

  it('detects application layer', () => {
    expect(detector.detect('src/application/usecases/CreateUser.ts').layer).toBe('application');
  });

  it('detects infrastructure layer for infrastructure path', () => {
    expect(detector.detect('src/infrastructure/db/UserRepo.ts').layer).toBe('infrastructure');
  });

  it('detects infrastructure layer for repositories path', () => {
    expect(detector.detect('src/repositories/UserRepository.ts').layer).toBe('infrastructure');
  });

  it('detects interface layer for controllers path', () => {
    expect(detector.detect('src/controllers/UserController.ts').layer).toBe('interface');
  });

  it('detects interface layer for routes path', () => {
    expect(detector.detect('src/routes/users.ts').layer).toBe('interface');
  });

  it('detects support layer', () => {
    expect(detector.detect('src/utils/formatDate.ts').layer).toBe('support');
  });

  it('returns unknown for unrecognized path', () => {
    expect(detector.detect('random/path/Foo.ts').layer).toBe('unknown');
  });

  it('returns empty sourceEvidence for unknown path', () => {
    expect(detector.detect('random/path/Foo.ts').sourceEvidence).toHaveLength(0);
  });

  it('normalizes Windows backslash paths', () => {
    expect(detector.detect('src\\domain\\User.ts').layer).toBe('core');
  });

  it('matches exact path without trailing slash', () => {
    expect(detector.detect('src/domain').layer).toBe('core');
  });
});

describe('buildLayerDetectorFromConfig', () => {
  const baseDetected: StyleDetectionResult = {
    style: 'clean-architecture',
    layerPaths: { core: ['src/domain'], application: ['src/app'] },
    boundaries: [],
    confidence: 0.8,
  };

  it('uses detected paths when no config', () => {
    const d = buildLayerDetectorFromConfig(undefined, baseDetected);
    expect(d.detect('src/domain/Foo.ts').layer).toBe('core');
  });

  it('config layers override detected paths', () => {
    const d = buildLayerDetectorFromConfig(
      { layers: { core: ['packages/core'] } },
      baseDetected,
    );
    expect(d.detect('packages/core/Entity.ts').layer).toBe('core');
  });

  it('merges config and detected layers', () => {
    const d = buildLayerDetectorFromConfig(
      { layers: { interface: ['src/api'] } },
      baseDetected,
    );
    expect(d.detect('src/domain/Foo.ts').layer).toBe('core');
    expect(d.detect('src/api/UserController.ts').layer).toBe('interface');
  });
});
