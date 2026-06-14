import { describe, it, expect } from 'vitest';
import { parsePromptSourceReferences } from '../PromptSourceReferenceParser';

describe('parsePromptSourceReferences', () => {
  it('parses @agent #skill /command and cleaned prompt is the remaining text', () => {
    const result = parsePromptSourceReferences('@agent-id #skill-id /command-id task text');
    expect(result.agentIds).toEqual(['agent-id']);
    expect(result.skillIds).toEqual(['skill-id']);
    expect(result.commandIds).toEqual(['command-id']);
    expect(result.cleanedPrompt).toBe('task text');
  });

  it('deduplicates repeated @agent tokens', () => {
    const result = parsePromptSourceReferences('@foo @foo do something');
    expect(result.agentIds).toEqual(['foo']);
    expect(result.cleanedPrompt).toBe('do something');
  });

  it('returns the full string as cleanedPrompt when no refs are present', () => {
    const result = parsePromptSourceReferences('just a plain prompt with no refs');
    expect(result.agentIds).toEqual([]);
    expect(result.skillIds).toEqual([]);
    expect(result.commandIds).toEqual([]);
    expect(result.cleanedPrompt).toBe('just a plain prompt with no refs');
  });

  it('does NOT parse user@example.com as an agent id', () => {
    const result = parsePromptSourceReferences('send to user@example.com the plan');
    expect(result.agentIds).toEqual([]);
    expect(result.cleanedPrompt).toBe('send to user@example.com the plan');
  });

  it('parses /help as a lone token into commandIds', () => {
    const result = parsePromptSourceReferences('/help');
    expect(result.commandIds).toEqual(['help']);
    expect(result.cleanedPrompt).toBe('');
  });
});
