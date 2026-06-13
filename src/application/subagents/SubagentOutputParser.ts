import type { ParsedSubagentOutput, SubagentFinding, SubagentFindingSeverity } from './SubagentOutputSchema';

function clampConfidence(v: unknown): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter(x => typeof x === 'string');
}

function isSeverity(v: unknown): v is SubagentFindingSeverity {
  return v === 'high' || v === 'medium' || v === 'low' || v === 'info';
}

function parseFindings(raw: unknown): SubagentFinding[] {
  if (!Array.isArray(raw)) return [];
  const result: SubagentFinding[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const f = item as Record<string, unknown>;
    result.push({
      severity: isSeverity(f['severity']) ? f['severity'] : 'info',
      title: typeof f['title'] === 'string' ? f['title'] : '',
      evidence: toStringArray(f['evidence']),
      files: toStringArray(f['files']),
      recommendation: typeof f['recommendation'] === 'string' ? f['recommendation'] : undefined,
    });
  }
  return result;
}

export function parseSubagentOutput(role: string, output: string): ParsedSubagentOutput {
  try {
    const jsonStart = output.indexOf('{');
    if (jsonStart === -1) throw new Error('no json');
    const jsonEnd = output.lastIndexOf('}');
    if (jsonEnd === -1 || jsonEnd < jsonStart) throw new Error('no json end');
    const jsonStr = output.slice(jsonStart, jsonEnd + 1);
    const parsed = JSON.parse(jsonStr) as Record<string, unknown>;

    return {
      role: typeof parsed['role'] === 'string' ? parsed['role'] : role,
      confidence: clampConfidence(parsed['confidence']),
      findings: parseFindings(parsed['findings']),
      files: toStringArray(parsed['files']),
      nextActions: toStringArray(parsed['nextActions']),
      risks: toStringArray(parsed['risks']),
      rawMarkdown: output,
    };
  } catch {
    return {
      role,
      confidence: 0,
      findings: [],
      files: [],
      nextActions: [],
      rawMarkdown: output,
    };
  }
}
