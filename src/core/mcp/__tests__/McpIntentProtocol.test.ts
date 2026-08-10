import { describe, it, expect } from 'vitest';
import {
  MCP_TOOL_GROUPS,
  NEXUS_TOOL_INTENT_TAG,
  appendRunInstructions,
} from '../McpIntentProtocol';

const countTags = (text: string) =>
  (text.match(new RegExp(`<${NEXUS_TOOL_INTENT_TAG}>`, 'g')) ?? []).length;

describe('appendRunInstructions', () => {
  it('omits the MCP instruction when mcpEnabled is false or absent', () => {
    expect(appendRunInstructions('PROMPT', {})).not.toContain(NEXUS_TOOL_INTENT_TAG);
    expect(appendRunInstructions('PROMPT', { mcpEnabled: false })).not.toContain(NEXUS_TOOL_INTENT_TAG);
  });

  it('appends the MCP instruction after the progress instruction when enabled', () => {
    const result = appendRunInstructions('PROMPT', { mcpEnabled: true });
    expect(result).toContain(NEXUS_TOOL_INTENT_TAG);
    const progressPos = result.indexOf('You are running inside Nexus AI Code');
    const mcpPos = result.indexOf(NEXUS_TOOL_INTENT_TAG);
    expect(progressPos).toBeGreaterThan(-1);
    expect(progressPos).toBeLessThan(mcpPos);
  });

  it('renders every valid group so the vocabulary cannot drift from the parser', () => {
    const result = appendRunInstructions('PROMPT', { mcpEnabled: true });
    for (const group of MCP_TOOL_GROUPS) {
      expect(result).toContain(group);
    }
  });

  // Idempotence is what lets several layers compose prompts from one another without
  // any of them having to know whether an upstream step already injected.
  it('is idempotent — applying twice yields exactly one instruction block', () => {
    const once = appendRunInstructions('PROMPT', { mcpEnabled: true });
    const twice = appendRunInstructions(once, { mcpEnabled: true });

    expect(countTags(once)).toBe(countTags(twice));
    expect(twice).toBe(once);
  });

  it('does not re-append the progress instruction to an already-augmented prompt', () => {
    const once = appendRunInstructions('PROMPT', { mcpEnabled: false });
    const twice = appendRunInstructions(once, { mcpEnabled: false });
    const occurrences = twice.split('You are running inside Nexus AI Code').length - 1;
    expect(occurrences).toBe(1);
  });

  describe("style: 'json-only'", () => {
    it('suppresses the progress narration, which would violate a JSON-only contract', () => {
      const result = appendRunInstructions('PROMPT', { mcpEnabled: true, style: 'json-only' });
      expect(result).not.toContain('You are running inside Nexus AI Code');
    });

    it('tells the agent to respond with ONLY the block, not alongside an answer', () => {
      const result = appendRunInstructions('PROMPT', { mcpEnabled: true, style: 'json-only' });
      expect(result).toContain(NEXUS_TOOL_INTENT_TAG);
      expect(result).toMatch(/ONLY the block below/i);
    });

    it('still emits nothing when MCP is disabled', () => {
      const result = appendRunInstructions('PROMPT', { mcpEnabled: false, style: 'json-only' });
      expect(result).toBe('PROMPT');
    });

    it('is idempotent across mixed styles', () => {
      const narrative = appendRunInstructions('PROMPT', { mcpEnabled: true, style: 'narrative' });
      const mixed = appendRunInstructions(narrative, { mcpEnabled: true, style: 'json-only' });
      expect(countTags(mixed)).toBe(countTags(narrative));
    });
  });

  it('preserves the original prompt verbatim at the start', () => {
    const prompt = '# Task\nDo the thing\n\n# Context\nStuff';
    expect(appendRunInstructions(prompt, { mcpEnabled: true }).startsWith(prompt)).toBe(true);
  });
});
