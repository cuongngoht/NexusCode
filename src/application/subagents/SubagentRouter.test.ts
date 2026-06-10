import { describe, expect, it, vi } from 'vitest';
import { SubagentRouter } from './SubagentRouter';
import type { AgentRegistry } from '../AgentRegistry';
import type { IAgent } from '../../core/agent';
import type { SubagentDefinition } from './SubagentDefinition';

function makeAgent(id: string, available: boolean): IAgent {
  return {
    id: id as IAgent['id'],
    displayName: id,
    capabilities: { canEditFiles: false, canRunShell: false, canSearchWeb: false, supportsStreaming: false, supports: () => false },
    seededModels: [],
    isAvailable: vi.fn().mockResolvedValue(available),
    buildCommand: vi.fn(),
    parseOutput: vi.fn(),
  } as unknown as IAgent;
}

function makeRegistry(agents: IAgent[]): AgentRegistry {
  const map = new Map(agents.map(a => [a.id, a]));
  return {
    tryGet: (id: string) => map.get(id as IAgent['id']),
    get: (id: string) => { const a = map.get(id as IAgent['id']); if (!a) throw new Error(); return a; },
    register: vi.fn(),
    getAll: () => [...map.values()],
  } as unknown as AgentRegistry;
}

const def: SubagentDefinition = {
  role: 'planner',
  displayName: 'Planner',
  promptFile: 'subagents/planner.md',
  preferredAgentIds: ['codex', 'claude', 'antigravity'],
  applicableModes: ['edit'],
};

describe('SubagentRouter', () => {
  it('returns first preferred available agent', async () => {
    const codex = makeAgent('codex', true);
    const router = new SubagentRouter(makeRegistry([codex]));
    const result = await router.resolve(def);
    expect(result?.id).toBe('codex');
  });

  it('falls back to second preferred when first is unavailable', async () => {
    const codex = makeAgent('codex', false);
    const claude = makeAgent('claude', true);
    const router = new SubagentRouter(makeRegistry([codex, claude]));
    const result = await router.resolve(def);
    expect(result?.id).toBe('claude');
  });

  it('returns undefined when no preferred agent is available', async () => {
    const codex = makeAgent('codex', false);
    const claude = makeAgent('claude', false);
    const antigravity = makeAgent('antigravity', false);
    const router = new SubagentRouter(makeRegistry([codex, claude, antigravity]));
    const result = await router.resolve(def);
    expect(result).toBeUndefined();
  });

  it('skips agents not registered in the registry', async () => {
    const antigravity = makeAgent('antigravity', true);
    const router = new SubagentRouter(makeRegistry([antigravity]));
    const result = await router.resolve(def);
    // codex and claude are not in registry, falls through to antigravity

    expect(result?.id).toBe('antigravity');
  });
});
