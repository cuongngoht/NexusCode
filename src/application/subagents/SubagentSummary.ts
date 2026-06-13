import type { SubagentContextEntry } from '../../core/types';
import type { SubagentResult } from './SubagentResultStore';
import type { SubagentFinding } from './SubagentOutputSchema';

const TRUNCATION_SUFFIX = '\n[truncated]';

export interface SubagentSynthesis {
  agreedFacts: string[];
  conflicts: string[];
  topFindings: SubagentFinding[];
  relevantFiles: string[];
  recommendedActions: string[];
  riskSummary: string[];
  confidence: number;
}

function isSubagentResult(r: SubagentContextEntry | SubagentResult): r is SubagentResult {
  return 'agentId' in r;
}

export class SubagentSummary {
  compact(output: string, maxChars: number): string {
    if (output.length <= maxChars) return output;
    return output.slice(0, maxChars - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
  }

  buildInjectionBlock(
    results: ReadonlyArray<SubagentContextEntry | SubagentResult>,
    options?: { maxChars?: number; includeRawFallback?: boolean },
  ): string {
    const maxChars = options?.maxChars ?? 8000;
    const successful = results.filter(r => !r.error);

    if (successful.length === 0) {
      const failed = results.filter(r => r.error);
      if (failed.length === 0) return '';
      const failedList = failed.map(r => `- ${r.role}: ${r.error}`).join('\n');
      return `# Subagent Context\n\n### Failed Optional Subagents\n${failedList}`;
    }

    const parts: string[] = ['# Subagent Intelligence Summary'];

    // Top findings from parsed output
    const allFindings: Array<{ role: string; finding: SubagentFinding }> = [];
    for (const r of successful) {
      const parsed = isSubagentResult(r) ? r.parsedOutput : undefined;
      if (parsed?.findings) {
        for (const f of parsed.findings) {
          allFindings.push({ role: r.role, finding: f });
        }
      }
    }

    if (allFindings.length > 0) {
      allFindings.sort((a, b) => {
        const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2, info: 3 };
        return (severityOrder[a.finding.severity] ?? 3) - (severityOrder[b.finding.severity] ?? 3);
      });
      const findingsText = allFindings.slice(0, 8)
        .map(({ role, finding }) =>
          `- [${role} · ${finding.severity}] ${finding.title}${finding.recommendation ? ': ' + finding.recommendation : ''}`)
        .join('\n');
      parts.push(`### Top Findings\n${findingsText}`);
    }

    // Relevant files
    const allFiles = new Set<string>();
    for (const r of successful) {
      const parsed = isSubagentResult(r) ? r.parsedOutput : undefined;
      if (parsed?.files) {
        for (const f of parsed.files) allFiles.add(f);
      }
    }
    if (allFiles.size > 0) {
      parts.push(`### Relevant Files\n${[...allFiles].slice(0, 20).map(f => `- ${f}`).join('\n')}`);
    }

    // Recommended actions
    const allActions = new Set<string>();
    for (const r of successful) {
      const parsed = isSubagentResult(r) ? r.parsedOutput : undefined;
      if (parsed?.nextActions) {
        for (const a of parsed.nextActions) allActions.add(a);
      }
    }
    if (allActions.size > 0) {
      const actions = [...allActions].slice(0, 8);
      parts.push(`### Recommended Actions\n${actions.map((a, i) => `${i + 1}. ${a}`).join('\n')}`);
    }

    // Risks
    const allRisks = new Set<string>();
    for (const r of successful) {
      const parsed = isSubagentResult(r) ? r.parsedOutput : undefined;
      if (parsed?.risks) {
        for (const risk of parsed.risks) allRisks.add(risk);
      }
    }
    if (allRisks.size > 0) {
      parts.push(`### Risks\n${[...allRisks].slice(0, 5).map(r => `- ${r}`).join('\n')}`);
    }

    // Fallback for roles without parsed output
    const withRaw = successful.filter(r => {
      const parsed = isSubagentResult(r) ? r.parsedOutput : undefined;
      const compactOutput = r.compactOutput ?? '';
      return !parsed && compactOutput.trim();
    });
    if (withRaw.length > 0 && options?.includeRawFallback !== false) {
      const rawSections = withRaw
        .map(r => `### ${r.role.charAt(0).toUpperCase() + r.role.slice(1)}\n${r.compactOutput.trim()}`)
        .join('\n\n');
      parts.push(rawSections);
    }

    // Failed optional subagents
    const failed = results.filter(r => r.error);
    if (failed.length > 0) {
      const failedList = failed.map(r => `- ${r.role}: ${r.error}`).join('\n');
      parts.push(`### Failed Optional Subagents\n${failedList}`);
    }

    const block = parts.join('\n\n');
    if (block.length <= maxChars) return block;
    return block.slice(0, maxChars - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
  }
}
