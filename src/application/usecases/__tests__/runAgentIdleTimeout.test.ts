import { describe, it, expect } from 'vitest';
import { RunAgentUseCase, type IdleTimeoutResolver } from '../RunAgentUseCase';
import { AgentTask } from '../../../core/agent/AgentTask';
import { AgentCommand } from '../../../core/agent/AgentCommand';
import { AgentCapabilities } from '../../../core/agent/AgentCapabilities';
import type { TaskMode } from '../../../core/agent';
import type { IAgent } from '../../../core/agent';
import type { IProcessRunner, RunOptions } from '../../../core/runner/IProcessRunner';
import type { AgentCommand as Cmd } from '../../../core/agent/AgentCommand';
import { EventBus } from '../../../core/eventBus';
import { AgentRouter } from '../../AgentRouter';
import { AgentRegistry } from '../../AgentRegistry';

/**
 * Captures the RunOptions the use case hands to the process runner, which is
 * where the idle timeout actually takes effect.
 */
class SpyRunner implements IProcessRunner {
  lastOptions?: RunOptions;

  async run(_command: Cmd, options?: RunOptions) {
    this.lastOptions = options;
    return { content: '', raw: '', exitCode: 0, durationMs: 1 } as never;
  }

  async stop(): Promise<void> {}
}

const stubAgent: IAgent = {
  id: 'claude',
  displayName: 'Stub',
  capabilities: new AgentCapabilities(true, true, true, true),
  seededModels: [],
  async isAvailable() {
    return true;
  },
  buildCommand() {
    return new AgentCommand('echo', ['hi']);
  },
  parseOutput(raw: string) {
    return { content: raw, format: 'text' as const };
  },
} as unknown as IAgent;

async function idleTimeoutFor(mode: TaskMode, resolver?: IdleTimeoutResolver): Promise<number | undefined> {
  const runner = new SpyRunner();
  const registry = new AgentRegistry();
  registry.register(stubAgent);
  const useCase = new RunAgentUseCase(
    new AgentRouter(registry),
    runner,
    new EventBus(),
    undefined,
    undefined,
    undefined,
    resolver,
  );

  const task = new AgentTask('prompt', 'prompt', 'claude', mode, undefined, '/tmp');
  await useCase.executeWithAgent(task, stubAgent);
  return runner.lastOptions?.idleTimeoutMs;
}

describe('RunAgentUseCase idle timeout', () => {
  it('gives understand mode far more headroom than a normal task', async () => {
    // Regression guard: understand mode previously inherited the 5-minute
    // default and was killed mid-run on a large repo (302s observed).
    expect(await idleTimeoutFor('understand')).toBe(30 * 60 * 1000);
    expect(await idleTimeoutFor('ask')).toBe(5 * 60 * 1000);
  });

  it('keeps review at 20 minutes to match the CLI print timeout', async () => {
    expect(await idleTimeoutFor('review')).toBe(20 * 60 * 1000);
  });

  it('lets an injected resolver override the per-mode default', async () => {
    expect(await idleTimeoutFor('understand', () => 90_000)).toBe(90_000);
  });

  it('falls back to the built-in default when the resolver returns nothing usable', async () => {
    for (const bad of [undefined, 0, -1, Number.NaN]) {
      expect(await idleTimeoutFor('understand', () => bad as number | undefined)).toBe(30 * 60 * 1000);
    }
  });

  it('applies the resolver per mode, not once globally', async () => {
    const resolver: IdleTimeoutResolver = mode => (mode === 'edit' ? 111_000 : undefined);
    expect(await idleTimeoutFor('edit', resolver)).toBe(111_000);
    expect(await idleTimeoutFor('ask', resolver)).toBe(5 * 60 * 1000);
  });
});
