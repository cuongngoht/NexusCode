import { describe, it, expect } from 'vitest';
import { KnowledgeBaseRagFacade } from '../KnowledgeBaseRagFacade';
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
    originalPrompt: 'Fix the login authentication bug in the session module',
    status: 'completed',
    changedFiles: [{ path: 'src/auth/login.ts', status: 'M' }],
    source: 'task-pipeline',
    ...overrides,
  };
}

describe('KnowledgeBaseRagFacade', () => {
  it('returns an empty string for an empty corpus', () => {
    const facade = new KnowledgeBaseRagFacade();
    expect(facade.build([], 'fix the login bug')).toBe('');
  });

  it('returns an empty string when the query has no meaningful tokens', () => {
    const facade = new KnowledgeBaseRagFacade();
    expect(facade.build([makeEntry()], '   ')).toBe('');
  });

  it('surfaces a matching entry in the formatted context', () => {
    const entries = [
      makeEntry({ originalPrompt: 'Fix the login authentication bug in the session module' }),
      makeEntry({ id: 'other', originalPrompt: 'Add a color palette to the dashboard chart' }),
    ];
    const facade = new KnowledgeBaseRagFacade();
    const context = facade.build(entries, 'login authentication session bug');

    expect(context).toContain('Project Knowledge Base');
    expect(context).toContain('login authentication bug');
    expect(context).not.toContain('color palette');
  });

  it('does not surface an unrelated entry for a non-matching query', () => {
    const entries = [makeEntry({ originalPrompt: 'Add a color palette to the dashboard chart' })];
    const facade = new KnowledgeBaseRagFacade();
    const context = facade.build(entries, 'completely unrelated database migration topic');
    expect(context).toBe('');
  });

  it('includes implementationSummary, changed files, and warnings when present', () => {
    const entry = makeEntry({
      implementationSummary: 'Refactored the session store to fix the login bug.',
      warnings: ['One test required a retry.'],
      changedFiles: [{ path: 'src/session/store.ts', status: 'M' }],
    });
    const facade = new KnowledgeBaseRagFacade();
    const context = facade.build([entry], 'login session store bug');

    expect(context).toContain('Summary: Refactored the session store');
    expect(context).toContain('Changed: src/session/store.ts');
    expect(context).toContain('Warnings: One test required a retry.');
  });
});
