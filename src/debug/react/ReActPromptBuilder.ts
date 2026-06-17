import type { DebugChainContext } from '../orchestrator/DebugChainContext';

/**
 * Builds the investigation prompt for the ReAct loop.
 * This is a read-only analysis prompt — it must not instruct the agent to edit files.
 */
export function buildReActInvestigationPrompt(ctx: DebugChainContext): string {
  const lines: string[] = [];

  lines.push('# Debug Investigation');
  lines.push('');
  lines.push('You are performing a read-only investigation to find the root cause of the following failure.');
  lines.push('');
  lines.push('## CRITICAL CONSTRAINT');
  lines.push('DO NOT edit, patch, or modify any files during this investigation.');
  lines.push('DO NOT install packages.');
  lines.push('DO NOT run destructive commands (rm, git reset, git clean, etc.).');
  lines.push('Your ONLY goal is to gather evidence and reason about the root cause.');
  lines.push('');
  lines.push('## Failure Report');
  lines.push(ctx.originalPrompt);
  lines.push('');

  if (ctx.signal) {
    lines.push('## Parsed Signal');
    lines.push(`Kind: ${ctx.signal.kind}`);
    if (ctx.signal.suspectedTools.length > 0) {
      lines.push(`Suspected tools: ${ctx.signal.suspectedTools.join(', ')}`);
    }
    if (ctx.signal.files.length > 0) {
      lines.push('File references from error:');
      for (const ref of ctx.signal.files) {
        const loc = ref.line ? `:${ref.line}${ref.column ? `:${ref.column}` : ''}` : '';
        lines.push(`  - ${ref.path}${loc}`);
      }
    }
    lines.push('');
  }

  if (ctx.selectedFiles.length > 0) {
    lines.push('## Candidate Files (ranked by relevance)');
    for (const f of ctx.selectedFiles.slice(0, 20)) {
      lines.push(`  - ${f}`);
    }
    lines.push('');
  }

  lines.push('## Investigation Instructions');
  lines.push('');
  lines.push('Round 1: Read the primary error source files at the relevant line numbers.');
  lines.push('Round 2: Search for the exact error tokens, function names, import/export statements.');
  lines.push('Round 3: Inspect related configuration and test files.');
  lines.push('Round 4 (optional): Run a safe diagnostic command if allowed.');
  lines.push('');
  lines.push('After investigation, produce:');
  lines.push('- Root cause (specific, evidence-backed)');
  lines.push('- Confidence level (0.0–1.0)');
  lines.push('- Evidence list (bullet points)');
  lines.push('- Candidate files that need to change');

  return lines.join('\n');
}
