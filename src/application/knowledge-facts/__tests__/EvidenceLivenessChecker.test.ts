import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { EvidenceLivenessChecker } from '../EvidenceLivenessChecker';
import type { KnowledgeEvidence } from '../../../context/knowledge-facts/types';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-evidence-liveness-test-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function baseEvidence(overrides: Partial<KnowledgeEvidence> = {}): KnowledgeEvidence {
  return {
    source: 'file',
    timestamp: Date.now(),
    excerpt: 'export class Foo {}',
    observedBy: 'deterministic',
    ...overrides,
  };
}

function hashOf(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

describe('EvidenceLivenessChecker', () => {
  it('is alive when there is no filePath (e.g. a decision fact)', () => {
    const checker = new EvidenceLivenessChecker();
    expect(checker.isAlive(tmp, baseEvidence({ filePath: undefined, contentHash: undefined }))).toBe(true);
  });

  it('is alive when the current content hash matches', () => {
    fs.writeFileSync(path.join(tmp, 'foo.ts'), 'export class Foo {}');
    const checker = new EvidenceLivenessChecker();
    const evidence = baseEvidence({ filePath: 'foo.ts', contentHash: hashOf('export class Foo {}') });
    expect(checker.isAlive(tmp, evidence)).toBe(true);
  });

  it('is not alive when the file content has changed', () => {
    fs.writeFileSync(path.join(tmp, 'foo.ts'), 'export class Foo { changed = true; }');
    const checker = new EvidenceLivenessChecker();
    const evidence = baseEvidence({ filePath: 'foo.ts', contentHash: hashOf('export class Foo {}') });
    expect(checker.isAlive(tmp, evidence)).toBe(false);
  });

  it('is not alive when the file has been deleted', () => {
    const checker = new EvidenceLivenessChecker();
    const evidence = baseEvidence({ filePath: 'does-not-exist.ts', contentHash: hashOf('anything') });
    expect(checker.isAlive(tmp, evidence)).toBe(false);
  });
});
