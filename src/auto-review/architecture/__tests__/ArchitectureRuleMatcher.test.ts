import { describe, it, expect } from 'vitest';
import { ArchitectureRuleMatcher } from '../ArchitectureRuleMatcher';
import type { ArchitectureModule, LayerBoundary } from '../../../context/architecture-memory';

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

const boundaries: LayerBoundary[] = [
  { from: 'core', to: 'infrastructure', kind: 'forbidden', description: 'core must not import from infrastructure' },
  { from: 'infrastructure', to: 'interface', kind: 'discouraged', description: 'infrastructure should not import from interface' },
];

const matcher = new ArchitectureRuleMatcher();

describe('ArchitectureRuleMatcher', () => {
  it('reports a new forbidden edge from a changed core file as an error violation', () => {
    const violations = matcher.match({
      baselineModules: [makeModule('src/runner/db.ts', 'infrastructure', [])],
      changedModules: [makeModule('src/core/task.ts', 'core', ['../runner/db'])],
      changedPaths: new Set(['src/core/task.ts']),
      boundaries,
      knownViolationIds: new Set(),
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]!.severity).toBe('error');
    expect(violations[0]!.from).toBe('src/core/task.ts');
    expect(violations[0]!.to).toBe('src/runner/db.ts');
  });

  it('does not re-report violations already present in the baseline', () => {
    const violations = matcher.match({
      baselineModules: [makeModule('src/runner/db.ts', 'infrastructure', [])],
      changedModules: [makeModule('src/core/task.ts', 'core', ['../runner/db'])],
      changedPaths: new Set(['src/core/task.ts']),
      boundaries,
      knownViolationIds: new Set(['src/core/task.ts->src/runner/db.ts']),
    });
    expect(violations).toHaveLength(0);
  });

  it('ignores violations originating from unchanged files', () => {
    const violations = matcher.match({
      baselineModules: [
        makeModule('src/core/legacy.ts', 'core', ['../runner/db']),
        makeModule('src/runner/db.ts', 'infrastructure', []),
      ],
      changedModules: [makeModule('src/core/other.ts', 'core', [])],
      changedPaths: new Set(['src/core/other.ts']),
      boundaries,
      knownViolationIds: new Set(),
    });
    expect(violations).toHaveLength(0);
  });

  it('replaces baseline modules for changed paths and drops deleted ones', () => {
    // Baseline says task.ts violates; the changed (fixed) version no longer imports db.
    // db.ts itself was deleted, so its baseline module must be dropped too.
    const violations = matcher.match({
      baselineModules: [
        makeModule('src/core/task.ts', 'core', ['../runner/db']),
        makeModule('src/runner/db.ts', 'infrastructure', []),
      ],
      changedModules: [makeModule('src/core/task.ts', 'core', [])],
      changedPaths: new Set(['src/core/task.ts', 'src/runner/db.ts']),
      boundaries,
      knownViolationIds: new Set(),
    });
    expect(violations).toHaveLength(0);
  });

  it('maps discouraged boundaries to warning severity', () => {
    const violations = matcher.match({
      baselineModules: [makeModule('src/webview/panel.ts', 'interface', [])],
      changedModules: [makeModule('src/runner/exec.ts', 'infrastructure', ['../webview/panel'])],
      changedPaths: new Set(['src/runner/exec.ts']),
      boundaries,
      knownViolationIds: new Set(),
    });
    expect(violations).toHaveLength(1);
    expect(violations[0]!.severity).toBe('warning');
  });

  it('does not mutate the baseline snapshot modules', () => {
    const baseline = makeModule('src/runner/db.ts', 'infrastructure', ['../webview/panel']);
    matcher.match({
      baselineModules: [baseline, makeModule('src/webview/panel.ts', 'interface', [])],
      changedModules: [makeModule('src/core/x.ts', 'core', [])],
      changedPaths: new Set(['src/core/x.ts']),
      boundaries,
      knownViolationIds: new Set(),
    });
    expect(baseline.resolvedImportPaths).toHaveLength(0);
  });
});
