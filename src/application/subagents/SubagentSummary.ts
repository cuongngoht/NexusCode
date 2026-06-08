import type { SubagentContextEntry } from '../../core/types';

const TRUNCATION_SUFFIX = '\n[truncated]';

export class SubagentSummary {
  compact(output: string, maxChars: number): string {
    if (output.length <= maxChars) return output;
    return output.slice(0, maxChars - TRUNCATION_SUFFIX.length) + TRUNCATION_SUFFIX;
  }

  buildInjectionBlock(results: ReadonlyArray<SubagentContextEntry>): string {
    const successful = results.filter(r => !r.error && r.compactOutput.trim());
    if (successful.length === 0) return '';

    const sections = successful.map(r => `## ${r.role.charAt(0).toUpperCase() + r.role.slice(1)}\n${r.compactOutput.trim()}`);
    return `# Subagent Context\n\n${sections.join('\n\n')}`;
  }
}
