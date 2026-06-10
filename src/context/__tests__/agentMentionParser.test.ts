import { describe, it, expect } from 'vitest';
import { parseAgentMentions } from '../agentMentionParser';

const KNOWN = ['software-architect', 'senior-developer', 'tester', 'product-owner', 'code-review'];

describe('parseAgentMentions', () => {
  it('parses a single mention', () => {
    const result = parseAgentMentions('@software-architect design this', KNOWN);
    expect(result.agentIds).toEqual(['software-architect']);
    expect(result.cleanedPrompt).toBe('design this');
  });

  it('parses multiple mentions', () => {
    const result = parseAgentMentions('@software-architect @tester design this', KNOWN);
    expect(result.agentIds).toEqual(['software-architect', 'tester']);
    expect(result.cleanedPrompt).toBe('design this');
  });

  it('deduplicates repeated mentions', () => {
    const result = parseAgentMentions('@tester @tester write tests', KNOWN);
    expect(result.agentIds).toEqual(['tester']);
  });

  it('ignores unknown mentions — they stay in cleaned prompt', () => {
    const result = parseAgentMentions('@tester @unknown-agent write tests', KNOWN);
    expect(result.agentIds).toEqual(['tester']);
    expect(result.cleanedPrompt).toContain('@unknown-agent');
  });

  it('does not parse email addresses', () => {
    const result = parseAgentMentions('email user@tester.com about it', KNOWN);
    expect(result.agentIds).toEqual([]);
    expect(result.cleanedPrompt).toBe('email user@tester.com about it');
  });

  it('returns empty ids and original prompt when no known mentions', () => {
    const result = parseAgentMentions('plain text no mentions', KNOWN);
    expect(result.agentIds).toEqual([]);
    expect(result.cleanedPrompt).toBe('plain text no mentions');
  });

  it('preserves order of first mention', () => {
    const result = parseAgentMentions('@tester @software-architect do this', KNOWN);
    expect(result.agentIds[0]).toBe('tester');
    expect(result.agentIds[1]).toBe('software-architect');
  });

  it('trims extra whitespace from cleaned prompt', () => {
    const result = parseAgentMentions('  @tester   review this  ', KNOWN);
    expect(result.cleanedPrompt).toBe('review this');
  });

  it('handles mention at end of prompt', () => {
    const result = parseAgentMentions('do this @tester', KNOWN);
    expect(result.agentIds).toEqual(['tester']);
    expect(result.cleanedPrompt).toBe('do this');
  });
});
