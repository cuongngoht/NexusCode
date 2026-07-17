import { describe, it, expect } from 'vitest';
import { KnowledgeBaseIndexBuilder } from '../KnowledgeBaseIndexBuilder';
import { KNOWLEDGE_BASE_SCHEMA_VERSION, type KnowledgeBaseEntry } from '../../types';

function makeEntry(overrides: Partial<KnowledgeBaseEntry> = {}): KnowledgeBaseEntry {
  return {
    version: 1,
    schemaVersion: KNOWLEDGE_BASE_SCHEMA_VERSION,
    id: 'abc123',
    createdAt: Date.now(),
    workspaceRoot: '/workspace',
    mode: 'edit',
    providerId: 'nexus',
    originalPrompt: 'Fix the login authentication bug',
    status: 'completed',
    changedFiles: [{ path: 'src/auth/login.ts', status: 'M' }],
    source: 'task-pipeline',
    ...overrides,
  };
}

describe('KnowledgeBaseIndexBuilder', () => {
  it('returns an empty index for no entries', () => {
    const index = new KnowledgeBaseIndexBuilder().build([]);
    expect(index.documents).toEqual([]);
    expect(index.stats.totalDocs).toBe(0);
  });

  it('builds one tokenized document per entry', () => {
    const entries = [makeEntry(), makeEntry({ id: 'def456', originalPrompt: 'Add a new test suite' })];
    const index = new KnowledgeBaseIndexBuilder().build(entries);

    expect(index.documents.length).toBe(2);
    expect(index.documents[0].tokens).toContain('login');
    expect(index.documents[0].tokens).toContain('auth');
    expect(index.documents[1].tokens).toContain('test');
  });

  it('computes corpus stats (avgDocLength, docFreq, totalDocs)', () => {
    const entries = [makeEntry(), makeEntry({ id: 'def456' })];
    const index = new KnowledgeBaseIndexBuilder().build(entries);

    expect(index.stats.totalDocs).toBe(2);
    expect(index.stats.avgDocLength).toBeGreaterThan(0);
    expect(index.stats.docFreq['login']).toBe(2);
  });

  it('includes changed file paths, warnings, and next steps in the document text', () => {
    const entry = makeEntry({
      implementationSummary: 'Refactored the session store.',
      warnings: ['Tests required a retry.'],
      nextSteps: ['Run the project locally.'],
      changedFiles: [{ path: 'src/session/store.ts', status: 'M' }],
    });
    const index = new KnowledgeBaseIndexBuilder().build([entry]);

    expect(index.documents[0].tokens).toContain('session');
    expect(index.documents[0].tokens).toContain('store');
    expect(index.documents[0].tokens).toContain('retry');
    expect(index.documents[0].tokens).toContain('locally');
  });
});
