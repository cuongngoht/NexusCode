import type { TaskMode } from '../../core/agent/AgentTask';
import type { GitFileChange } from '../../core/types';

export const KNOWLEDGE_BASE_SCHEMA_VERSION = 'knowledge-base-entry-v1';
export const KNOWLEDGE_BASE_DIR = '.nexus/knowledge-base';
export const KNOWLEDGE_BASE_ENTRIES_DIR = `${KNOWLEDGE_BASE_DIR}/entries`;

export type KnowledgeBaseEntryStatus = 'completed' | 'failed' | 'completed_with_warnings';
export type KnowledgeBaseEntrySource = 'agent-mode' | 'task-pipeline';

export interface KnowledgeBaseEntry {
  version: 1;
  schemaVersion: typeof KNOWLEDGE_BASE_SCHEMA_VERSION;
  id: string;
  createdAt: number;
  workspaceRoot: string;
  mode: TaskMode;
  providerId: string;
  model?: string;
  originalPrompt: string;
  skillIds?: string[];
  status: KnowledgeBaseEntryStatus;
  changedFiles: GitFileChange[];
  source: KnowledgeBaseEntrySource;
  // Agent Mode only — already computed for free by AgentFinalReporter, no extra LLM call.
  implementationSummary?: string;
  warnings?: string[];
  nextSteps?: string[];
}

export type NewKnowledgeBaseEntry = Omit<
  KnowledgeBaseEntry,
  'version' | 'schemaVersion' | 'id' | 'createdAt' | 'workspaceRoot'
>;

const MAX_PROMPT_CHARS = 4000;

export function truncatePrompt(prompt: string): string {
  return prompt.length > MAX_PROMPT_CHARS ? prompt.slice(0, MAX_PROMPT_CHARS) : prompt;
}
