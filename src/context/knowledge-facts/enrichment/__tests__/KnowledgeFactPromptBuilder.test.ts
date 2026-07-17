import { describe, it, expect } from 'vitest';
import { KnowledgeFactPromptBuilder } from '../KnowledgeFactPromptBuilder';

describe('KnowledgeFactPromptBuilder', () => {
  it('instructs the AI to return only JSON, no markdown', () => {
    const prompt = new KnowledgeFactPromptBuilder().build({ triggerReason: 'debug-root-cause', contextForPrompt: 'ctx' });
    expect(prompt).toContain('Return ONLY a valid JSON object');
    expect(prompt).toContain('Do NOT wrap in markdown');
  });

  it('includes the trigger reason', () => {
    const prompt = new KnowledgeFactPromptBuilder().build({ triggerReason: 'significant-diff', contextForPrompt: 'ctx' });
    expect(prompt).toContain('significant-diff');
  });

  it('includes the provided context', () => {
    const prompt = new KnowledgeFactPromptBuilder().build({ triggerReason: 'test-failure', contextForPrompt: 'the diff shows X' });
    expect(prompt).toContain('the diff shows X');
  });

  it('documents the required facts[] JSON shape', () => {
    const prompt = new KnowledgeFactPromptBuilder().build({ triggerReason: 'review-finding', contextForPrompt: 'ctx' });
    expect(prompt).toContain('"facts"');
    expect(prompt).toContain('"kind"');
    expect(prompt).toContain('"evidenceExcerpt"');
  });
});
