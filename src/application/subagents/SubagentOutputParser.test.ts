import { describe, expect, it } from 'vitest';
import { parseSubagentOutput } from './SubagentOutputParser';

describe('parseSubagentOutput', () => {
  it('parses valid JSON from output', () => {
    const output = JSON.stringify({
      role: 'debugger',
      confidence: 0.85,
      findings: [{ severity: 'high', title: 'null deref', evidence: ['line 42'], files: ['src/foo.ts'], recommendation: 'add null check' }],
      files: ['src/foo.ts'],
      nextActions: ['check line 42'],
      risks: ['crash on empty input'],
    });
    const result = parseSubagentOutput('debugger', output);
    expect(result.role).toBe('debugger');
    expect(result.confidence).toBe(0.85);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].severity).toBe('high');
    expect(result.files).toEqual(['src/foo.ts']);
    expect(result.nextActions).toEqual(['check line 42']);
    expect(result.risks).toEqual(['crash on empty input']);
  });

  it('falls back on invalid JSON', () => {
    const result = parseSubagentOutput('search', 'not json at all');
    expect(result.role).toBe('search');
    expect(result.confidence).toBe(0);
    expect(result.findings).toEqual([]);
    expect(result.rawMarkdown).toBe('not json at all');
  });

  it('does not throw on empty string', () => {
    expect(() => parseSubagentOutput('tester', '')).not.toThrow();
  });

  it('clamps confidence to 0..1', () => {
    const output = JSON.stringify({ role: 'reviewer', confidence: 1.5, findings: [], files: [], nextActions: [] });
    const result = parseSubagentOutput('reviewer', output);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('clamps negative confidence to 0', () => {
    const output = JSON.stringify({ role: 'reviewer', confidence: -0.5, findings: [], files: [], nextActions: [] });
    const result = parseSubagentOutput('reviewer', output);
    expect(result.confidence).toBe(0);
  });

  it('normalizes unknown severity to info', () => {
    const output = JSON.stringify({
      role: 'security',
      confidence: 0.7,
      findings: [{ severity: 'critical', title: 'vuln' }],
      files: [],
      nextActions: [],
    });
    const result = parseSubagentOutput('security', output);
    expect(result.findings[0].severity).toBe('info');
  });

  it('handles JSON embedded in markdown', () => {
    const output = `Here is my analysis:\n\n{"role":"search","confidence":0.9,"findings":[],"files":["a.ts"],"nextActions":["check a"]}\n\nMore notes here`;
    const result = parseSubagentOutput('search', output);
    expect(result.confidence).toBe(0.9);
    expect(result.files).toEqual(['a.ts']);
  });
});
