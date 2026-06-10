import { describe, it, expect } from 'vitest';
import { parseSkillMentions } from '../skillMentionParser';

const KNOWN = ['refactor', 'write-tests', 'security-review', 'api-design', 'bug-fix'];

describe('parseSkillMentions', () => {
  it('parses a single mention', () => {
    const result = parseSkillMentions('#refactor improve ChatController', KNOWN);
    expect(result.skillIds).toEqual(['refactor']);
    expect(result.cleanedPrompt).toBe('improve ChatController');
  });

  it('parses multiple mentions', () => {
    const result = parseSkillMentions('#refactor #write-tests improve ChatController', KNOWN);
    expect(result.skillIds).toEqual(['refactor', 'write-tests']);
    expect(result.cleanedPrompt).toBe('improve ChatController');
  });

  it('deduplicates repeated mentions', () => {
    const result = parseSkillMentions('#refactor #refactor improve code', KNOWN);
    expect(result.skillIds).toEqual(['refactor']);
  });

  it('ignores unknown hashtags — they stay in cleaned prompt', () => {
    const result = parseSkillMentions('#refactor #unknown-skill improve code', KNOWN);
    expect(result.skillIds).toEqual(['refactor']);
    expect(result.cleanedPrompt).toContain('#unknown-skill');
  });

  it('does not treat issue numbers like #123 as skills', () => {
    const result = parseSkillMentions('Fix issue #123 with #bug-fix', KNOWN);
    expect(result.skillIds).toEqual(['bug-fix']);
    expect(result.cleanedPrompt).toContain('#123');
  });

  it('returns empty ids and original prompt when no known mentions', () => {
    const result = parseSkillMentions('plain text no mentions', KNOWN);
    expect(result.skillIds).toEqual([]);
    expect(result.cleanedPrompt).toBe('plain text no mentions');
  });

  it('preserves order of first mention', () => {
    const result = parseSkillMentions('#write-tests #refactor do this', KNOWN);
    expect(result.skillIds[0]).toBe('write-tests');
    expect(result.skillIds[1]).toBe('refactor');
  });

  it('trims extra whitespace from cleaned prompt', () => {
    const result = parseSkillMentions('  #refactor   review this  ', KNOWN);
    expect(result.cleanedPrompt).toBe('review this');
  });

  it('handles mention at end of prompt', () => {
    const result = parseSkillMentions('do this #refactor', KNOWN);
    expect(result.skillIds).toEqual(['refactor']);
    expect(result.cleanedPrompt).toBe('do this');
  });
});
