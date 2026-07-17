import { describe, it, expect } from 'vitest';
import { detectContradiction } from '../ContradictionDetector';
import type { KnowledgeFact } from '../types';

function makeFact(overrides: Partial<KnowledgeFact> = {}): KnowledgeFact {
  return {
    version: 1,
    schemaVersion: 'knowledge-fact-v1',
    id: 'fact-1',
    canonicalKey: 'abc',
    kind: 'test',
    subject: 'RunAgentUseCase',
    statement: 'the test suite passes',
    confidence: 0.9,
    status: 'verified',
    evidence: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    workspaceRoot: '/tmp/ws',
    ...overrides,
  };
}

describe('detectContradiction', () => {
  it('flags a pass/fail contradiction for the same test subject', () => {
    const existing = makeFact({ kind: 'test', subject: 'RunAgentUseCase', statement: 'the test suite passes' });
    expect(detectContradiction(existing, 'test', 'RunAgentUseCase', 'the test suite fails')).toBe(true);
  });

  it('does not flag two facts about different subjects', () => {
    const existing = makeFact({ kind: 'test', subject: 'RunAgentUseCase', statement: 'the test suite passes' });
    expect(detectContradiction(existing, 'test', 'OtherUseCase', 'the test suite fails')).toBe(false);
  });

  it('does not flag two facts of different kinds even with the same subject', () => {
    const existing = makeFact({ kind: 'test', subject: 'RunAgentUseCase', statement: 'the test suite passes' });
    expect(detectContradiction(existing, 'lesson', 'RunAgentUseCase', 'the test suite fails')).toBe(false);
  });

  it('does not flag an identical (normalized) statement as a contradiction', () => {
    const existing = makeFact({ kind: 'test', subject: 'RunAgentUseCase', statement: 'the test suite passes' });
    expect(detectContradiction(existing, 'test', 'RunAgentUseCase', 'THE TEST SUITE PASSES')).toBe(false);
  });

  it('does not flag two pass statements as contradicting', () => {
    const existing = makeFact({ kind: 'test', subject: 'RunAgentUseCase', statement: 'the test suite passes reliably' });
    expect(detectContradiction(existing, 'test', 'RunAgentUseCase', 'the test suite always passes now')).toBe(false);
  });

  it('flags any same-subject, different-statement contract fact as a potential signature change', () => {
    const existing = makeFact({ kind: 'contract', subject: 'IEventBus.emit', statement: 'emit takes one argument' });
    expect(detectContradiction(existing, 'contract', 'IEventBus.emit', 'emit takes two arguments')).toBe(true);
  });

  it('does not flag non-test/non-contract kinds', () => {
    const existing = makeFact({ kind: 'decision', subject: 'Auth', statement: 'we use JWT' });
    expect(detectContradiction(existing, 'decision', 'Auth', 'we use sessions')).toBe(false);
  });
});
