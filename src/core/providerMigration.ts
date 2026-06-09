import type { AgentId } from './agent/AgentTask';
import type { ProviderId } from './types';

const LEGACY_PROVIDER_MAP: Record<string, ProviderId> = {
  gemini: 'antigravity',
};

const VALID_PROVIDER_IDS: readonly ProviderId[] = [
  'nexus', 'codex', 'claude', 'antigravity', 'copilot', 'aider', 'custom', 'auto',
];

const VALID_AGENT_IDS: readonly AgentId[] = [
  'nexus', 'claude', 'codex', 'antigravity', 'copilot', 'aider', 'custom', 'auto',
];

export function normalizeProviderId(id: string): ProviderId {
  if (id in LEGACY_PROVIDER_MAP) return LEGACY_PROVIDER_MAP[id];
  return (VALID_PROVIDER_IDS as readonly string[]).includes(id) ? (id as ProviderId) : 'auto';
}

export function normalizeAgentId(id: string): AgentId {
  if (id in LEGACY_PROVIDER_MAP) return LEGACY_PROVIDER_MAP[id] as AgentId;
  return (VALID_AGENT_IDS as readonly string[]).includes(id) ? (id as AgentId) : 'auto';
}
