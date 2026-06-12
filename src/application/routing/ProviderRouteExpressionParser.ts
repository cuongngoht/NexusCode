import type { AgentId } from '../../core/agent/AgentTask';
import type { ProviderRoutePlan, ProviderRouteStep } from './RoutingTypes';

const VALID_AGENT_IDS: ReadonlySet<AgentId> = new Set<AgentId>([
  'nexus', 'claude', 'codex', 'antigravity', 'copilot', 'aider', 'custom', 'grok', 'auto',
]);

function isValidAgentId(id: string): id is AgentId {
  return VALID_AGENT_IDS.has(id as AgentId);
}

/**
 * Parses a provider route expression into a structured plan.
 *
 * Syntax:
 *   <provider>                    → single provider, no model pinning
 *   <provider>:<model>            → single provider, model pinned
 *   <provider>+<provider>         → fallback chain
 *   <provider>:<model>+<provider> → fallback chain with model pinning
 *
 * Examples:
 *   'claude'              → [{ providerId: 'claude' }]
 *   'grok+claude'         → [{ providerId: 'grok' }, { providerId: 'claude' }]
 *   'codex:gpt-5.2+claude:sonnet' → [{ providerId: 'codex', model: 'gpt-5.2' }, { providerId: 'claude', model: 'sonnet' }]
 *   'auto'                → [{ providerId: 'auto' }]
 */
export class ProviderRouteExpressionParser {
  static parse(expression: string): ProviderRoutePlan {
    if (!expression || expression.trim() === '') {
      throw new Error('Provider expression cannot be empty');
    }

    const raw = expression.trim();
    const tokens = raw.split('+');
    const steps: ProviderRouteStep[] = [];

    for (const token of tokens) {
      const trimmed = token.trim();
      if (!trimmed) {
        throw new Error(`Empty token in provider expression: '${expression}'`);
      }

      const colonIdx = trimmed.indexOf(':');
      if (colonIdx === -1) {
        // No model pinning
        if (!isValidAgentId(trimmed)) {
          throw new Error(
            `Unknown provider '${trimmed}' in expression '${expression}'. ` +
            `Valid providers: ${Array.from(VALID_AGENT_IDS).join(', ')}`,
          );
        }
        steps.push({ providerId: trimmed });
      } else {
        const providerPart = trimmed.slice(0, colonIdx);
        const modelPart = trimmed.slice(colonIdx + 1);

        if (!isValidAgentId(providerPart)) {
          throw new Error(
            `Unknown provider '${providerPart}' in expression '${expression}'. ` +
            `Valid providers: ${Array.from(VALID_AGENT_IDS).join(', ')}`,
          );
        }

        steps.push({
          providerId: providerPart,
          model: modelPart.length > 0 ? modelPart : undefined,
        });
      }
    }

    return { raw, steps };
  }
}
