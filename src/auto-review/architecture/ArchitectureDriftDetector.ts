import {
  LayerDetector,
  ModuleDetector,
  PatternDetector,
  isEligibleFile,
  type DependencyViolation,
} from '../../context/architecture-memory';
import type { CodeReviewFinding } from '../../application/code-review/CodeReviewFinding';
import { CodeReviewArchitecturePolicy } from '../../application/code-review/CodeReviewArchitecturePolicy';
import { ArchitectureMemoryReader } from './ArchitectureMemoryReader';
import { ArchitectureRuleMatcher } from './ArchitectureRuleMatcher';

export interface ArchitectureDriftResult {
  /** false when no valid architecture memory baseline exists. */
  checked: boolean;
  newViolations: DependencyViolation[];
  findings: CodeReviewFinding[];
  riskBoost: { score: number; factors: string[] };
}

const RISK_PER_FORBIDDEN = 15;
const RISK_PER_DISCOURAGED = 5;
const RISK_BOOST_CAP = 30;

const CLEAN_RESULT: Omit<ArchitectureDriftResult, 'checked'> = {
  newViolations: [],
  findings: [],
  riskBoost: { score: 0, factors: [] },
};

/**
 * Deterministic architecture drift check: detects layer-boundary violations
 * introduced by the current change set relative to the persisted architecture
 * memory baseline (.nexus/architecture-memory/architecture.json). No LLM.
 *
 * Changed modules are re-detected from the working tree; for staged/branch
 * watch modes this is a slight approximation (working tree vs staged content),
 * acceptable for a drift heuristic.
 */
export class ArchitectureDriftDetector {
  private readonly architecturePolicy = new CodeReviewArchitecturePolicy();

  constructor(
    private readonly reader = new ArchitectureMemoryReader(),
    private readonly matcher = new ArchitectureRuleMatcher(),
  ) {}

  async detect(
    workspaceRoot: string,
    changedFiles: Array<{ path: string; status: string }>,
  ): Promise<ArchitectureDriftResult> {
    const snapshot = await this.reader.read(workspaceRoot);
    if (!snapshot) {
      return { checked: false, ...structuredClone(CLEAN_RESULT) };
    }

    // Deleted files stay in changedPaths so their baseline modules are
    // dropped, but they are not re-detected.
    const normalized = changedFiles.map(f => ({
      path: f.path.replace(/\\/g, '/'),
      status: f.status,
    }));
    const eligible = normalized.filter(f => isEligibleFile(f.path));
    if (eligible.length === 0) {
      return { checked: true, ...structuredClone(CLEAN_RESULT) };
    }
    const changedPaths = new Set(eligible.map(f => f.path));
    const toDetect = eligible.filter(f => f.status !== 'D').map(f => f.path);

    // Use the persisted layer mapping so drift is judged against the same
    // baseline the memory was built with.
    const moduleDetector = new ModuleDetector(
      new LayerDetector(snapshot.memory.layerPaths),
      new PatternDetector(),
    );
    const changedModules = await moduleDetector.detect(workspaceRoot, toDetect);

    const newViolations = this.matcher.match({
      baselineModules: snapshot.memory.modules,
      changedModules,
      changedPaths,
      boundaries: snapshot.boundaries,
      knownViolationIds: snapshot.knownViolationIds,
    });

    if (newViolations.length === 0) {
      return { checked: true, ...structuredClone(CLEAN_RESULT) };
    }

    const findings = newViolations.map(v => this.toFinding(v));

    const forbidden = newViolations.filter(v => v.severity === 'error').length;
    const discouraged = newViolations.length - forbidden;
    const score = Math.min(
      RISK_BOOST_CAP,
      forbidden * RISK_PER_FORBIDDEN + discouraged * RISK_PER_DISCOURAGED,
    );

    return {
      checked: true,
      newViolations,
      findings,
      riskBoost: {
        score,
        factors: [`Architecture drift: ${newViolations.length} new layer violation(s)`],
      },
    };
  }

  private toFinding(violation: DependencyViolation): CodeReviewFinding {
    const finding: CodeReviewFinding = {
      id: `arch-drift-${violation.id.replace(/[^a-zA-Z0-9_.\/-]/g, '_')}`,
      category: 'dependency-direction',
      severity: violation.severity === 'error' ? 'major' : 'minor',
      // Deterministic title so baseline fingerprinting stays stable across runs
      title: `New layer violation: ${violation.fromLayer} → ${violation.toLayer}`,
      description:
        `${violation.from} imports ${violation.to}, violating rule: ${violation.rule}. ` +
        'This dependency did not exist in the architecture baseline.',
      filePath: violation.from,
      evidence: violation.sourceEvidence.join('; '),
      recommendation:
        'Invert the dependency (define an interface in the lower layer) or move the code to the correct layer.',
      violatedPrinciple: violation.rule,
      confidence: 0.95,
      blocking: false,
    };
    finding.blocking = this.architecturePolicy.shouldBlockMerge(finding);
    return finding;
  }
}
