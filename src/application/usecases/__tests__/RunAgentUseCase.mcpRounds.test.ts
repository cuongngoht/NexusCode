import { describe, it, expect, vi } from 'vitest';
import { RunAgentUseCase } from '../RunAgentUseCase';
import { AgentTask } from '../../../core/agent/AgentTask';
import { AgentResult } from '../../../core/agent/AgentResult';
import { AgentCommand } from '../../../core/agent/AgentCommand';
import { AgentCapabilities } from '../../../core/agent/AgentCapabilities';
import type { IAgent } from '../../../core/agent/IAgent';
import type { IProcessRunner, RunOptions } from '../../../core/runner/IProcessRunner';
import type { IEventBus, NexusEvent } from '../../../core/events/IEventBus';
import type { AgentRouter } from '../../AgentRouter';
import type { McpToolUseCase } from '../../../mcp/McpToolUseCase';
import type { ConfigService } from '../../../config/ConfigService';
import type { McpRoundOutcome, McpToolIntent } from '../../../mcp/McpTypes';
import { DEFAULT_CONFIG } from '../../../config/DefaultConfig';

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

const intentBlock = (group: string, query: string) =>
  `<NEXUS_TOOL_INTENT>{"group":"${group}","query":"${query}","reason":"need docs"}</NEXUS_TOOL_INTENT>`;

class FakeAgent implements IAgent {
  readonly id = 'claude' as const;
  readonly displayName = 'Claude';
  readonly capabilities = new AgentCapabilities(true, true, true, true);
  readonly seededModels = [];
  constructor(private readonly transport?: string) {}
  async isAvailable() { return true; }
  buildCommand(task: AgentTask) {
    return new AgentCommand('claude', [task.enhancedPrompt], undefined, undefined, undefined, this.transport);
  }
  parseOutput(raw: string) { return { content: raw, format: 'text' as const }; }
}

/** Emits a scripted stdout string per run, so each round can produce different output. */
class ScriptedRunner implements IProcessRunner {
  readonly runs: string[] = [];
  constructor(private readonly outputs: string[]) {}
  async run(command: AgentCommand, options?: RunOptions): Promise<AgentResult> {
    const index = this.runs.length;
    this.runs.push(command.args[0] ?? '');
    const out = this.outputs[index] ?? '';
    options?.onStdout?.(out);
    return new AgentResult(0, out, '', 5);
  }
  async stop() { /* no-op */ }
}

class RecordingBus implements IEventBus {
  readonly events: NexexEventLike[] = [];
  emit(event: NexusEvent) { this.events.push(event as NexexEventLike); }
  on() { /* no-op */ }
  off() { /* no-op */ }
  kinds(kind: string) { return this.events.filter(e => e.kind === kind); }
}
type NexexEventLike = NexusEvent & { task?: { id: string } };

function makeRouter(agent: IAgent): AgentRouter {
  return { resolve: async () => agent } as unknown as AgentRouter;
}

function makeConfigService(mcp: Partial<typeof DEFAULT_CONFIG.mcp>): ConfigService {
  return {
    loadConfig: async () => ({
      ...structuredClone(DEFAULT_CONFIG),
      mcp: { ...structuredClone(DEFAULT_CONFIG.mcp), ...mcp },
    }),
  } as unknown as ConfigService;
}

/** Real parse semantics (regex over the collected text), scripted execution. */
function makeMcp(outcomes: Array<Partial<McpRoundOutcome>>) {
  const calls: McpToolIntent[] = [];
  let index = 0;
  const useCase = {
    parseIntent(output: string): McpToolIntent | undefined {
      const matches = [...output.matchAll(/<NEXUS_TOOL_INTENT>([\s\S]*?)<\/NEXUS_TOOL_INTENT>/g)];
      const last = matches[matches.length - 1];
      return last ? (JSON.parse(last[1]) as McpToolIntent) : undefined;
    },
    async runIntent(input: { intent: McpToolIntent }): Promise<McpRoundOutcome> {
      calls.push(input.intent);
      const scripted = outcomes[index++] ?? {};
      return {
        status: scripted.status ?? 'executed',
        contextText: scripted.contextText ?? '## MCP Result\ndocs here',
        used: scripted.used ?? { presetId: 'microsoftLearn', presetDisplayName: 'MS Learn', toolName: 'search' },
      };
    },
  } as unknown as McpToolUseCase;
  return { useCase, calls };
}

const task = () => new AgentTask('p', 'ENHANCED', 'claude', 'ask', undefined, '/ws');

// ---------------------------------------------------------------------------

