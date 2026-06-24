import { describe, it, expect } from 'vitest';
import { FileIntelligenceMergePolicy } from '../FileIntelligenceMergePolicy';
import type { FileTouchEvent, FileIntelligenceProfile } from '../types';

function makeEvent(overrides: Partial<FileTouchEvent> = {}): FileTouchEvent {
  return {
    filePath: 'src/foo.ts',
    workspaceRoot: '/workspace',
    mode: 'edit',
    reason: 'edit',
    source: 'edit',
    confidence: 0.7,
    timestamp: 1000,
    ...overrides,
  };
}

function makeProfile(overrides: Partial<FileIntelligenceProfile> = {}): FileIntelligenceProfile {
  return {
    filePath: 'src/foo.ts',
    confidence: 0.5,
    freshness: 'fresh',
    createdAt: 900,
    updatedAt: 900,
    ...overrides,
  };
}

describe('FileIntelligenceMergePolicy', () => {
  const policy = new FileIntelligenceMergePolicy();

  it('creates a new profile from scratch when existing is undefined', () => {
    const event = makeEvent({ filePath: 'src/new.ts' });
    const result = policy.apply(undefined, event, 0.7, 'fresh', 'hash123');
    expect(result.filePath).toBe('src/new.ts');
    expect(result.confidence).toBe(0.7);
    expect(result.freshness).toBe('fresh');
    expect(result.contentHash).toBe('hash123');
    expect(result.createdAt).toBeTypeOf('number');
  });

  it('merges into existing profile preserving createdAt', () => {
    const existing = makeProfile({ createdAt: 500 });
    const result = policy.apply(existing, makeEvent(), 0.8, 'fresh', undefined);
    expect(result.createdAt).toBe(500);
    expect(result.confidence).toBe(0.8);
  });

  it('deduplicates review findings by message+line', () => {
    const existing = makeProfile({
      reviewFindings: [{ severity: 'warning', message: 'null check', line: 10 }],
    });
    const event = makeEvent({
      reason: 'review',
      source: 'review',
      reviewFindings: [{ severity: 'error', message: 'null check', line: 10 }],
    });
    const result = policy.apply(existing, event, 0.8, 'fresh', undefined);
    expect(result.reviewFindings).toHaveLength(1);
    // error > warning
    expect(result.reviewFindings![0].severity).toBe('error');
  });

  it('adds distinct review findings', () => {
    const existing = makeProfile({
      reviewFindings: [{ severity: 'warning', message: 'issue A', line: 1 }],
    });
    const event = makeEvent({
      reason: 'review',
      source: 'review',
      reviewFindings: [{ severity: 'info', message: 'issue B', line: 2 }],
    });
    const result = policy.apply(existing, event, 0.8, 'fresh', undefined);
    expect(result.reviewFindings).toHaveLength(2);
  });

  it('upgrades debug finding from suspected to confirmed on same description', () => {
    const existing = makeProfile({
      debugFindings: [{ role: 'suspected', description: 'race condition in handler' }],
    });
    const event = makeEvent({
      reason: 'debug',
      source: 'debug',
      debugFindings: [{ role: 'confirmed', description: 'race condition in handler' }],
    });
    const result = policy.apply(existing, event, 0.9, 'fresh', undefined);
    expect(result.debugFindings).toHaveLength(1);
    expect(result.debugFindings![0].role).toBe('confirmed');
  });

  it('caps changeHistory at 20 entries', () => {
    const existing = makeProfile({
      changeHistory: Array.from({ length: 20 }, (_, i) => ({
        timestamp: i,
        reason: 'edit' as const,
      })),
    });
    const result = policy.apply(existing, makeEvent({ timestamp: 999 }), 0.7, 'fresh', undefined);
    expect(result.changeHistory).toHaveLength(20);
    // Newest entry is first
    expect(result.changeHistory![0].timestamp).toBe(999);
  });

  it('increments editCount in touchStats', () => {
    const result = policy.apply(undefined, makeEvent({ reason: 'edit' }), 0.7, 'fresh', undefined);
    expect(result.touchStats?.editCount).toBe(1);
    expect(result.touchStats?.reviewCount).toBe(0);
  });

  it('increments reviewCount in touchStats', () => {
    const result = policy.apply(
      undefined,
      makeEvent({ reason: 'review', source: 'review' }),
      0.8,
      'fresh',
      undefined,
    );
    expect(result.touchStats?.reviewCount).toBe(1);
    expect(result.touchStats?.editCount).toBe(0);
  });

  it('marks summary undefined on large stale diff', () => {
    const existing = makeProfile({
      freshness: 'fresh',
      summary: 'This is the existing summary',
    });
    const event = makeEvent({
      diffMetadata: { linesAdded: 50, linesRemoved: 30, hunks: 5, isMajorChange: true },
    });
    const result = policy.apply(existing, event, 0.7, 'stale', 'newhash');
    expect(result.summary).toBeUndefined();
  });

  it('preserves summary on small diff', () => {
    const existing = makeProfile({
      freshness: 'fresh',
      summary: 'Existing summary',
    });
    const event = makeEvent({
      diffMetadata: { linesAdded: 3, linesRemoved: 2, hunks: 1, isMajorChange: false },
    });
    const result = policy.apply(existing, event, 0.7, 'fresh', 'samehash');
    expect(result.summary).toBe('Existing summary');
  });
});
