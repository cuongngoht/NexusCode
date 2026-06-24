export type {
  FileTouchEvent,
  FileIntelligenceProfile,
  FileIntelligenceIndex,
  FileIntelligenceIndexEntry,
  ReviewFinding,
  DebugFinding,
  ChangeHistoryEntry,
  TouchStats,
  DiffMetadata,
  FileFreshness,
  FileTouchReason,
  FileTouchSource,
  FindingSeverity,
} from './types';
export {
  FILE_INTELLIGENCE_DIR,
  FILE_INTELLIGENCE_INDEX_FILE,
  FILE_INTELLIGENCE_SCHEMA_VERSION,
} from './types';

export type { IFileIntelligenceStore } from './FileIntelligenceStore';
export { JsonFileIntelligenceStore } from './JsonFileIntelligenceStore';
export { FileIntelligenceService } from './FileIntelligenceService';
export { FileIntelligenceIgnoreFilter } from './FileIntelligenceIgnoreFilter';
export { FileIntelligenceUpdater } from './FileIntelligenceUpdater';
export { FileIntelligenceMergePolicy } from './FileIntelligenceMergePolicy';
export { FileIntelligenceConfidenceScorer } from './FileIntelligenceConfidenceScorer';
export { FileIntelligenceFreshnessPolicy } from './FileIntelligenceFreshnessPolicy';
export { FileTouchCollector } from './FileTouchCollector';
export { FileIntelligenceContextSelector } from './FileIntelligenceContextSelector';
export { FileIntelligenceContextBuilder } from './FileIntelligenceContextBuilder';
export { FileIntelligenceRagFacade } from './FileIntelligenceRagFacade';
export { ProjectMemoryService } from './ProjectMemoryService';
export type { ProjectMemoryStatus, ProjectMemoryContextPack } from './ProjectMemoryService';
