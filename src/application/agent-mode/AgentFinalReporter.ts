import type { AgentSession } from './AgentSession';
import type { AgentTestResult } from './AgentTestRunner';
import type { AgentRecoveryResult } from './AgentRecovery';
import type { AgentReviewResult } from './AgentReviewRunner';
import type { AgentChangedFile, AgentDiffSummary } from './AgentDiffCollector';

export interface AgentFinalSummary {
  sessionId: string;
  status: 'completed' | 'failed' | 'completed_with_warnings';
  userTask: string;
  implementationSummary: string;
  changedFiles: AgentChangedFile[];
  testResult?: AgentTestResult;
  recoveryResult?: AgentRecoveryResult;
  reviewResult?: AgentReviewResult;
  diffSummary?: AgentDiffSummary;
  warnings: string[];
  nextSteps: string[];
}

export interface FinalReporterParts {
  testResult?: AgentTestResult;
  recoveryResult?: AgentRecoveryResult;
  reviewResult?: AgentReviewResult;
  diffSummary?: AgentDiffSummary;
}

export class AgentFinalReporter {
  async build(session: AgentSession, parts: FinalReporterParts): Promise<AgentFinalSummary> {
    const warnings: string[] = [];
    const nextSteps: string[] = [];

    // Determine overall status
    let status: AgentFinalSummary['status'] = 'completed';

    if (session.status === 'failed' || session.error) {
      status = 'failed';
    }

    if (parts.testResult && !parts.testResult.passed) {
      if (parts.recoveryResult?.recovered === false) {
        status = 'failed';
        warnings.push('Tests failed and could not be recovered automatically.');
        nextSteps.push('Review the failing tests and fix them manually.');
      } else if (parts.recoveryResult?.recovered) {
        warnings.push(`Tests required ${parts.recoveryResult.attempts} recovery attempt(s).`);
      }
    }

    if (parts.reviewResult && !parts.reviewResult.passed) {
      const errorFindings = parts.reviewResult.findings.filter(f => f.severity === 'error');
      if (errorFindings.length > 0) {
        if (status !== 'failed') status = 'completed_with_warnings';
        warnings.push(`Code review found ${errorFindings.length} error(s).`);
        nextSteps.push('Address the code review errors before merging.');
      }

      const warnFindings = parts.reviewResult.findings.filter(f => f.severity === 'warning');
      if (warnFindings.length > 0) {
        warnings.push(`Code review found ${warnFindings.length} warning(s).`);
      }
    }

    const changedFiles = parts.diffSummary?.changedFiles ?? [];

    const implementationSummary = buildImplementationSummary(session, parts, changedFiles);

    if (changedFiles.length > 0) {
      nextSteps.push('Run the project locally to verify the changes work as expected.');
    }

    if (session.plan?.docsImpact && session.plan.docsImpact.length > 0) {
      nextSteps.push('Consider updating documentation as noted in the plan.');
    }

    return {
      sessionId: session.id,
      status,
      userTask: session.originalPrompt,
      implementationSummary,
      changedFiles,
      testResult: parts.testResult,
      recoveryResult: parts.recoveryResult,
      reviewResult: parts.reviewResult,
      diffSummary: parts.diffSummary,
      warnings,
      nextSteps,
    };
  }
}

function buildImplementationSummary(
  session: AgentSession,
  parts: FinalReporterParts,
  changedFiles: AgentChangedFile[],
): string {
  const lines: string[] = [];

  if (session.plan?.summary) {
    lines.push(session.plan.summary);
  }

  if (changedFiles.length > 0) {
    const added = changedFiles.filter(f => f.status === 'added').length;
    const modified = changedFiles.filter(f => f.status === 'modified').length;
    const deleted = changedFiles.filter(f => f.status === 'deleted').length;
    const parts2: string[] = [];
    if (added > 0) parts2.push(`${added} file(s) created`);
    if (modified > 0) parts2.push(`${modified} file(s) modified`);
    if (deleted > 0) parts2.push(`${deleted} file(s) deleted`);
    lines.push(parts2.join(', ') + '.');
  }

  if (parts.diffSummary && (parts.diffSummary.addedLines > 0 || parts.diffSummary.deletedLines > 0)) {
    lines.push(`${parts.diffSummary.addedLines} lines added, ${parts.diffSummary.deletedLines} lines deleted.`);
  }

  if (parts.testResult) {
    if (parts.testResult.passed) {
      lines.push('All tests passed.');
    } else if (parts.recoveryResult?.recovered) {
      lines.push(`Tests failed initially but recovered after ${parts.recoveryResult.attempts} attempt(s).`);
    } else {
      lines.push('Tests failed.');
    }
  }

  return lines.join(' ') || 'Implementation completed.';
}