describe('RunAgentUseCase — MCP round budget', () => {
  it('runs no MCP round when maxRoundsPerTask is 0', async () => {
    const runner = new ScriptedRunner([intentBlock('docs', 'azure functions')]);
    const mcp = makeMcp([]);
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), runner, new RecordingBus(),
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 0 }),
    );

    await uc.execute(task());

    expect(runner.runs).toHaveLength(1);
    expect(mcp.calls).toHaveLength(0);
  });

  it('does not charge round 0 against the budget — one intent yields 2 runs, 1 MCP call', async () => {
    const runner = new ScriptedRunner([intentBlock('docs', 'azure functions'), 'final answer']);
    const mcp = makeMcp([{}]);
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), runner, new RecordingBus(),
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 1 }),
    );

    await uc.execute(task());

    expect(runner.runs).toHaveLength(2);
    expect(mcp.calls).toHaveLength(1);
    // The MCP result reached the follow-up prompt.
    expect(runner.runs[1]).toContain('## MCP Result');
  });

  // Dedup is the safety net against a model that keeps asking for the same thing:
  // without it, a 5-round budget means 5 identical network calls and 5 extra agent runs.
  it('stops when the agent re-emits an identical intent, even with budget left', async () => {
    const same = intentBlock('docs', 'azure functions');
    const runner = new ScriptedRunner([same, same, same, same]);
    const mcp = makeMcp([{}, {}, {}]);
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), runner, new RecordingBus(),
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 3 }),
    );

    await uc.execute(task());

    expect(mcp.calls).toHaveLength(1);
    expect(runner.runs).toHaveLength(2);
  });

  it('treats a paraphrased reason as the same request (dedup ignores reason)', async () => {
    const a = '<NEXUS_TOOL_INTENT>{"group":"docs","query":"Azure  Functions","reason":"first"}</NEXUS_TOOL_INTENT>';
    const b = '<NEXUS_TOOL_INTENT>{"group":"docs","query":"azure functions","reason":"second, differently worded"}</NEXUS_TOOL_INTENT>';
    const runner = new ScriptedRunner([a, b, 'answer']);
    const mcp = makeMcp([{}, {}]);
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), runner, new RecordingBus(),
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 3 }),
    );

    await uc.execute(task());

    expect(mcp.calls).toHaveLength(1);
  });

  it('serves distinct intents up to the budget, then stops', async () => {
    const runner = new ScriptedRunner([
      intentBlock('docs', 'query one'),
      intentBlock('samples', 'query two'),
      intentBlock('library-api', 'query three'),
      intentBlock('docs', 'query four'),
    ]);
    const mcp = makeMcp([{}, {}, {}, {}]);
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), runner, new RecordingBus(),
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 3 }),
    );

    await uc.execute(task());

    expect(mcp.calls).toHaveLength(3);
    expect(runner.runs).toHaveLength(4);
  });

  it('clamps an absurd configured budget', async () => {
    const runner = new ScriptedRunner(
      Array.from({ length: 20 }, (_, i) => intentBlock('docs', `query ${i}`)),
    );
    const mcp = makeMcp(Array.from({ length: 20 }, () => ({})));
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), runner, new RecordingBus(),
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 999 }),
    );

    await uc.execute(task());

    expect(mcp.calls).toHaveLength(5);
  });

  it('stops after a denied round instead of burning the budget', async () => {
    const runner = new ScriptedRunner([
      intentBlock('docs', 'q1'), intentBlock('docs', 'q2'), intentBlock('docs', 'q3'),
    ]);
    const mcp = makeMcp([{ status: 'denied', contextText: '## MCP Request Denied' }, {}]);
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), runner, new RecordingBus(),
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 3 }),
    );

    await uc.execute(task());

    expect(mcp.calls).toHaveLength(1);
    // The follow-up still runs, so the agent learns the tool was refused.
    expect(runner.runs).toHaveLength(2);
    expect(runner.runs[1]).toContain('## MCP Request Denied');
  });

  it('skips MCP entirely when disabled', async () => {
    const runner = new ScriptedRunner([intentBlock('docs', 'q')]);
    const mcp = makeMcp([{}]);
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), runner, new RecordingBus(),
      mcp.useCase, makeConfigService({ enabled: false, maxRoundsPerTask: 3 }),
    );

    await uc.execute(task());

    expect(mcp.calls).toHaveLength(0);
    expect(runner.runs).toHaveLength(1);
  });
});

