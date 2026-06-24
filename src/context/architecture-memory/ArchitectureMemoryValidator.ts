import { ARCHITECTURE_MEMORY_SCHEMA_VERSION, type ArchitectureMemory } from './types';

const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export class ArchitectureMemoryValidator {
  constructor(private readonly maxAgeMs: number = DEFAULT_MAX_AGE_MS) {}

  validate(memory: ArchitectureMemory): { valid: boolean; reason?: string } {
    if (memory.schemaVersion !== ARCHITECTURE_MEMORY_SCHEMA_VERSION) {
      return { valid: false, reason: 'schema version mismatch' };
    }

    if (Date.now() - memory.generatedAt > this.maxAgeMs) {
      return { valid: false, reason: 'architecture memory is stale (older than 7 days)' };
    }

    if (memory.modules.length === 0) {
      return { valid: false, reason: 'no modules detected' };
    }

    return { valid: true };
  }
}
