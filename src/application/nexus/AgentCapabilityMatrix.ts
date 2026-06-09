import type { AgentId, TaskMode } from '../../core/agent/AgentTask';

export type DirectAgentId = Exclude<AgentId, 'nexus' | 'auto'>;
export type AgentModeFit = 'best' | 'good' | 'limited' | 'unsupported' | 'unknown';

export interface AgentModeCapability {
  agentId: DirectAgentId;
  mode: TaskMode;
  fit: AgentModeFit;
  reason: string;
}

export interface AgentRecommendation {
  mode: TaskMode;
  recommended?: DirectAgentId;
  alternatives: DirectAgentId[];
  limited: DirectAgentId[];
  unavailable: DirectAgentId[];
}

export const DIRECT_AGENT_IDS: readonly DirectAgentId[] = [
  'claude',
  'codex',
  'antigravity',
  'copilot',
  'aider',
  'custom',
  'grok',
];

const TASK_MODES: readonly TaskMode[] = [
  'ask',
  'research',
  'scan-project',
  'plan',
  'brainstorm',
  'edit',
  'debug',
  'test',
  'review',
];

type FitRanking = Partial<Record<AgentModeFit, readonly DirectAgentId[]>>;

const MODE_RANKINGS: Record<TaskMode, FitRanking> = {
  ask: {
    best: ['codex', 'claude'],
    good: ['grok', 'antigravity', 'copilot'],
    limited: ['aider', 'custom'],
  },
  plan: {
    best: ['codex', 'claude'],
    good: ['grok', 'antigravity', 'copilot'],
    limited: ['aider', 'custom'],
  },
  edit: {
    best: ['claude', 'codex'],
    good: ['grok', 'aider'],
    limited: ['antigravity', 'copilot', 'custom'],
  },
  debug: {
    best: ['claude', 'codex'],
    good: ['grok', 'aider'],
    limited: ['antigravity', 'copilot', 'custom'],
  },
  test: {
    best: ['claude', 'codex', 'grok', 'aider'],
    limited: ['antigravity', 'copilot', 'custom'],
  },
  review: {
    best: ['codex', 'claude'],
    good: ['grok', 'antigravity', 'copilot'],
    limited: ['aider', 'custom'],
  },
  research: {
    best: ['antigravity', 'grok'],
    good: ['codex', 'claude'],
    limited: ['copilot', 'aider', 'custom'],
  },
  brainstorm: {
    best: ['claude', 'codex', 'antigravity', 'grok'],
    good: ['copilot'],
    limited: ['aider', 'custom'],
  },
  'scan-project': {
    best: ['antigravity', 'codex'],
    good: ['grok', 'claude'],
    limited: ['copilot', 'aider', 'custom'],
  },
};

const DEFAULT_REASONS: Record<DirectAgentId, string> = {
  claude: 'Strong edit, debug, and test support because it can edit files and run shell commands.',
  codex: 'Strong planning and code reasoning support with file editing and shell execution.',
  antigravity: 'Strong research/search support with web search capability, but limited for flows that need shell commands.',
  copilot: 'Can edit files but cannot run shell commands, so debug and test flows are limited.',
  aider: 'Strong direct file editing, but less suitable for ask, plan, and review than general reasoning agents.',
  custom: 'Behavior depends on the user-defined command, so Nexus treats it as an unknown fallback.',
  grok: 'Strong ask and research support with web search capability, file editing, and shell execution.',
};

const FIT_ORDER: readonly AgentModeFit[] = ['best', 'good', 'limited'];

export function buildAgentCapabilityMatrix(): AgentModeCapability[] {
  return TASK_MODES.flatMap(mode =>
    DIRECT_AGENT_IDS.map(agentId => ({
      agentId,
      mode,
      fit: fitFor(mode, agentId),
      reason: DEFAULT_REASONS[agentId],
    })),
  );
}

export function buildAgentRecommendations(
  availableProviderIds: readonly string[],
): AgentRecommendation[] {
  const available = new Set<DirectAgentId>(
    availableProviderIds.filter(isDirectAgentId),
  );

  return TASK_MODES.map(mode => {
    const ranked = rankingFor(mode);
    const recommended = ranked.find(agentId => available.has(agentId));
    const alternatives = ranked.filter(agentId =>
      agentId !== recommended &&
      available.has(agentId) &&
      (fitFor(mode, agentId) === 'best' || fitFor(mode, agentId) === 'good')
    );
    const limited = (MODE_RANKINGS[mode].limited ?? [])
      .filter(agentId => available.has(agentId) && agentId !== recommended);
    const unavailable = DIRECT_AGENT_IDS.filter(agentId => !available.has(agentId));

    return {
      mode,
      recommended,
      alternatives,
      limited,
      unavailable,
    };
  });
}

function fitFor(mode: TaskMode, agentId: DirectAgentId): AgentModeFit {
  const ranking = MODE_RANKINGS[mode];
  for (const fit of FIT_ORDER) {
    if (ranking[fit]?.includes(agentId)) {
      return agentId === 'custom' ? 'unknown' : fit;
    }
  }
  return agentId === 'custom' ? 'unknown' : 'unsupported';
}

function rankingFor(mode: TaskMode): DirectAgentId[] {
  return FIT_ORDER.flatMap(fit => MODE_RANKINGS[mode][fit] ?? []);
}

function isDirectAgentId(id: string): id is DirectAgentId {
  return (DIRECT_AGENT_IDS as readonly string[]).includes(id);
}
