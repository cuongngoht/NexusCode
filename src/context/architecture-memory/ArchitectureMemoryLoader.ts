import * as fs from 'fs/promises';
import * as path from 'path';
import {
  ARCHITECTURE_MEMORY_FILES,
  ARCHITECTURE_MEMORY_SCHEMA_VERSION,
  type ArchitectureMemory,
  type DependencyViolation,
} from './types';

export class ArchitectureMemoryLoader {
  async loadMemory(workspaceRoot: string): Promise<ArchitectureMemory | undefined> {
    const filePath = path.join(workspaceRoot, ARCHITECTURE_MEMORY_FILES.architectureJson);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed: unknown = JSON.parse(content);
      if (!isValidMemoryShape(parsed)) return undefined;
      return parsed;
    } catch {
      return undefined;
    }
  }

  async loadViolations(workspaceRoot: string): Promise<DependencyViolation[] | undefined> {
    const filePath = path.join(workspaceRoot, ARCHITECTURE_MEMORY_FILES.violations);
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const parsed: unknown = JSON.parse(content);
      if (!Array.isArray(parsed)) return undefined;
      return parsed as DependencyViolation[];
    } catch {
      return undefined;
    }
  }
}

function isValidMemoryShape(value: unknown): value is ArchitectureMemory {
  if (!value || typeof value !== 'object') return false;
  const m = value as Record<string, unknown>;
  return (
    m['version'] === 1 &&
    typeof m['schemaVersion'] === 'string' &&
    m['schemaVersion'] === ARCHITECTURE_MEMORY_SCHEMA_VERSION &&
    Array.isArray(m['modules']) &&
    Array.isArray(m['violations']) &&
    typeof m['workspaceRoot'] === 'string' &&
    typeof m['generatedAt'] === 'number'
  );
}