describe('RunAgentUseCase — single lifecycle across rounds', () => {
  it('emits exactly one task_started / task_completed / final usage, all with one task id', async () => {
    const runner = new ScriptedRunner([
      intentBlock('docs', 'q1'), intentBlock('samples', 'q2'), 'final answer',
    ]);
    const mcp = makeMcp([{}, {}]);
    const bus = new RecordingBus();
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), runner, bus,
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 2 }),
    );

    const t = task();
    await uc.execute(t);

    expect(runner.runs).toHaveLength(3);
    expect(bus.kinds('task_started')).toHaveLength(1);
    expect(bus.kinds('task_completed')).toHaveLength(1);
    expect(bus.events.filter(e => e.kind === 'token_usage_updated' && e.phase === 'final')).toHaveLength(1);

    const taskIds = new Set(bus.events.filter(e => 'task' in e && e.task).map(e => e.task!.id));
    expect([...taskIds]).toEqual([t.id]);
  });

  it('emits one mcp_tool_used per round, carrying status and round number', async () => {
    const runner = new ScriptedRunner([intentBlock('docs', 'q1'), intentBlock('samples', 'q2'), 'done']);
    const mcp = makeMcp([{}, { status: 'error', contextText: '## MCP Error' }]);
    const bus = new RecordingBus();
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), runner, bus,
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 2 }),
    );

    await uc.execute(task());

    const used = bus.kinds('mcp_tool_used') as Array<{ round: number; status: string }>;
    expect(used).toHaveLength(2);
    expect(used[0]).toMatchObject({ round: 1, status: 'executed' });
    expect(used[1]).toMatchObject({ round: 2, status: 'error' });
  });

  it('marks the task completed once, not once per round', async () => {
    const runner = new ScriptedRunner([intentBlock('docs', 'q'), 'answer']);
    const mcp = makeMcp([{}]);
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), runner, new RecordingBus(),
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 1 }),
    );

    const t = task();
    await uc.execute(t);
    expect(t.status).toBe('completed');
  });
});

describe('RunAgentUseCase — stopping halts the round loop', () => {
  // Stopping kills the child process, which makes the in-flight run *resolve* rather
  // than throw. Without an explicit stop flag the loop would read the truncated output,
  // find the intent, and fire a fresh tool call plus another agent run after the user
  // asked it to stop.
  it('does not start a new MCP round after stop()', async () => {
    const mcp = makeMcp([{}]);
    const bus = new RecordingBus();
    let uc!: RunAgentUseCase;

    const stoppingRunner: IProcessRunner = {
      runs: 0,
      async run(_command, options) {
        (this as { runs: number }).runs += 1;
        options?.onStdout?.(intentBlock('docs', 'azure functions'));
        // Simulates the user hitting Stop mid-run.
        await uc.stop();
        return new AgentResult(0, '', '', 1);
      },
      async stop() {},
    } as IProcessRunner & { runs: number };

    uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), stoppingRunner, bus,
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 3 }),
    );

    await uc.execute(task());

    expect(mcp.calls).toHaveLength(0);
    expect((stoppingRunner as unknown as { runs: number }).runs).toBe(1);
  });

  it('does not claim completion for a stopped task', async () => {
    const bus = new RecordingBus();
    let uc!: RunAgentUseCase;
    const stoppingRunner: IProcessRunner = {
      async run(_command, options) {
        options?.onStdout?.('partial');
        await uc.stop();
        return new AgentResult(0, '', '', 1);
      },
      async stop() {},
    };
    uc = new RunAgentUseCase(makeRouter(new FakeAgent()), stoppingRunner, bus);

    await uc.execute(task());

    expect(bus.kinds('task_stopped')).toHaveLength(1);
    expect(bus.kinds('task_completed')).toHaveLength(0);
  });
});

