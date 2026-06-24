import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { FileIntelligenceFreshnessPolicy } from '../FileIntelligenceFreshnessPolicy';
import type { FileIntelligenceProfile } from '../types';

function makeProfile(overrides: Partial<FileIntelligenceProfile> = {}): FileIntelligenceProfile {
  return {
    filePath: 'src/foo.ts',
    confidence: 0.7,
    freshness: 'fresh',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
}

describe('FileIntelligenceFreshnessPolicy', () => {
  const policy = new FileIntelligenceFreshnessPolicy();
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fi-freshness-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('computeContentHash returns a hex string for existing file', () => {
    const filePath = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(filePath, 'export const foo = 1;');
    const hash = policy.computeContentHash(filePath);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('computeContentHash returns undefined for missing file', () => {
    expect(policy.computeContentHash(path.join(tmpDir, 'nonexistent.ts'))).toBeUndefined();
  });

  it('computeContentHash is deterministic', () => {
    const filePath = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(filePath, 'content');
    expect(policy.computeContentHash(filePath)).toBe(policy.computeContentHash(filePath));
  });

  it('checkFreshness returns archived for missing file', () => {
    const profile = makeProfile({ contentHash: 'abc123' });
    const result = policy.checkFreshness(profile, path.join(tmpDir, 'missing.ts'));
    expect(result).toBe('archived');
  });

  it('checkFreshness returns fresh when hash matches', () => {
    const filePath = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(filePath, 'export const x = 1;');
    const hash = policy.computeContentHash(filePath)!;
    const profile = makeProfile({ contentHash: hash });
    expect(policy.checkFreshness(profile, filePath)).toBe('fresh');
  });

  it('checkFreshness returns stale when hash differs', () => {
    const filePath = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(filePath, 'export const x = 1;');
    const profile = makeProfile({ contentHash: 'outdated-hash' });
    expect(policy.checkFreshness(profile, filePath)).toBe('stale');
  });

  it('checkFreshness returns fresh when profile has no contentHash', () => {
    const filePath = path.join(tmpDir, 'test.ts');
    fs.writeFileSync(filePath, 'content');
    const profile = makeProfile({ contentHash: undefined });
    expect(policy.checkFreshness(profile, filePath)).toBe('fresh');
  });

  it('isSmallDiff returns true when total lines < 20', () => {
    expect(policy.isSmallDiff({ linesAdded: 5, linesRemoved: 3, hunks: 1, isMajorChange: false })).toBe(true);
  });

  it('isSmallDiff returns false when total lines >= 20', () => {
    expect(policy.isSmallDiff({ linesAdded: 15, linesRemoved: 10, hunks: 2, isMajorChange: false })).toBe(false);
  });

  it('isSmallDiff returns true for undefined', () => {
    expect(policy.isSmallDiff(undefined)).toBe(true);
  });

  it('shouldUpdateSummary returns true for isMajorChange', () => {
    expect(policy.shouldUpdateSummary({ linesAdded: 2, linesRemoved: 2, hunks: 1, isMajorChange: true })).toBe(true);
  });

  it('shouldUpdateSummary returns true when total lines >= 20', () => {
    expect(policy.shouldUpdateSummary({ linesAdded: 10, linesRemoved: 15, hunks: 3, isMajorChange: false })).toBe(true);
  });

  it('shouldUpdateSummary returns false for small diff', () => {
    expect(policy.shouldUpdateSummary({ linesAdded: 3, linesRemoved: 2, hunks: 1, isMajorChange: false })).toBe(false);
  });
});
