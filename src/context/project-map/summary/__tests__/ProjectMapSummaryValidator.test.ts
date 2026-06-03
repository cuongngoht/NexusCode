import { describe, it, expect } from 'vitest';
import { ProjectMapSummaryValidator } from '../ProjectMapSummaryValidator';

const validator = new ProjectMapSummaryValidator();

const validInput = {
  summary: 'A TypeScript monorepo.',
  risks: [
    { title: 'No tests', severity: 'high', evidence: ['src/'], recommendation: 'Add tests' },
  ],
  missingPieces: [
    { title: 'CI pipeline', evidence: ['.github/'], status: 'unknown' },
  ],
  nextSteps: [
    { title: 'Write tests', priority: 'high', reason: 'Zero coverage' },
  ],
};

describe('ProjectMapSummaryValidator', () => {
  it('accepts a valid input and returns typed result', () => {
    const result = validator.validate(validInput);
    expect(result.summary).toBe('A TypeScript monorepo.');
    expect(result.risks[0].severity).toBe('high');
  });

  it('throws for invalid severity enum', () => {
    const bad = { ...validInput, risks: [{ ...validInput.risks[0], severity: 'critical' }] };
    expect(() => validator.validate(bad)).toThrow();
  });

  it('throws for missing summary field', () => {
    const { summary: _s, ...noSummary } = validInput;
    expect(() => validator.validate(noSummary)).toThrow();
  });

  it('accepts extra unknown fields (zod strips them)', () => {
    const withExtra = { ...validInput, unknownField: 'ignored' };
    const result = validator.validate(withExtra);
    expect((result as Record<string, unknown>)['unknownField']).toBeUndefined();
  });

  it('accepts empty arrays for risks, missingPieces, nextSteps', () => {
    const empty = { summary: 'ok', risks: [], missingPieces: [], nextSteps: [] };
    expect(() => validator.validate(empty)).not.toThrow();
  });
});
