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

    it('returns empty string when all results have errors', () => {
      const results = [
        { role: 'search', compactOutput: '', error: 'failed' },
        { role: 'planner', compactOutput: '', error: 'failed' },
      ];
      expect(summary.buildInjectionBlock(results)).toBe('');
    });

    it('returns empty string when all results have empty output', () => {
      const results = [
        { role: 'search', compactOutput: '   ' },
      ];
      expect(summary.buildInjectionBlock(results)).toBe('');
    });

    it('builds block with section headers for successful results', () => {
      const results = [
        { role: 'search', compactOutput: 'Found relevant APIs' },
        { role: 'planner', compactOutput: 'Step 1: do X\nStep 2: do Y' },
      ];
      const block = summary.buildInjectionBlock(results);
      expect(block).toContain('# Subagent Context');
      expect(block).toContain('## Search');
      expect(block).toContain('Found relevant APIs');
      expect(block).toContain('## Planner');
    });

    it('skips errored results and includes successful ones', () => {
      const results = [
        { role: 'search', compactOutput: 'results here' },
        { role: 'planner', compactOutput: '', error: 'failed' },
      ];
      const block = summary.buildInjectionBlock(results);
      expect(block).toContain('## Search');
      expect(block).not.toContain('## Planner');
    });
  });
});
