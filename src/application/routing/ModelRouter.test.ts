import { describe, it, expect, vi } from 'vitest';
import { ModelRouter } from './ModelRouter';
import { AgentRegistry } from '../AgentRegistry';
import type { IAgent, AgentId } from '../../core/agent';
import { AgentCapabilities } from '../../core/agent';
import type { AgentTask, AgentOutput } from '../../core/agent';
import { AgentCommand } from '../../core/agent';
import type { ProviderModel } from '../../core/types';

/** Build a minimal mock agent that reports as available. */
function makeMockAgent(id: AgentId, available = true): IAgent {
  return {
    id,
    displayName: id,
    capabilities: new AgentCapabilities(true, true, true, true),
    seededModels: [] as ReadonlyArray<ProviderModel>,
    isAvailable: vi.fn().mockResolvedValue(available),
    buildCommand: (_task: AgentTask) => new AgentCommand(id, []),
    parseOutput: (_raw: string): AgentOutput => ({ content: '', format: 'text' }),
  };
}

describe('ModelRouter', () => {
  describe('resolvePlan — non-auto expressions', () => {
    it('resolves a single provider expression', async () => {
      const router = new ModelRouter();
      const registry = new AgentRegistry();
      registry.register(makeMockAgent('claude'));

      const plan = await router.resolvePlan('claude', 'edit', registry);
      expect(plan.steps).toEqual([{ providerId: 'claude' }]);
    });

    it('resolves a multi-provider fallback expression', async () => {
      const router = new ModelRouter();
      const registry = new AgentRegistry();
      registry.register(makeMockAgent('grok'));
      registry.register(makeMockAgent('claude'));

      const plan = await router.resolvePlan('grok+claude', 'edit', registry);
      expect(plan.steps).toHaveLength(2);
      expect(plan.steps[0].providerId).toBe('grok');
      expect(plan.steps[1].providerId).toBe('claude');
    });

    it('throws for invalid provider in expression', async () => {
      const router = new ModelRouter();
      const registry = new AgentRegistry();

      await expect(router.resolvePlan('invalid-provider', 'edit', registry)).rejects.toThrow();
    });
  });

  describe('resolvePlan — auto mode', () => {
    it('returns first available preferred agent for edit mode', async () => {
      const router = new ModelRouter();
      const registry = new AgentRegistry();
      // Only codex is registered and available for this test
      registry.register(makeMockAgent('codex', true));
      registry.register(makeMockAgent('claude', false));

      const plan = await router.resolvePlan('auto', 'edit', registry);
      expect(plan.raw).toBe('auto');
      expect(plan.steps.length).toBeGreaterThan(0);
      // codex is in edit preferences; claude is not available so codex should appear
      expect(plan.steps.some(s => s.providerId === 'codex')).toBe(true);
    });

    it('falls back to first preferred agent when none available', async () => {
      const router = new ModelRouter();
      const registry = new AgentRegistry();
      // Nothing registered

      const plan = await router.resolvePlan('auto', 'edit', registry);
      // Should return at least one step (first preferred)
      expect(plan.steps.length).toBeGreaterThan(0);
    });

    it('uses mode-specific preferences for research', async () => {
      const router = new ModelRouter();
      const registry = new AgentRegistry();
      registry.register(makeMockAgent('grok', true));

      const plan = await router.resolvePlan('auto', 'research', registry);
      expect(plan.steps.some(s => s.providerId === 'grok')).toBe(true);
    });
  });

  describe('resolveWithFallback', () => {
    it('returns the plan unchanged', async () => {
      const router = new ModelRouter();
      const registry = new AgentRegistry();
      const plan = await router.resolvePlan('claude', 'edit', registry);
      const resolved = router.resolveWithFallback(plan);
      expect(resolved).toBe(plan);
    });
  });
});
