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

export {
  MODULE_USAGE_SCHEMA_VERSION,
  MODULE_USAGE_FILE,
  MAX_RECENT_SUMMARIES,
  MAX_WARNINGS,
  MAX_SEEN_TASK_IDS,
  isValidModuleUsageIndexShape,
  type ModuleUsageRecord,
  type ModuleUsageIndex,
  type ModuleUsageSummaryEntry,
  type ModuleUsageWarningEntry,
} from './moduleUsageTypes';
export { ModuleUsageProjector } from './ModuleUsageProjector';
export { ModuleUsageLoader } from './ModuleUsageLoader';

export { KnowledgeBaseIndexBuilder } from './search/KnowledgeBaseIndexBuilder';
export { KnowledgeBaseRagFacade, type KnowledgeBaseRagOptions } from './search/KnowledgeBaseRagFacade';
export type {
  KnowledgeBaseDocument,
  KnowledgeBaseCorpusStats,
  KnowledgeBaseSearchIndex,
  KnowledgeBaseSearchResult,
} from './search/KnowledgeBaseDocument';
