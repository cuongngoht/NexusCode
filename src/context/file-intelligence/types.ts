import type { TaskMode } from '../../core/agent/AgentTask';

export type FindingSeverity = 'error' | 'warning' | 'info';
export type FileFreshness = 'fresh' | 'stale' | 'archived';
export type FileTouchReason = 'edit' | 'review' | 'debug' | 'test' | 'context-read' | 'subagent' | 'scan';
export type FileTouchSource = 'edit' | 'review' | 'debug' | 'test' | 'chat' | 'plan' | 'scan' | 'subagent';

export interface ReviewFinding {
  severity: FindingSeverity;
  message: string;
  line?: number;
  category?: string;
}

export interface DebugFinding {
  role: 'suspected' | 'confirmed';
  description: string;
}

export interface ChangeHistoryEntry {
  timestamp: number;
  reason: FileTouchReason;
  linesAdded?: number;
  linesRemoved?: number;
  hunks?: number;
  isMajorChange?: boolean;
  sessionId?: string;
  taskId?: string;
}

export interface TouchStats {
  editCount: number;
  reviewCount: number;
  debugCount: number;
  testCount: number;
  lastTouchedBy: FileTouchReason;
  lastTouchedAt: number;
}

export interface FileIntelligenceProfile {
  filePath: string;
  language?: string;
  layer?: string;
  module?: string;
  summary?: string;
  responsibilities?: string[];
  publicSymbols?: string[];
  relatedFiles?: string[];
  testFiles?: string[];
  knownRisks?: string[];
  reviewFindings?: ReviewFinding[];
  debugFindings?: DebugFinding[];
  changeHistory?: ChangeHistoryEntry[];
  commonReasonsToChange?: string[];
  touchStats?: TouchStats;
  confidence: number;
  freshness: FileFreshness;
  contentHash?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DiffMetadata {
  linesAdded: number;
  linesRemoved: number;
  hunks: number;
  isMajorChange: boolean;
}

export interface FileTouchEvent {
  filePath: string;
  workspaceRoot: string;
  mode: TaskMode;
  reason: FileTouchReason;
  sessionId?: string;
  taskId?: string;
  userIntent?: string;
  diffMetadata?: DiffMetadata;
  reviewFindings?: ReviewFinding[];
  debugFindings?: DebugFinding[];
  testResult?: { command: string; passed: boolean; failureSummary?: string };
  contextReadMetadata?: { purpose: string; charCount: number };
  subagentObservations?: Array<{ role: string; observation: string }>;
  relatedFiles?: string[];
  source: FileTouchSource;
  confidence: number;
  timestamp: number;
}

export interface FileIntelligenceIndexEntry {
  filePath: string;
  freshness: FileFreshness;
  confidence: number;
  updatedAt: number;
}

export interface FileIntelligenceIndex {
  version: 1;
  updatedAt: number;
  profiles: FileIntelligenceIndexEntry[];
}

export const FILE_INTELLIGENCE_DIR = '.nexus/file-intelligence';
export const FILE_INTELLIGENCE_INDEX_FILE = `${FILE_INTELLIGENCE_DIR}/index.json`;
export const FILE_INTELLIGENCE_SCHEMA_VERSION = 'file-intelligence-v1';
