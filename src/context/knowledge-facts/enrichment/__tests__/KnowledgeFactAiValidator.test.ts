import { describe, it, expect } from 'vitest';
import { KnowledgeFactAiValidator } from '../KnowledgeFactAiValidator';

describe('KnowledgeFactAiValidator', () => {
  it('validates a well-formed facts array', () => {
    const validator = new KnowledgeFactAiValidator();
    const result = validator.validate({
      facts: [{ kind: 'lesson', subject: 'Foo', statement: 'bar', confidence: 0.8, evidenceExcerpt: 'excerpt' }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('lesson');
  });

  it('throws when the outer shape is malformed', () => {
    const validator = new KnowledgeFactAiValidator();
    expect(() => validator.validate({ notFacts: [] })).toThrow();
  });

  it('drops an individual fact with a malformed kind rather than failing the whole batch', () => {
    const validator = new KnowledgeFactAiValidator();
    const result = validator.validate({
      facts: [
        { kind: 'not-a-real-kind', subject: 'Foo', statement: 'bar', confidence: 0.5, evidenceExcerpt: 'e' },
        { kind: 'lesson', subject: 'Baz', statement: 'qux', confidence: 0.5, evidenceExcerpt: 'e' },
      ],
    });
    expect(result).toHaveLength(1);
    expect(result[0].subject).toBe('Baz');
  });

  it('drops a fact with an empty subject or statement', () => {
    const validator = new KnowledgeFactAiValidator();
    const result = validator.validate({
      facts: [{ kind: 'lesson', subject: '', statement: 'bar', confidence: 0.5, evidenceExcerpt: 'e' }],
    });
    expect(result).toHaveLength(0);
  });

  it('clamps confidence to [0,1]', () => {
    const validator = new KnowledgeFactAiValidator();
    const result = validator.validate({
      facts: [
        { kind: 'lesson', subject: 'A', statement: 'a', confidence: 1.5, evidenceExcerpt: 'e' },
        { kind: 'lesson', subject: 'B', statement: 'b', confidence: -0.5, evidenceExcerpt: 'e' },
      ],
    });
    expect(result[0].confidence).toBe(1);
    expect(result[1].confidence).toBe(0);
  });

  it('truncates a long evidenceExcerpt to 300 chars', () => {
    const validator = new KnowledgeFactAiValidator();
    const longExcerpt = 'x'.repeat(500);
    const result = validator.validate({
      facts: [{ kind: 'lesson', subject: 'A', statement: 'a', confidence: 0.5, evidenceExcerpt: longExcerpt }],
    });
    expect(result[0].evidenceExcerpt).toHaveLength(300);
  });
});
