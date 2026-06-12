import { describe, it, expect } from 'vitest';
import { detectResearchMention } from '../researchProblemDetector';

describe('detectResearchMention', () => {
  it('returns found=false when @research is not in the prompt', () => {
    const result = detectResearchMention('Just a regular prompt');
    expect(result.found).toBe(false);
    expect(result.cleanedPrompt).toBe('Just a regular prompt');
  });

  it('does not match email addresses', () => {
    const result = detectResearchMention('Send to user@research.com');
    expect(result.found).toBe(false);
  });

  it('detects @research and classifies as new when text follows', () => {
    const result = detectResearchMention('@research Design folder agent portal');
    expect(result.found).toBe(true);
    expect(result.isNew).toBe(true);
    expect(result.problem).toBe('Design folder agent portal');
    expect(result.cleanedPrompt).toBe('Design folder agent portal');
  });

  it('detects @research tiếp tục as continue', () => {
    const result = detectResearchMention('@research tiếp tục');
    expect(result.found).toBe(true);
    expect(result.isNew).toBe(false);
    expect(result.cleanedPrompt).toBe('Continue with the current research step as defined above.');
  });

  it('detects @research continue as continue', () => {
    const result = detectResearchMention('@research continue');
    expect(result.found).toBe(true);
    expect(result.isNew).toBe(false);
  });

  it('detects bare @research as continue', () => {
    const result = detectResearchMention('@research');
    expect(result.found).toBe(true);
    expect(result.isNew).toBe(false);
  });

  it('removes only @research token and keeps remainder as problem', () => {
    const result = detectResearchMention('@research Design portal @software-architect');
    expect(result.found).toBe(true);
    expect(result.isNew).toBe(true);
    expect(result.problem).toBe('Design portal @software-architect');
    expect(result.cleanedPrompt).toBe('Design portal @software-architect');
  });

  it('handles @research in the middle of a prompt', () => {
    const result = detectResearchMention('Please @research how to implement OAuth');
    expect(result.found).toBe(true);
    expect(result.isNew).toBe(true);
    expect(result.problem).toContain('how to implement OAuth');
  });
});
