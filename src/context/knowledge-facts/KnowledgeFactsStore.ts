import type { KnowledgeFact, KnowledgeFactsIndex, KnowledgeFactsIndexEntry } from './types';

export interface IKnowledgeFactsStore {
  read(workspaceRoot: string, canonicalKey: string): Promise<KnowledgeFact | undefined>;
  write(workspaceRoot: string, fact: KnowledgeFact): Promise<void>;
  delete(workspaceRoot: string, canonicalKey: string): Promise<void>;
  readIndex(workspaceRoot: string): Promise<KnowledgeFactsIndex | undefined>;
  writeIndex(workspaceRoot: string, index: KnowledgeFactsIndex): Promise<void>;
  listAll(workspaceRoot: string): Promise<KnowledgeFactsIndexEntry[]>;
}
