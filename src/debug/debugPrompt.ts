import type { DebugContext } from './DebugContext';

export function buildDebugPrompt(userPrompt: string, debugCtx: DebugContext): string {
  const lines: string[] = [];

  lines.push('# Nexus Debug Agent');
  lines.push('');
  lines.push('You are a senior debugging agent. Find the root cause of the reported failure and fix it safely.');
  lines.push('');

  lines.push('## User report');
  lines.push(userPrompt);
  lines.push('');

  if (debugCtx.signal.kind !== 'unknown') {
    lines.push('## Detected signal');
    lines.push(`Kind: ${debugCtx.signal.kind}`);
    if (debugCtx.signal.suspectedTools.length > 0) {
      lines.push(`Suspected tools: ${debugCtx.signal.suspectedTools.join(', ')}`);
    }
    if (debugCtx.signal.files.length > 0) {
      lines.push('Relevant files from error:');
      for (const f of debugCtx.signal.files) {
        const loc = f.line ? `:${f.line}${f.column ? `:${f.column}` : ''}` : '';
        lines.push(`  - ${f.path}${loc}`);
      }
    }
    lines.push('');
  }

  if (debugCtx.failingCommand) {
    lines.push('## Failing command');
    lines.push(`\`${debugCtx.failingCommand}\``);
    lines.push('');
  }

  if (debugCtx.selectedFiles.length > 0) {
    lines.push('## Selected files (debug scope)');
    for (const f of debugCtx.selectedFiles) {
      lines.push(`  - ${f}`);
    }
    lines.push('');
  }

  if (debugCtx.gitChangedFiles.length > 0) {
    lines.push('## Current git changes');
    for (const f of debugCtx.gitChangedFiles) {
      lines.push(`  - ${f}`);
    }
    lines.push('');
  }

  if (Object.keys(debugCtx.packageScripts).length > 0) {
    lines.push('## Available package scripts');
    for (const [name, cmd] of Object.entries(debugCtx.packageScripts)) {
      lines.push(`  - ${name}: ${cmd}`);
    }
    lines.push('');
  }

  lines.push('## Rules');
  lines.push('1. Reproduce the failure before editing when a failing command is available.');
  lines.push('2. Use the smallest safe fix — do not rewrite unrelated code.');
  lines.push('3. Preserve existing public APIs unless the bug requires a change.');

  if (debugCtx.noEdit) {
    lines.push('4. NO-EDIT MODE IS ENABLED. Do not modify files. Only inspect, explain root cause, and propose a patch.');
  } else {
    lines.push('4. Apply the fix directly to the affected files.');
  }

  if (debugCtx.addRegressionTest) {
    lines.push('5. Add or update a regression test that would have caught this bug.');
  }

  if (debugCtx.rerunAfterFix) {
    lines.push('6. Re-run the failing command after the fix and report results.');
  }

  if (debugCtx.asyncMode) {
    lines.push('');
    lines.push('## Concurrency checklist');
    lines.push('Check all of the following:');
    lines.push('- Stale closure or state');
    lines.push('- Missing await');
    lines.push('- Unhandled promise rejection');
    lines.push('- Cancellation not respected');
    lines.push('- Event listener leak');
    lines.push('- Double execution or re-entry');
    lines.push('- Shared mutable state');
    lines.push('- Race between UI state and backend event');
    lines.push('- Cleanup order');
    lines.push('- Retry/idempotency issue');
  }

  lines.push('');
  lines.push('## Output format');
  lines.push('');
  lines.push('### Root cause');
  lines.push('Explain the actual cause.');
  lines.push('');
  lines.push('### Files changed');
  lines.push('List changed files and why.');
  lines.push('');
  lines.push('### Fix');
  lines.push('Summarize the implementation.');
  lines.push('');
  lines.push('### Regression test');
  lines.push('Describe the test added, or explain why not added.');
  lines.push('');
  lines.push('### Verification');
  lines.push('List commands run and results.');
  lines.push('');
  lines.push('### Remaining risk');
  lines.push('Mention anything that still needs manual review.');

  return lines.join('\n');
}
