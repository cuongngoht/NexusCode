import { describe, it, expect } from 'vitest';
import { ProjectMapSummaryPromptBuilder } from '../ProjectMapSummaryPromptBuilder';

const builder = new ProjectMapSummaryPromptBuilder();

const base = {
  baseProjectMap: '# Project Map\n\nSome content.',
  unitsJson: '[]',
  fileTree: 'src/\n  index.ts',
};

describe('ProjectMapSummaryPromptBuilder', () => {
  it('contains instruction to return only JSON', () => {
    const prompt = builder.build(base);
    expect(prompt).toContain('Return ONLY a valid JSON object');
  });

  it('does not instruct the AI to wrap output in markdown', () => {
    const prompt = builder.build(base);
    expect(prompt).not.toContain('```');
  });

  it('includes docsSnippets section when provided', () => {
    const prompt = builder.build({ ...base, docsSnippets: ['## Auth\n\nOAuth2 flow.'] });
    expect(prompt).toContain('--- DOCUMENTATION ---');
    expect(prompt).toContain('OAuth2 flow.');
  });
});
