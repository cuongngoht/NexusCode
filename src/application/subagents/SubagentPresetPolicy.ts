import type { SubagentMode, SubagentPreset, SubagentRoleId } from '../../config/NexusConfig';

export interface ResolvedSubagentPolicy {
  mode: SubagentMode;
  preset: SubagentPreset;
  maxRuns: number;
  maxParallel: number;
  hardCap: number;
  includeSecurity: boolean;
  includeDocs: boolean;
  includeReviewer: boolean;
  includeTester: boolean;
  failOpen: boolean;
  injectMaxChars: number;
  timeoutMs: number;
  selectedRoles: SubagentRoleId[];
}

export const SUBAGENT_ROLE_IDS: readonly SubagentRoleId[] = [
  'search', 'planner', 'coder', 'debugger', 'tester',
  'reviewer', 'security', 'docs', 'product', 'research',
] as const;

export const SUBAGENT_PRESET_DEFAULTS: Record<SubagentPreset, {
  maxRuns: number;
  maxParallel: number;
  includeSecurity: boolean;
  includeDocs: boolean;
  includeReviewer: boolean;
  includeTester: boolean;
}> = {
  fast:     { maxRuns: 2, maxParallel: 2, includeSecurity: false, includeDocs: false, includeReviewer: false, includeTester: false },
  balanced: { maxRuns: 4, maxParallel: 2, includeSecurity: false, includeDocs: false, includeReviewer: true,  includeTester: true  },
  full:     { maxRuns: 5, maxParallel: 2, includeSecurity: false, includeDocs: true,  includeReviewer: true,  includeTester: true  },
  safe:     { maxRuns: 6, maxParallel: 2, includeSecurity: true,  includeDocs: true,  includeReviewer: true,  includeTester: true  },
};

export function clampHardCap(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 6;
  return Math.max(1, Math.min(Math.floor(value), 8));
}

export function clampSubagentCount(value: number | undefined, hardCap: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return Math.min(4, hardCap);
  return Math.max(0, Math.min(Math.floor(value), hardCap));
}

export function clampMaxParallel(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 2;
  return Math.max(1, Math.min(Math.floor(value), 4));
}

export function normalizeSelectedRoles(roles: readonly string[] | undefined): SubagentRoleId[] {
  const allowed = new Set<string>(SUBAGENT_ROLE_IDS);
  const result: SubagentRoleId[] = [];
  for (const role of roles ?? []) {
    if (allowed.has(role) && !result.includes(role as SubagentRoleId)) {
      result.push(role as SubagentRoleId);
    }
  }
  return result;
}
