export {
  KNOWLEDGE_BASE_SCHEMA_VERSION,
  KNOWLEDGE_BASE_DIR,
  KNOWLEDGE_BASE_ENTRIES_DIR,
  truncatePrompt,
  type KnowledgeBaseEntryStatus,
  type KnowledgeBaseEntrySource,
  type KnowledgeBaseEntry,
  type NewKnowledgeBaseEntry,
} from './types';

export { KnowledgeBaseWriter } from './KnowledgeBaseWriter';
export { KnowledgeBaseLoader } from './KnowledgeBaseLoader';

export { KnowledgeBaseIndexBuilder } from './search/KnowledgeBaseIndexBuilder';
export { KnowledgeBaseRagFacade, type KnowledgeBaseRagOptions } from './search/KnowledgeBaseRagFacade';
export type {
  KnowledgeBaseDocument,
  KnowledgeBaseCorpusStats,
  KnowledgeBaseSearchIndex,
  KnowledgeBaseSearchResult,
} from './search/KnowledgeBaseDocument';