describe('RunAgentUseCase — MCP failures are non-fatal', () => {
  it('returns the base result when loadConfig throws', async () => {
    const runner = new ScriptedRunner([intentBlock('docs', 'q')]);
    const mcp = makeMcp([{}]);
    const bus = new RecordingBus();
    const failing = { loadConfig: async () => { throw new Error('corrupt json'); } } as unknown as ConfigService;
    const uc = new RunAgentUseCase(makeRouter(new FakeAgent()), runner, bus, mcp.useCase, failing);

    await expect(uc.execute(task())).resolves.toBeInstanceOf(AgentResult);
    expect(bus.kinds('task_error')).toHaveLength(0);
    expect(bus.kinds('task_completed')).toHaveLength(1);
  });

  it('returns the base result when runIntent throws', async () => {
    const runner = new ScriptedRunner([intentBlock('docs', 'q')]);
    const throwing = {
      parseIntent: () => ({ group: 'docs', query: 'q', reason: 'r' }),
      runIntent: async () => { throw new Error('broker exploded'); },
    } as unknown as McpToolUseCase;
    const bus = new RecordingBus();
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), runner, bus, throwing,
      makeConfigService({ enabled: true, maxRoundsPerTask: 2 }),
    );

    await expect(uc.execute(task())).resolves.toBeInstanceOf(AgentResult);
    expect(bus.kinds('task_error')).toHaveLength(0);
    expect(runner.runs).toHaveLength(1);
  });

  it('still emits task_error when the underlying runner fails', async () => {
    const runner = {
      run: async () => { throw new Error('spawn failed'); },
      stop: async () => {},
    } as unknown as IProcessRunner;
    const bus = new RecordingBus();
    const uc = new RunAgentUseCase(makeRouter(new FakeAgent()), runner, bus);

    await expect(uc.execute(task())).rejects.toThrow('spawn failed');
    expect(bus.kinds('task_error')).toHaveLength(1);
    expect(bus.kinds('task_completed')).toHaveLength(0);
  });
});

describe('RunAgentUseCase — the intent tag never reaches the transcript', () => {
  const stdoutText = (bus: RecordingBus) =>
    bus.events.filter(e => e.kind === 'stdout').map(e => (e as { chunk: string }).chunk).join('');

  it('strips the tag from stdout while still acting on it', async () => {
    const runner = new ScriptedRunner([
      `Here is my thinking. ${intentBlock('docs', 'azure functions')} Done thinking.`,
      'final answer',
    ]);
    const mcp = makeMcp([{}]);
    const bus = new RecordingBus();
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), runner, bus,
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 1 }),
    );

    await uc.execute(task());

    // Acted on:
    expect(mcp.calls).toHaveLength(1);
    // But invisible:
    const shown = stdoutText(bus);
    expect(shown).not.toContain('NEXUS_TOOL_INTENT');
    expect(shown).toContain('Here is my thinking.');
    expect(shown).toContain('Done thinking.');
    expect(shown).toContain('final answer');
  });

  it('strips the tag when it arrives split across chunks', async () => {
    const bus = new RecordingBus();
    const splitRunner: IProcessRunner = {
      async run(_command, options) {
        options?.onStdout?.('answer <NEXUS');
        options?.onStdout?.('_TOOL_INTENT>{"group":"docs","query":"q","reason":"r"}</NEXUS');
        options?.onStdout?.('_TOOL_INTENT> tail');
        return new AgentResult(0, '', '', 1);
      },
      async stop() {},
    };
    const mcp = makeMcp([{}]);
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent()), splitRunner, bus,
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 1 }),
    );

    await uc.execute(task());

    const shown = stdoutText(bus);
    expect(shown).not.toContain('NEXUS_TOOL_INTENT');
    expect(shown).toContain('answer');
    expect(shown).toContain('tail');
    expect(mcp.calls).toHaveLength(1);
  });
});

describe('RunAgentUseCase — intent detection through a stream pipeline', () => {
  // The regression for the JSONL blind spot: the collector used to receive the raw wire
  // frame, so a tag inside a JSONL envelope arrived with escaped quotes and a literal
  // \n and could never be parsed.
  it('finds an intent that arrives inside codex JSONL, not just in plain text', async () => {
    const jsonl = JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: intentBlock('docs', 'azure functions') },
    }) + '\n';

    const runner = new ScriptedRunner([jsonl, 'final answer']);
    const mcp = makeMcp([{}]);
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent('codex-jsonl')), runner, new RecordingBus(),
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 1 }),
    );

    await uc.execute(task());

    expect(mcp.calls).toHaveLength(1);
    expect(mcp.calls[0]).toMatchObject({ group: 'docs', query: 'azure functions' });
  });

  it('does not leak the raw JSONL envelope into the intent query', async () => {
    const jsonl = JSON.stringify({
      type: 'item.completed',
      item: { type: 'agent_message', text: intentBlock('samples', 'retry policy') },
    }) + '\n';

    const runner = new ScriptedRunner([jsonl, 'done']);
    const mcp = makeMcp([{}]);
    const uc = new RunAgentUseCase(
      makeRouter(new FakeAgent('codex-jsonl')), runner, new RecordingBus(),
      mcp.useCase, makeConfigService({ enabled: true, maxRoundsPerTask: 1 }),
    );

    await uc.execute(task());

    expect(mcp.calls[0].query).toBe('retry policy');
    expect(mcp.calls[0].query).not.toContain('item.completed');
  });
});
