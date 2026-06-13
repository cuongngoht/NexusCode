import type { TaskMode } from '../../core/types';
import type { SubagentMode, SubagentPreset } from '../../config/NexusConfig';
import type { SubagentDefinition } from './SubagentDefinition';
import type { SubagentRole } from './SubagentResultStore';
import type { SubagentRegistry } from './SubagentRegistry';
import type { SubagentIntent } from './SubagentIntentClassifier';
import {
  clampHardCap,
  clampSubagentCount,
  SUBAGENT_PRESET_DEFAULTS,
} from './SubagentPresetPolicy';

export interface SubagentPlanConfig {
  mode: TaskMode;
  subagentMode?: SubagentMode;
  preset?: SubagentPreset;
  maxRuns: number;
  maxParallel?: number;
  hardCap?: number;
  includeSecurity: boolean;
  includeDocs: boolean;
  includeReviewer?: boolean;
  includeTester?: boolean;
  selectedRoles?: string[];
  intent?: SubagentIntent;
}

// Role lists for each mode × preset combination
// Returns ordered list of roles (will be filtered through registry)
function getRoleListForMode(mode: TaskMode, preset: SubagentPreset): SubagentRole[] {
  switch (mode) {
    case 'debug':
      switch (preset) {
        case 'fast':    return ['search', 'debugger'];
        case 'full':    return ['search', 'debugger', 'tester', 'reviewer', 'planner'];
        case 'safe':    return ['search', 'debugger', 'tester', 'reviewer', 'security', 'planner'];
        default:        return ['search', 'debugger', 'tester', 'reviewer']; // balanced
      }
    case 'edit':
      switch (preset) {
        case 'fast':    return ['search', 'planner'];
        case 'full':    return ['search', 'product', 'planner', 'tester', 'reviewer'];
        case 'safe':    return ['search', 'product', 'planner', 'tester', 'reviewer', 'security'];
        default:        return ['search', 'planner', 'tester', 'reviewer']; // balanced
      }
    case 'plan':
      switch (preset) {
        case 'fast':    return ['search', 'planner'];
        case 'full':    return ['search', 'product', 'research', 'planner', 'reviewer'];
        case 'safe':    return ['search', 'product', 'research', 'planner', 'reviewer', 'security'];
        default:        return ['search', 'product', 'planner']; // balanced
      }
    case 'research':
      switch (preset) {
        case 'full':    return ['search', 'research', 'docs'];
        case 'safe':    return ['search', 'research', 'docs', 'reviewer'];
        default:        return ['search', 'research']; // fast + balanced
      }
    case 'test':
      switch (preset) {
        case 'fast':    return ['search', 'tester'];
        case 'full':    return ['search', 'tester', 'debugger', 'reviewer', 'planner'];
        case 'safe':    return ['search', 'tester', 'debugger', 'reviewer', 'security', 'planner'];
        default:        return ['search', 'tester', 'debugger', 'reviewer']; // balanced
      }
    case 'review':
      switch (preset) {
        case 'fast':    return ['search', 'reviewer'];
        case 'full':    return ['search', 'reviewer', 'tester', 'security', 'planner'];
        case 'safe':    return ['search', 'reviewer', 'tester', 'security', 'planner', 'docs'];
        default:        return ['search', 'reviewer', 'tester', 'planner']; // balanced
      }
    default:
      // fallback for ask, brainstorm, scan-project, etc.
      switch (preset) {
        case 'fast':    return ['search', 'planner'];
        case 'full':    return ['search', 'product', 'planner', 'reviewer'];
        case 'safe':    return ['search', 'product', 'planner', 'reviewer', 'security'];
        default:        return ['search', 'planner', 'reviewer']; // balanced
      }
  }
}

export class SubagentPlanner {
  constructor(private readonly registry: SubagentRegistry) {}

  plan(cfg: SubagentPlanConfig): SubagentDefinition[] {
    // mode off or maxRuns=0 → no subagents
    if (cfg.subagentMode === 'off') return [];
    if (cfg.maxRuns <= 0) return [];

    const hardCap = clampHardCap(cfg.hardCap);
    const effectiveMax = clampSubagentCount(cfg.maxRuns, hardCap);
    if (effectiveMax <= 0) return [];

    const preset: SubagentPreset = cfg.preset ?? 'balanced';

    // manual mode: only run selectedRoles
    if (cfg.subagentMode === 'manual') {
      const selected = (cfg.selectedRoles ?? [])
        .filter(r => this.registry.tryGet(r as SubagentRole))
        .map(r => this.registry.tryGet(r as SubagentRole)!)
        .filter(Boolean);
      return selected.slice(0, effectiveMax);
    }

    // full mode: use 'full' preset
    const effectivePreset: SubagentPreset = cfg.subagentMode === 'full' ? 'full' : preset;

    const roleList = getRoleListForMode(cfg.mode, effectivePreset);
    const presetDefaults = SUBAGENT_PRESET_DEFAULTS[effectivePreset];

    // Compute effective flags
    const effectiveSecurity = cfg.includeSecurity
      || effectivePreset === 'safe'
      || (cfg.intent?.needsSecurity ?? false)
      || (cfg.intent?.riskLevel === 'high');

    const effectiveDocs = cfg.includeDocs || (cfg.intent?.needsDocs ?? false);

    const includeTester = cfg.includeTester !== false
      && (presetDefaults.includeTester || cfg.includeTester === true || (cfg.intent?.needsTests ?? false) || cfg.mode === 'test');

    const includeReviewer = cfg.includeReviewer !== false
      && (presetDefaults.includeReviewer || cfg.includeReviewer === true || (cfg.intent?.needsReview ?? false) || cfg.mode === 'review' || effectivePreset === 'safe');

    const result: SubagentDefinition[] = [];
    for (const role of roleList) {
      if (result.length >= effectiveMax) break;
      const def = this.registry.tryGet(role);
      if (!def) continue;
      if (!def.applicableModes.includes(cfg.mode) && !['search', 'planner'].includes(role)) continue;

      // Filter based on flags
      if (role === 'security' && !effectiveSecurity) continue;
      if (role === 'docs' && !effectiveDocs) continue;
      if (role === 'tester' && !includeTester) continue;
      if (role === 'reviewer' && !includeReviewer) continue;

      result.push(def);
    }

    return result;
  }
}
