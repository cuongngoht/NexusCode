import type { FileIntelligenceProfile, FileIntelligenceIndex } from './types';

export interface IFileIntelligenceStore {
  read(workspaceRoot: string, filePath: string): Promise<FileIntelligenceProfile | undefined>;
  write(workspaceRoot: string, profile: FileIntelligenceProfile): Promise<void>;
  readIndex(workspaceRoot: string): Promise<FileIntelligenceIndex | undefined>;
  writeIndex(workspaceRoot: string, index: FileIntelligenceIndex): Promise<void>;
  delete(workspaceRoot: string, filePath: string): Promise<void>;
  listAll(workspaceRoot: string): Promise<string[]>;
}
