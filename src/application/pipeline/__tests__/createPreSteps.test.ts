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

  it('runs ProjectUnderstandingStep, ArchitectureMemoryStep, KnowledgeBaseStep, and KnowledgeFactsStep for the default mode (e.g. edit)', () => {
    const steps = createPreSteps('edit', { extensionPath: '/tmp/ext' });
    expect(steps.map(s => s.label)).toEqual([
      'project-understanding',
      'architecture-memory',
      'knowledge-base',
      'knowledge-facts',
    ]);
  });

  it('runs KnowledgeBaseStep and KnowledgeFactsStep but not ArchitectureMemoryStep for debug mode', () => {
    const steps = createPreSteps('debug', { extensionPath: '/tmp/ext' });
    expect(steps.map(s => s.label)).toEqual([
      'debug-prepare',
      'project-understanding',
      'knowledge-base',
      'knowledge-facts',
    ]);
  });

  // The saved map is only worth writing if later tasks consume it, so this
  // guards the injection point rather than the mode that produces it.
  it('injects ProjectUnderstandingStep into every pipeline mode that builds a prompt', () => {
    for (const mode of ['ask', 'edit', 'plan', 'test', 'research', 'debug', 'agent', 'understand'] as const) {
      const labels = createPreSteps(mode, { extensionPath: '/tmp/ext' }).map(s => s.label);
      expect(labels, `mode ${mode} should load the saved project understanding`).toContain(
        'project-understanding',
      );
    }
  });

  it('scans before loading understanding in understand mode, so the map is revised against fresh structure', () => {
    const labels = createPreSteps('understand', { extensionPath: '/tmp/ext' }).map(s => s.label);
    expect(labels).toEqual(['scan', 'architecture-memory', 'project-understanding']);
    expect(labels.indexOf('scan')).toBeLessThan(labels.indexOf('project-understanding'));
  });
});
