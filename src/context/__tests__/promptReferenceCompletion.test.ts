import { describe, expect, it } from 'vitest';
import { filterPromptReferenceCandidates } from '../promptReferenceCompletion';

describe('filterPromptReferenceCandidates', () => {
  const candidates = [
    { id: 'code-reviewer', title: 'Code Reviewer', description: 'Five-axis review' },
    { id: 'code-review', title: 'Nexus AI Code Review Agent', description: 'Default review agent' },
    { id: 'product-owner', title: 'Product Owner Agent', description: 'Scope and acceptance criteria' },
    { id: 'web-performance-auditor', title: 'Web Performance Auditor', description: 'Core Web Vitals' },
  ];

  it('returns all candidates for an empty query sorted by id', () => {
    expect(filterPromptReferenceCandidates(candidates, '').map(c => c.id)).toEqual([
      'code-review',
      'code-reviewer',
      'product-owner',
      'web-performance-auditor',
    ]);
  });

  it('prioritizes id prefix matches before title matches', () => {
    expect(filterPromptReferenceCandidates(candidates, 'code').map(c => c.id).slice(0, 2)).toEqual([
      'code-review',
      'code-reviewer',
    ]);
  });

  it('matches title and description text', () => {
    expect(filterPromptReferenceCandidates(candidates, 'owner').map(c => c.id)).toEqual(['product-owner']);
    expect(filterPromptReferenceCandidates(candidates, 'vitals').map(c => c.id)).toEqual(['web-performance-auditor']);
  });
});
