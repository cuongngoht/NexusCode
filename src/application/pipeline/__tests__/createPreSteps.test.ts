import { describe, it, expect } from 'vitest';
import { createPreSteps } from '../createPreSteps';

describe('createPreSteps', () => {
  it('runs ArchitectureMemoryStep, KnowledgeBaseStep, and KnowledgeFactsStep ahead of ReviewFileContextStep for review mode', () => {
    const steps = createPreSteps('review', { extensionPath: '/tmp/ext' });
    expect(steps.map(s => s.label)).toEqual(['architecture-memory', 'knowledge-base', 'knowledge-facts', 'review-files']);
  });

  it('does not include FileIntelligenceContextStep for review mode even when file-intelligence deps are provided', () => {
    const steps = createPreSteps('review', {
      extensionPath: '/tmp/ext',
      fileIntelligenceStore: {} as any,
      fileIntelligenceIgnoreFilter: {} as any,
    });
    expect(steps.map(s => s.label)).toEqual(['architecture-memory', 'knowledge-base', 'knowledge-facts', 'review-files']);
  });

  it('runs ArchitectureMemoryStep, KnowledgeBaseStep, and KnowledgeFactsStep for the default mode (e.g. edit)', () => {
    const steps = createPreSteps('edit', { extensionPath: '/tmp/ext' });
    expect(steps.map(s => s.label)).toEqual(['architecture-memory', 'knowledge-base', 'knowledge-facts']);
  });

  it('runs KnowledgeBaseStep and KnowledgeFactsStep but not ArchitectureMemoryStep for debug mode', () => {
    const steps = createPreSteps('debug', { extensionPath: '/tmp/ext' });
    expect(steps.map(s => s.label)).toEqual(['debug-prepare', 'knowledge-base', 'knowledge-facts']);
  });
});
