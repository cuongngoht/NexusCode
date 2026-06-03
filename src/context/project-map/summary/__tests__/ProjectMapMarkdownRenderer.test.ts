import { describe, it, expect } from 'vitest';
import { ProjectMapMarkdownRenderer } from '../ProjectMapMarkdownRenderer';
import type { ProjectMapAiSummary } from '../types';

const renderer = new ProjectMapMarkdownRenderer();

const baseMap = '# Project Map\n\nSome content.';

const fullSummary: ProjectMapAiSummary = {
  summary: 'A well-structured monorepo.',
  risks: [
    { title: 'No tests', severity: 'high', evidence: ['src/'], recommendation: 'Add Vitest' },
  ],
  missingPieces: [
    { title: 'CI pipeline', evidence: ['.github/'], status: 'unknown' },
  ],
  nextSteps: [
    { title: 'Write tests', priority: 'high', reason: 'Zero coverage' },
  ],
};

describe('ProjectMapMarkdownRenderer', () => {
  it('output contains the AI-Assisted Project Summary header', () => {
    const result = renderer.render({ baseProjectMap: baseMap, aiSummary: fullSummary });
    expect(result).toContain('# AI-Assisted Project Summary');
  });

  it('renders risks with numbered sections and evidence', () => {
    const result = renderer.render({ baseProjectMap: baseMap, aiSummary: fullSummary });
    expect(result).toContain('### 1. No tests');
    expect(result).toContain('- Evidence: src/');
    expect(result).toContain('- Recommendation: Add Vitest');
  });

  it('renders fallback text for empty risks', () => {
    const emptySummary: ProjectMapAiSummary = { ...fullSummary, risks: [] };
    const result = renderer.render({ baseProjectMap: baseMap, aiSummary: emptySummary });
    expect(result).toContain('No risks identified from the provided evidence.');
  });
});
