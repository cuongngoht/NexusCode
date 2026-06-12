import type { AgentId, TaskMode } from '../../core/agent/AgentTask';
import type { ProviderRoutePlan } from './RoutingTypes';
import { ProviderRouteExpressionParser } from './ProviderRouteExpressionParser';
import { AgentRegistry } from '../AgentRegistry';

/**
 * Preferred provider order per task mode for 'auto' routing.
 * Only AgentIds that exist in the registry will be used.
 */
const MODE_PREFERENCES: Partial<Record<TaskMode, AgentId[]>> = {
  research:  ['grok', 'codex', 'claude', 'nexus'],
  edit:      ['claude', 'codex', 'aider', 'custom'],
  review:    ['claude', 'codex', 'custom'],
  plan:      ['claude', 'antigravity', 'codex', 'custom'],
  debug:     ['codex', 'claude', 'aider', 'custom'],
  test:      ['codex', 'claude', 'aider', 'custom'],
  brainstorm:['claude', 'codex', 'antigravity', 'custom'],
  ask:       ['claude', 'codex', 'custom'],
  'scan-project': ['claude', 'codex', 'custom'],
};

const DEFAULT_PREFERENCE: AgentId[] = ['claude', 'codex', 'custom'];

export class ModelRouter {
  /**
   * Resolves a provider expression into a route plan.
   *
   * - For 'auto': look up mode preferences, filter to registered+available agents.
   * - For multi-provider expressions (containing '+'): parse with ProviderRouteExpressionParser.
   * - For single provider: parse as-is.
   *
   * If all preferred agents are unavailable in 'auto' mode, returns the first preferred
   * agent anyway (letting the runner surface a meaningful error).
   */
  async resolvePlan(
    providerExpression: string,
    mode: TaskMode,
    registry: AgentRegistry,
  ): Promise<ProviderRoutePlan> {
    if (providerExpression !== 'auto') {
      return ProviderRouteExpressionParser.parse(providerExpression);
    }

    // auto mode: find available agents from preferences
    const preferred = MODE_PREFERENCES[mode] ?? DEFAULT_PREFERENCE;
    const available: AgentId[] = [];

    for (const id of preferred) {
      const agent = registry.tryGet(id);
      if (!agent) continue;
      try {
        if (await agent.isAvailable()) {
          available.push(id);
        }
      } catch {
        // isAvailable must not throw, but guard defensively
      }
    }

    const chosen = available.length > 0 ? available : [preferred[0] ?? 'claude'];
    return {
      raw: 'auto',
      steps: chosen.map(providerId => ({ providerId })),
    };
  }

  /**
   * Stub for future fallback-aware plan adjustment.
   * Currently returns the plan unchanged.
   */
  resolveWithFallback(plan: ProviderRoutePlan): ProviderRoutePlan {
    return plan;
  }
}
