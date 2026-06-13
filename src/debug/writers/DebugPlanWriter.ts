import type { DebugPlan } from '../orchestrator/DebugChainContext';

/**
 * Writes a DebugPlan as a structured markdown document.
 */
export function writeDebugPlanMarkdown(plan: DebugPlan): string {
  const lines: string[] = [];

  lines.push('# Debug Plan');
  lines.push('');

  lines.push('## Root Cause');
  lines.push(plan.rootCause || '_Not determined — confidence too low for a definitive root cause. See evidence for hints._');
  lines.push('');

  lines.push('## Confidence');
  const pct = Math.round(plan.confidence * 100);
  let confidenceLabel = 'Low';
  if (plan.confidence >= 0.7) confidenceLabel = 'High';
  else if (plan.confidence >= 0.45) confidenceLabel = 'Medium';
  lines.push(`${pct}% (${confidenceLabel})`);
  lines.push('');

  lines.push('## Evidence');
  if (plan.evidence.length > 0) {
    for (const e of plan.evidence) {
      lines.push(`- ${e}`);
    }
  } else {
    lines.push('_No specific evidence collected._');
  }
  lines.push('');

  lines.push('## Candidate Files');
  if (plan.candidateFiles.length > 0) {
    for (const f of plan.candidateFiles) {
      lines.push(`- ${f}`);
    }
  } else {
    lines.push('_No candidate files identified._');
  }
  lines.push('');

  lines.push('## Files Likely To Change');
  if (plan.filesLikelyToChange.length > 0) {
    for (const f of plan.filesLikelyToChange) {
      lines.push(`- ${f}`);
    }
  } else {
    lines.push('_Unknown — depends on root cause confirmation._');
  }
  lines.push('');

  lines.push('## Minimal Fix');
  lines.push(plan.minimalFix || '_Fix not determined yet. More investigation needed._');
  lines.push('');

  lines.push('## Regression Test');
  lines.push(plan.regressionTest || '_No regression test plan generated._');
  lines.push('');

  lines.push('## Verification Command');
  lines.push(plan.verificationCommand ? `\`${plan.verificationCommand}\`` : '_No verification command available._');
  lines.push('');

  lines.push('## Risk');
  lines.push(plan.risk);
  lines.push('');

  return lines.join('\n');
}

/**
 * Build a DebugPlan from available context (heuristic, no LLM).
 */
export function buildDebugPlan(params: {
  rootCause?: string;
  confidence: number;
  evidence: string[];
  selectedFiles: string[];
  verificationCommand?: string;
  noEdit: boolean;
  addRegressionTest: boolean;
}): DebugPlan {
  const { rootCause, confidence, evidence, selectedFiles, verificationCommand, noEdit, addRegressionTest } = params;

  // Assess risk based on confidence and file count
  let risk: DebugPlan['risk'] = 'medium';
  if (confidence >= 0.7 && selectedFiles.length <= 3) risk = 'low';
  if (confidence < 0.35 || selectedFiles.length > 8) risk = 'high';

  const minimalFix = noEdit
    ? 'NO-EDIT MODE: Inspection only. No files will be modified. Review evidence and root cause, then apply manually.'
    : rootCause
      ? `Apply the smallest fix to address the root cause: ${rootCause.slice(0, 200)}`
      : 'Root cause not yet confirmed. Additional investigation required before applying a fix.';

  const regressionTest = addRegressionTest
    ? 'Add or update a test that directly exercises the failure condition identified above.'
    : 'Regression test creation was not requested.';

  const plan: DebugPlan = {
    rootCause: rootCause ?? '',
    confidence,
    evidence,
    candidateFiles: selectedFiles,
    filesLikelyToChange: selectedFiles.slice(0, 5),
    minimalFix,
    regressionTest,
    verificationCommand,
    risk,
    rawMarkdown: '',
  };

  plan.rawMarkdown = writeDebugPlanMarkdown(plan);
  return plan;
}
