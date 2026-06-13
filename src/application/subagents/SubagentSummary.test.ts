import { describe, expect, it } from 'vitest';
import { SubagentSummary } from './SubagentSummary';

describe('SubagentSummary', () => {
  const summary = new SubagentSummary();

  describe('compact', () => {
    it('returns output unchanged when within maxChars', () => {
      const output = 'short output';
      expect(summary.compact(output, 100)).toBe('short output');
    });

    it('truncates output at maxChars and appends suffix', () => {
      const output = 'a'.repeat(200);
      const result = summary.compact(output, 100);
      expect(result.endsWith('\n[truncated]')).toBe(true);
      expect(result.length).toBeLessThanOrEqual(100);
    });

    it('handles output exactly at maxChars', () => {
      const output = 'a'.repeat(100);
      expect(summary.compact(output, 100)).toBe(output);
    });
  });

  describe('buildInjectionBlock', () => {
    it('returns empty string for empty results', () => {
      expect(summary.buildInjectionBlock([])).toBe('');
    });

    it('returns failed block when all results have errors', () => {
      const results = [
        { role: 'search', compactOutput: '', error: 'failed' },
        { role: 'planner', compactOutput: '', error: 'failed' },
      ];
      const block = summary.buildInjectionBlock(results);
      expect(block).toContain('Failed Optional Subagents');
      expect(block).toContain('search: failed');
      expect(block).toContain('planner: failed');
    });

    it('returns summary header when results have no content', () => {
      const results = [
        { role: 'search', compactOutput: '   ' },
      ];
      const block = summary.buildInjectionBlock(results);
      expect(block).toContain('# Subagent Intelligence Summary');
    });

    it('builds block with section headers for successful results', () => {
      const results = [
        { role: 'search', compactOutput: 'Found relevant APIs' },
        { role: 'planner', compactOutput: 'Step 1: do X\nStep 2: do Y' },
      ];
      const block = summary.buildInjectionBlock(results);
      expect(block).toContain('# Subagent Intelligence Summary');
      expect(block).toContain('### Search');
      expect(block).toContain('Found relevant APIs');
      expect(block).toContain('### Planner');
    });

    it('skips errored results and includes successful ones', () => {
      const results = [
        { role: 'search', compactOutput: 'results here' },
        { role: 'planner', compactOutput: '', error: 'failed' },
      ];
      const block = summary.buildInjectionBlock(results);
      expect(block).toContain('### Search');
      expect(block).toContain('results here');
      // planner error is reported in failed section, not as a successful role section
      expect(block).not.toContain('### Planner\n');
      expect(block).toContain('planner: failed');
    });

    it('respects maxChars option', () => {
      const results = [
        { role: 'search', compactOutput: 'a'.repeat(2000) },
      ];
      const block = summary.buildInjectionBlock(results, { maxChars: 500 });
      expect(block.length).toBeLessThanOrEqual(500);
      expect(block.endsWith('\n[truncated]')).toBe(true);
    });

    it('includes parsed findings when present', () => {
      const results = [
        {
          role: 'security' as const,
          agentId: 'claude',
          compactOutput: '',
          durationMs: 100,
          parsedOutput: {
            role: 'security',
            confidence: 0.9,
            findings: [{ severity: 'high' as const, title: 'SQL injection risk', recommendation: 'Use parameterized queries' }],
            files: ['src/db.ts'],
            nextActions: ['Fix query builder'],
          },
        },
      ];
      const block = summary.buildInjectionBlock(results);
      expect(block).toContain('SQL injection risk');
      expect(block).toContain('parameterized queries');
      expect(block).toContain('src/db.ts');
      expect(block).toContain('Fix query builder');
    });
  });
});
